# Post-Deploy Audit — 2026-06-09

Audit taken immediately after the perf pass (PR #3 + lint fix, deployed to prod).
Three review lanes (security, change-regression review, perf/ops gaps) plus live
production probing of https://wave-finder.vercel.app.

## Production measurements (after deploy)

| Probe | Result |
|---|---|
| `/` (static) | TTFB ~160–190 ms, fonts self-hosted (3 same-origin woff2, zero Google Fonts refs) |
| `/spots/[slug]` (ISR) | TTFB ~95–130 ms, `X-Nextjs-Prerender: 1`, edge `HIT` |
| `/api/spots?slim=true` | ~335 ms cold → edge `HIT` after |
| `/api/spots?withConditions=true` | 10.1 s cold fill (post-deploy, expected) → **282 ms warm** |
| `/api/spots/meta` | ~965 ms cold (day-cached after) |
| `/api/health` | ok, db connected |
| `/api/best-spots` logged out | 401 (paywall intact) |
| CI on main | green (merge commit briefly red on lint; fixed by 40de8ba) |
| `npm audit` | 0 vulnerabilities |

## Regressions found in the perf pass (fixed same day, this branch)

1. **Cached soft-404s (HIGH, found by prod probing):** unknown spot slugs
   (`/spots/zzz-not-a-spot`) returned **HTTP 200** with not-found UI, ISR-cached at
   the edge (`X-Nextjs-Prerender: 1`, `HIT`). Bad for SEO (soft-404) and wrong.
   Fix: throw `notFound()` in `generateMetadata` (resolves before the response
   begins) in `app/spots/[slug]/page.tsx`.
2. **Spatial-grid boundary case (MEDIUM, change review):** `findNearestInIndex`
   stopped at the first populated ring, so a spot ~2 km away across a 1° cell
   boundary lost to one ~110 km away in the same cell. Fix: widen by one ring
   before taking the minimum (`lib/forecast/nearest-fallback.ts`) + regression test.
3. **LOW UX:** "Live conditions" chip showed steady state when the spot list is
   empty (gate on data presence); satellite-map LazyMount placeholder 260 px vs
   map floor 280 px (20 px shift on reveal); stale "via Google Fonts" line in
   WAVEFINDER_PROJECT.md.

## Security posture (no criticals; hardening from PR #2 holds)

**HIGH — fix soon (`proxy.ts`):**
- **Rate-limit key trusts spoofable headers as fallback** (`proxy.ts:45-52`):
  falls back from `ipAddress(req)` to client-settable `x-forwarded-for` /
  `x-real-ip`. Fix: use only the platform IP, fail to a shared `'unknown'` bucket.
- **Unbounded key cardinality** (`proxy.ts:51`): key is `ip:pathname`, so varying
  the slug on `/api/forecast/[slug]` etc. yields a fresh bucket per request,
  bypassing per-route ceilings and amplifying upstream fan-out. Fix: key on the
  matched RATE_LIMITS pattern (bucket), not raw pathname.

**MEDIUM:** webhook idempotency fails open on Redis outage (entitlement logic
itself fails closed — add an alert on `idempotency_unavailable`); price-mismatch
path writes `stripeSubscriptionStatus='inactive'` for an active sub (confirm
intended); `/api/debug/conditions` is a user-driven outbound fetch behind
`ENABLE_DEBUG_API` (confirm unset in prod; delete before GA); unverified emails
can reach checkout (enforce verification before Stripe live — see go-live list);
better-auth's own rate limit may be per-instance memory in serverless (confirm
adapter persistence).

**LOW:** CSP `script-src 'unsafe-inline'` (no nonce; no current XSS sinks found);
deprecated `X-XSS-Protection: 1` (set `0`); `forecast` route leaks `detail:
String(mergeErr)` to clients (log-only instead); in-memory limiter fallback is
per-instance (ensure Upstash envs always set in prod).

**Verified clean:** no hardcoded secrets (repo + git history), no SQL injection
surface (Prisma only, no raw SQL), no XSS sinks, inputs validated on all routes,
no `NEXT_PUBLIC_` leakage, **no cached route reads cookies/session** (the perf
pass introduced no cache/paywall regression), webhook signature + customer-match
+ price validation solid, deps 0 CVEs.

Note: forecast/surf-reports/water-quality/webcams/alerts being un-gated is the
**intended pricing model** (only `/api/best-spots` is Pro), not a paywall gap.

## Remaining perf gaps (none urgent)

- **H4 remainder:** forecast still client-fetched after hydration and
  `/api/forecast` re-does its own `findUnique` (~1/spot/hour after edge cache).
  Fold into the static-spots refactor below.
- **Static-spots refactor (biggest remaining win, effort L):** ~1,490 immutable
  spots still round-trip Postgres on every spot/list/forecast read. An O(1)
  in-memory map from `SURF_SPOTS_SEED` would cut latency and decouple forecast
  uptime from Neon. Confirmed: the ~700 KB dataset is server-only (no client
  bundle leak).
- **`/api/spots/meta`** could serve country/region lists from
  `lib/region-hierarchy.ts` constants instead of day-cached DB distinct scans (S).
- **M2 tides:** 17-day hourly payload (~408 pts) still shipped per forecast;
  ~15 KB — consciously deprioritized.
- **P1 RSC conversion:** browse pages (`/spots`, `/compare`, `/regions`,
  `/timeline`) are 100% client; converting static shells to RSC would improve
  LCP/SEO. `/regions` is the easy first win (region list is already a constant).

## Ops gaps (priority order)

1. **DB migrations (CRITICAL):** no `prisma/migrations/` history; schema changes
   go out-of-band via `db push`; `db:reset --force-reset` script is one
   fat-finger from wiping prod. Baseline with `migrate dev` + `migrate resolve`,
   add `prisma migrate deploy` to the Vercel build.
2. **Sentry is a no-op without `SENTRY_DSN`** — wiring is correct; set the DSN in
   Vercel prod (and add to env-validation RECOMMENDED).
3. **No uptime monitoring** — nothing polls `/api/health`; health check omits
   Redis (a Redis outage silently weakens rate limiting). Add an external
   monitor + `redis.ping()` to the health payload.
4. **CI doesn't gate `next build`** or lint warnings (`--max-warnings=0`);
   build breaks surface only at Vercel deploy.
5. **Email verification** — enforce after provisioning Resend (see Stripe
   go-live: also gate checkout on `emailVerified`).
6. **Stripe go-live checklist:** live price IDs (test IDs silently fail
   `priceMatches` → Pro never granted), live webhook endpoint + signing secret,
   live `sk_live_` key, end-to-end live checkout test.
7. **Session/Verification cleanup cron** (rows accumulate; `expiresAt` indexed
   but never purged).
8. **Docs drift:** README still boilerplate; WAVEFINDER_PROJECT.md has an
   accuracy banner but still lists unimplemented routes; `lib/env.ts` doesn't
   validate the Stripe price IDs the app reads.

## Status of the 2026-06-05 audit items

Fixed: C1, C2, H1, H2, H3, M1, M3 (perf); pooling config, `@@index(country)`,
expiry indexes (db); SEC-02/04/05/06/07/08/11/12 (security); tests, CI,
global-error, route error handling, node pin, env validation (ops).
Partial: H4 (client waterfall remains), H5 (per-instance dedup added; rated
acceptable), M2 (open by choice), §4 SELECT-shape, CI gaps.
Open: migrations (§5), email verification (SEC-03), CSP inline (SEC-10),
uptime/Sentry DSN (ops §1).
