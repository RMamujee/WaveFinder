# WaveFinder Performance Audit

App at `C:\Users\Rahil\WaveFinder` (repo root, despite `package.json name: "surf-app"`). Next.js 16.2.4 / React 19.2 / Turbopack, Prisma + Neon, Upstash Redis (via `@vercel/functions` runtime cache), React Query, Leaflet, recharts. Findings are ordered by impact.

## Quick wins (highest impact / lowest effort)

1. **Add `optimizePackageImports` for `recharts` + `date-fns`** (next.config.ts) — biggest bundle win, ~5 min.
2. **Remove `force-dynamic` from `/api/spots`** so the `Cache-Control` headers you already set actually take effect — one line.
3. **Drop `refetchOnWindowFocus: true`** in `Providers.tsx` — every tab-focus refetches forecast/map/all-spots payloads. One-line change, removes a large amount of redundant external-API + DB load.
4. **Static-render the marketing/region/dashboard pages** — `app/page.tsx` does a live DB `count()` on every request with no caching.

---

## CRITICAL

### C1. The home page map loads the entire spot set with live conditions on first paint — the single largest TTFB/transfer cost
**Files:** `components/home/LiveMapHero.tsx:38-49`, `app/api/spots/route.ts:7` (`force-dynamic`)

The landing page (`/`) immediately fires two queries:
- `/api/spots?slim=true` (all ~1,490 spots, marker fields)
- `/api/spots?withConditions=true` — this fans out to Open-Meteo for **~120 unique lat/lng buckets in batches of 40** (`route.ts:82-91`), each call up to 5s. Worst case ~15s, and the route is `force-dynamic` (`route.ts:7`) so **nothing is cached at the Vercel edge** — every visitor re-runs the full fan-out (the only thing saving you is the per-bucket runtime cache, which is cold on new instances).

Impact: this is your slowest, heaviest request and it's on the landing page. On a cold instance the map's live colors can take 10-15s, and the `force-dynamic` means the HTML/edge can never serve a cached enriched payload.

**Fix:**
- Remove `force-dynamic`; let the route be cacheable. You already emit `s-maxage=180, stale-while-revalidate=60` (`route.ts:174`) — but `force-dynamic` *disables* that edge caching. Removing it lets the CDN serve the enriched JSON to all users for 3 min with SWR, collapsing N visitors → 1 origin computation.
- Render markers from `slim` immediately (already done) and treat `withConditions` as a slow background enrich (already structured that way) — just make it edge-cached.
- **Expected impact:** enriched map payload served from edge in ~tens of ms for all but the first visitor per 3-min window; eliminates the per-visitor 120-bucket fan-out.

### C2. `force-dynamic` on `/api/spots` defeats the `Cache-Control` headers the route already sets
**File:** `app/api/spots/route.ts:7`

`export const dynamic = 'force-dynamic'` forces the function to run per-request and **strips CDN caching**, so the `s-maxage=600` (slim), `s-maxage=180` (conditions) headers at lines 55/174 are effectively dead. This route serves the home map, `/spots`, `/compare` (`spots-all`), and dashboard. Every one of those is paying full origin cost on every request.

**Fix:** Remove `force-dynamic`. The route reads only `searchParams` (no cookies/headers), so it's safely cacheable per-URL. Keep the existing `Cache-Control`. **Expected impact:** order-of-magnitude TTFB reduction on `/spots`, `/`, `/compare` for repeat/concurrent traffic.

---

## HIGH

### H1. recharts is statically bundled into the spot page's first load (4 charts, no code-split)
**Files:** `SpotForecastView.tsx:9-13` imports `WaveChart/WindChart/WindRoseChart/TideChart/UVChart`; each (`WaveChart.tsx:4-6` etc.) does `import { AreaChart, ... } from 'recharts'`.

recharts v3 is large (~150-200KB gzipped with its d3 deps). It's imported eagerly into `SpotForecastView`, which is itself a giant `'use client'` component (660 lines) rendered for every spot page. The charts are below the fold (hourly table, wave height, tides are lower in the layout) but ship in the initial JS chunk.

**Fix (two levels):**
1. Add to `next.config.ts`:
   ```ts
   experimental: { optimizePackageImports: ['recharts', 'date-fns'] }
   ```
   This tree-shakes the barrel imports — meaningful even without dynamic import.
2. Dynamic-import the chart components with `next/dynamic` (no `ssr:false` needed since they're client already, but `loading` placeholders help). The charts are not LCP and not above the fold.

**Expected impact:** cuts the spot page's initial JS substantially; charts hydrate on demand.

### H2. `refetchOnWindowFocus` + `staleTime` mismatch causes redundant refetching of the heaviest endpoints
**File:** `components/layout/Providers.tsx:11-19`

Global defaults: `refetchOnWindowFocus: true`, `refetchOnReconnect: true`, `retry: 3`, `staleTime: 30 min`. Every time the user alt-tabs back, React Query refetches any query older than 30 min — including `spots-home-conditions` (the 120-bucket fan-out), `spots-all`, and forecasts. The forecast query overrides `staleTime` to 60 min (`SpotForecastView.tsx:97`) but compare uses 30 min (`compare/page.tsx:519`).

**Fix:** Set `refetchOnWindowFocus: false` globally (surf data does not change second-to-second; the route caches are 30-60 min anyway). Optionally raise `staleTime` on the conditions/spots queries to match the route's cache TTL. **Expected impact:** removes a whole class of background re-fan-out.

### H3. `app/page.tsx` runs an uncached live DB `count()` on every home request
**File:** `app/page.tsx:5-7`

```ts
const spotCount = process.env.DATABASE_URL ? await prisma.surfSpot.count().catch(() => 0) : 0
```
This makes the home page a dynamic render with a DB round-trip on every hit, just to print "1,490+ live spots." No `revalidate`, no caching.

**Fix:** Wrap in `unstable_cache`/`'use cache'` with a long TTL, or add `export const revalidate = 86400` to the page, or just hardcode/env the marketing number. The count is cosmetic. **Expected impact:** home page becomes statically/ISR served, removing a DB hit from the critical path.

### H4. Spot page does **two** sequential DB queries before streaming, and the forecast is then re-fetched client-side
**File:** `app/spots/[slug]/page.tsx:42` (generateMetadata `findUnique`), `:58` (page `findUnique`), `:65` (`findMany` nearby). Plus `SpotForecastView` then calls `/api/forecast/[slug]` from the client (`:93`), which does its *own* `findUnique` (`forecast/route.ts:19`).

So loading one spot page costs: `findUnique` (metadata) + `findUnique` (page) + `findMany` (nearby) on the server, then a client round-trip to `/api/forecast` which does **another** `findUnique` + the full external fan-out. The same spot row is fetched up to 4 times.

**Fix:**
- `generateMetadata` and the page both `findUnique` the same slug — Next 16 dedupes `fetch` but **not** Prisma calls. Wrap the spot lookup in React `cache()` so both share one query.
- Consider passing the already-loaded spot's coordinates to the forecast (or fetching the forecast server-side in the RSC and hydrating React Query) to drop the redundant `findUnique` in the API route and remove a client waterfall. **Expected impact:** fewer DB round-trips and faster first forecast paint.

### H5. The forecast/best-spots routes have no Redis stampede protection — cold cache = full fan-out per concurrent request
**Files:** `lib/api/open-meteo.ts:14-38` (`withCache`), `forecast/route.ts:25-31`

The runtime-cache `withCache` is read-through with no locking. When a popular spot's cache expires, every concurrent request misses and independently runs the Open-Meteo primary (20s) + long-range (15s) fetches (`open-meteo.ts:237-240`). With `revalidate=3600` on the route segment this is mitigated for *page* traffic, but `/api/forecast` is hit directly by the client query, and the segment `revalidate` + per-URL edge cache is the only stampede guard — the underlying Open-Meteo calls have none.

**Fix:** Acceptable as-is given the edge/segment cache, but for the direct API hits consider `stale-while-revalidate` semantics in the runtime cache (serve stale, refresh in background) or a short lock key. **Expected impact:** smooths cache-expiry latency spikes; lower priority than C1/C2.

---

## MEDIUM

### M1. Per-request work in `/api/spots` conditions path: nearest-neighbour fallback is O(spots × withData)
**File:** `app/api/spots/route.ts:145-166`

For every spot lacking data, it scans all spots that *have* data to find the closest (`Math.hypot` over the whole list). With ~1,490 spots and a partial timeout, this is up to ~1,490 × ~1,490 = ~2M distance computations on the request thread. Usually small (few fallbacks), but pathological when Open-Meteo is flaky.

**Fix:** Cap the fallback (e.g. only fill spots in the current viewport, or precompute a spatial grid). Or skip fallback entirely and let the client show "no data" pins. **Expected impact:** avoids worst-case main-thread stall when Open-Meteo degrades; minor otherwise.

### M2. Tide chart fetches 17 days of **hourly** predictions, then detects extremes server-side
**File:** `lib/api/noaa-tides.ts:48-85`

`interval: 'h'` over 17 days = ~408 points per spot, returned in the forecast payload and charted. Combined with 16-day hourly marine + wind, the `/api/forecast` JSON is large (multiple hundred KB). Fine, but it's transferred to every client and held in React Query.

**Fix:** Request NOAA's `hilo` product for extremes plus a coarser curve, or downsample server-side before returning. **Expected impact:** reduces forecast payload size and client parse cost.

### M3. `/api/spots/meta` (regions page) does two `distinct` table scans, cached only 1h
**File:** `app/api/spots/meta/route.ts` — `findMany distinct` over country and region. The regions page (`regions/page.tsx:138-149`) calls it on mount and per country selection. `revalidate=3600` is fine, but these distinct scans over the full spot table are unindexed-distinct.

**Fix:** This data is essentially static (spots don't change at runtime). Bump `revalidate` to a day, or precompute the country/region lists into a constant (you already have `lib/region-hierarchy.ts`). **Expected impact:** removes DB scans from region browsing.

### M4. Webcams route fans out to 3 external APIs (Windy, OSM/Overpass, YouTube) per spot
**File:** `app/api/webcams/[slug]/route.ts:27-31`

Parallelized correctly via `Promise.allSettled` (good), `revalidate=21600` (good). OSM Overpass and YouTube scraping can be slow; `maxDuration=20`. This is lazy-loaded (`WindyWebcamsPanel` is below the fold), so it's not on the critical path — acceptable. But the client query fires on mount, competing with the forecast fetch.

**Fix (optional):** Gate the webcam/water-quality/surf-report queries behind an IntersectionObserver so they don't fire on initial spot-page hydration. **Expected impact:** less network/CPU contention with the forecast fetch on spot pages.

### M5. Webcam images use raw `<img>`, not `next/image`
**Files:** `components/webcam/WindyWebcamsPanel.tsx:148`, `components/webcam/WebcamPanel.tsx:25`

Raw `<img src>` for webcam previews — no width/height (layout shift), no guaranteed lazy loading. These are below the fold so not LCP, but adding `loading="lazy"` + explicit dimensions avoids CLS. Don't route external webcam URLs through `next/image` optimizer (cost), but `loading="lazy"` is free.

**Fix:** Add `loading="lazy"` and explicit dimensions. **Expected impact:** eliminates layout shift (CLS) from late-loading webcam images.

---

## LOW / observations

- **L1. Runtime choice:** All routes default to Node runtime (correct — Prisma + `@vercel/functions` `getCache` need Node). No misuse of Edge. `maxDuration` values are reasonable (60s forecast, 20s webcams). Good.
- **L2. External fan-out is well-parallelized** where it matters: `forecast/route.ts:25` uses `Promise.allSettled` across marine/wind/tides/buoy/coastalWind; `open-meteo.ts:237` parallelizes primary + long-range models; webcams parallel. No serial-await waterfalls in the API layer.
- **L3. Timeouts/fallbacks are thorough** — `AbortSignal.timeout` on every external fetch, graceful `null`/`[]` fallbacks, best-effort wind. Good resilience hygiene.
- **L4. Leaflet/markercluster is correctly `dynamic({ ssr:false })`** in both `LiveMapHero.tsx:19` and `spots/page.tsx:26`, and the cluster rebuild is throttled via the `clusterVersion` FNV hash (`SpotMap.tsx:502-511`) to avoid rebuilding 1,490 markers on every wave-height drift. Well done.
- **L5. `SpotForecastView` is a 660-line monolithic `'use client'`** that pulls in ~20 child components + recharts + date-fns. Beyond H1's code-splitting, breaking the below-the-fold sections (hourly table, community reports, season calendar, water quality) into separately-loaded chunks would shrink the spot page's hydration cost. Medium effort.
- **L6. `date-fns` imported piecemeal** (`format, parseISO`) across many components — covered by the `optimizePackageImports` change in H1.
- **L7. CSP allows `'unsafe-inline'` scripts** (`next.config.ts:16`) — not a perf issue, security note only.
- **L8. No `images` config block** in `next.config.ts`; `next/image` is only used in Navbar (logo). Fine.

---

## Summary table

| # | Sev | File:line | Problem | Fix | Impact |
|---|-----|-----------|---------|-----|--------|
| C1 | CRIT | `LiveMapHero.tsx:44`, `spots/route.ts:7,82` | Home map fans out to ~120 Open-Meteo buckets, uncached | Remove `force-dynamic`, edge-cache enriched payload | Eliminates 10-15s per-visitor fan-out |
| C2 | CRIT | `spots/route.ts:7` | `force-dynamic` kills the `Cache-Control` already set | Delete `force-dynamic` | ~10× TTFB drop on `/spots`,`/`,`/compare` |
| H1 | HIGH | `SpotForecastView.tsx:9-13`, `WaveChart.tsx:4` | recharts eagerly bundled, 4 charts | `optimizePackageImports` + dynamic-import charts | Big spot-page JS cut |
| H2 | HIGH | `Providers.tsx:17` | `refetchOnWindowFocus` re-runs heavy fan-out on tab focus | Set `false` | Removes redundant refetches |
| H3 | HIGH | `page.tsx:5` | Uncached DB `count()` on every home hit | ISR / `'use cache'` / hardcode | Home becomes static |
| H4 | HIGH | `spots/[slug]/page.tsx:42,58,65` + `forecast/route.ts:19` | Same spot `findUnique`'d up to 4×; client waterfall | React `cache()`, hydrate forecast server-side | Fewer DB hits, faster paint |
| H5 | HIGH | `open-meteo.ts:14` | No stampede protection on cold cache | SWR/lock in runtime cache | Smooths cache-expiry spikes |
| M1 | MED | `spots/route.ts:145` | O(n²) nearest-neighbour fallback | Cap/grid the fallback | Avoids worst-case main-thread stall |
| M2 | MED | `noaa-tides.ts:48` | 17-day hourly tides bloat forecast payload | Downsample / `hilo` product | Smaller payload |
| M3 | MED | `spots/meta/route.ts` | distinct scans for static data | Longer TTL / region-hierarchy constant | Removes DB scans |
| M4 | MED | `webcams/[slug]/route.ts` + panels | below-fold fetches compete with forecast | IntersectionObserver gate | Less contention |
| M5 | MED | webcam panels | raw `<img>`, layout shift | `loading="lazy"` + dimensions | No CLS |

---

The architecture's external-API layer (parallelization, timeouts, runtime caching) is genuinely solid. The performance problem is concentrated in **rendering strategy**: two `force-dynamic` routes plus `refetchOnWindowFocus` plus an uncached home `count()` mean the heaviest payloads (all-spots-with-conditions, forecasts) are recomputed far more often than the data changes. Fixing C1/C2/H2/H3 alone should produce the "it runs faster" goal, and H1 addresses the client-bundle side.
