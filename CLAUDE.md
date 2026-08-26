# WaveFinder — Claude Code project notes

Free Surfline-style surf forecast app. Next.js 16 App Router, Prisma 5 +
Supabase Postgres (`wavefinder` schema), free with no accounts (better-auth and
Stripe remain wired but dormant — see below),
Upstash Redis, deployed on Vercel at https://wave-finder.vercel.app.

## Current state & open work

- **2026-08-21 hardening pass** (security + bug audit, 7 commits): the dormant
  auth/billing/stripe routes now 404 unless `ENABLE_ACCOUNTS=true` (they were
  fully live and accepting unauthenticated DB writes; signup logged a live
  verification URL — both fixed). Conditions requests to `/api/spots` have a
  hard 200-bucket ceiling. Over it the request is SAMPLED, not refused
  (2026-08-22 — refusing greyed the whole map the moment anyone zoomed out):
  `planConditionsOverview` in `lib/spots/static-store.ts` groups spots into
  nested coarse cells (0.05° × 2^L, up to 6.4° for the whole world = 162
  representatives), fetches one representative per cell, scores every spot
  against its cell's reading and flags it `approx` (the map popup says
  "Regional estimate"). Coarser levels are subsets of finer ones, so zooming
  out re-reads cached buckets instead of fanning out per level. Map buckets
  cache for 30 min (`CONDITIONS_TTL_SECONDS`, was 5 — the spot page they must
  agree with caches for 60). The `/spots` list view is paginated (48/page) and
  fetches conditions via `ids=` instead of the unscoped sweep it used to fire.
  Missing wind is now null end-to-end (`WindData.speed`, `SurfRatingInput`,
  `factors.wind`) and a failed wind fetch THROWS instead of caching an empty
  structure over the 24 h last-known-good copy. `next` is 16.3.2; the postcss
  override is 8.5.23 (8.5.10 carried three high file-read advisories).
  CoastalAlertsPanel (official NWS warnings) is mounted. SolarPanel is
  mounted as of 2026-08-22: the forecast payload now carries the spot's IANA
  `timezone` (from Open-Meteo) beside `utcOffsetSeconds`, and
  `lib/forecast/local-time.ts` formats instants in it — zone → offset → null,
  NEVER the viewer's clock (StormAlerts had the same bug; same helper). The
  home hero reads `/api/spots?markers=true` (no `country`/`slug`; `slug` is
  `id`); below-fold spot panels are `next/dynamic` with SSR on.

- **Latest audit (read this first):** `docs/audit/05-post-deploy-audit-2026-06-09.md`
  — post-deploy audit with the prioritized open-work list. Done since
  (2026-06-09, second pass): Prisma migrations baselined (`0_init` marked
  applied in prod; `migrate deploy` runs in the Vercel build — use
  `npm run migrate:dev` for schema changes now, NOT `db push`), the two
  `proxy.ts` rate-limit HIGHs fixed (platform IP only + per-bucket keys),
  `/api/health` now pings Redis, CI gates `next build` + lint warnings.
  Third pass (same day): static-spots refactor landed — all spot reads come
  from `lib/spots/static-store.ts` (in-memory; spot `id` === slug now);
  `/api/spots?ids=` still resolves legacy cuids via DB (telemetry:
  `spots.ids.cuid_resolved`; retire the bridge + SurfSpot table once it reads
  ~0). Session/Verification cleanup cron live (`/api/cron/cleanup`, daily);
  uptime monitor = GitHub Actions `uptime.yml`; `db:reset` refuses non-local
  DBs. NOTE: `CRON_SECRET` in Vercel prod was regenerated 2026-06-09 (old one
  had whitespace and failed every deploy after crons were added to
  vercel.json).
  Still open: set `SENTRY_DSN` in Vercel prod (blocked: needs a Sentry
  project), email verification, Stripe go-live, CSP nonce.
- Earlier audits: `docs/audit/00-AUDIT-SUMMARY.md` (2026-06-05) + per-area
  reports. Ops runbook: `docs/RUNBOOK.md`.

## The surf rating engine (`lib/forecast/rating.ts`)

Rewritten 2026-08-04. Read this before tuning scores — the constants are
deliberate and the tests pin the intended behaviour.

- **Score the swell partition, not the combined sea.** Open-Meteo's
  `wave_height` folds groundswell and local wind chop into one number. The old
  engine scored it (and accepted a `swellHeight` argument it never read), so
  0.4 m of clean swell under 1.1 m of onshore slop rated the same as a 1.5 m
  groundswell day.
- **Both swell trains, blended by breaking energy** (2026-08-07). Open-Meteo
  ranks partitions by HEIGHT, so the longer-period (more surfable) train is
  frequently `secondary_swell_wave_*` — which used to be neither requested nor
  scored. Each train is shoaled by its own period and reduced by its own angle;
  `faceHeight` is their quadrature sum. Period/direction are blended weighted by
  each train's breaking energy, NOT taken from whichever train is "dominant" —
  rank flips between near-equal trains produced a 6.7-11.9 s period spread
  across 16 adjacent spots in one uniform swell. `combinedSwell` in the result
  is what callers must DISPLAY; showing the model's primary partition beside a
  score computed from both is the same class of bug.
- **Period thresholds are for a MEAN period.** `swell_wave_period` is Tm, not
  Tp (Tm ≈ 0.8-0.85·Tp), so the buckets are shifted ~15% down from the
  peak-period language they were written in (16→13.5, 14→12, …) and
  interpolated. `swell_wave_peak_period` exists but returns null on best_match.
- **Tide is scored in metres of water, not rank within the day's range.** A
  reef sits at a fixed depth below datum, so it needs an absolute amount of
  water over it — rank-scoring made "ideal reef tide" mean 1.31 m at one station
  and 2.72 m at another. Rising/falling is a small ±4 nudge, deliberately not a
  decider. Below 0.5 m of range the factor goes neutral.
- **Cleanliness is an energy (quadrature) share of the EXPOSURE-REDUCED swell.**
  A linear height ratio over-penalised modest chop and let genuine
  victory-at-sea escape the veto; using the raw partition rated off-axis spots
  "clean" when their actual sea surface is windsea.
- **The height curve and the size caps are read against `faceHeight / difficulty
  scale`** (beginner 0.55, intermediate 1, advanced 1.5). One universal curve
  had a beginner beach break and Nazaré sharing a 2.5-3.5 m sweet spot.
- **The size caps ramp, they do not step.** Control points are the old step's
  values at the sizes where it changed, so every boundary judgement is preserved
  and only the cliffs are gone (8 cm of face across 1.6 m used to be 20 points).
  `npx tsx scripts/rating-sanity.ts` verdicts are unchanged by this.
- **Gusts are scored, not just displayed** (2026-08-07). A measured gust above
  the mean speed is blended into the speed the engine scores (`GUST_WEIGHT`
  0.4) — 12 km/h gusting 35 no longer rates like 12 km/h steady. Only a
  *measured* gust counts: `merge.ts` passes null when the weather API had no
  entry, because the displayed gust is then a `speed × 1.25` stand-in and
  feeding it back would invent a penalty from a missing reading.
- **`computeWavePower` takes PARTITIONS, not a height and a period.** Energy is
  additive across partitions but period is not; charging the whole sea at the
  groundswell's period overstated mixed seas by 1.79-2.0×. This number drives
  the gear recommendations and the "high energy" label, so it is not cosmetic.
  A buoy report is legitimately a single partition (its own WVHT/DPD pair).
- **UV is `12.5 · sin(elevation)^2.42`, attenuated by cloud.** The old
  `11 · sin(noonElev)^0.25 · sin(elev)^0.6` had far too shallow an exponent and
  only agreed with reality near where it was eyeballed — LA winter noon read
  6.5 against an actual 2.7. Cloud uses `1 − 0.56·C^3.4`: UV is much less
  cloud-sensitive than visible light, so broken cloud barely matters and full
  overcast removes just over half. Needs `cloud_cover` from the wind fetch.
- **Day aggregates are taken over surfable hours** (06:00–18:00), falling back
  to all hours when a partial day has no daylight. `dominantRating` already
  did; `maxFaceHeight`, `maxWaveHeight` and `avgPeriod` did not, so a day's
  headline size could be reported from 03:00.
- **NDBC observations feed the rating** (`MergeContext.buoy`), not just the
  display: the model's swell period/direction is blended toward the buoy for the
  hours the observation describes (max weight 0.6, fading to 0 over 6 h, ignored
  entirely if older than 3 h or if the sensor reported MM). Mean |period gap|
  against sampled buoys was 4.0 s.
- **`faceHeight` is the surfable size**, not `waveHeight`. It is the swell
  partition shoaled by period via Komar & Gaughan (1972) and reduced by
  directional exposure. `SHOALING_CALIBRATION` (0.85) pulls the textbook formula
  back in line with how surfers call size — tune there, not in the curve.
- **Direction is a multiplier on height, not a small additive score.** A spot
  facing 90°+ away from the swell drops to `WRAP_FLOOR` (0.12) rather than
  scoring "good" on size alone.
- **Weights renormalise over the factors present.** Tide and cleanliness drop
  out when unavailable (no NOAA station, no wind-wave partition), so missing
  data is never scored as bad data. Do not "fix" this by defaulting them to 0.
- **Veto caps exist because a weighted mean hides catastrophes.** A 4.5 m swell
  under 40 km/h onshore averaged out to "good" before them. Wind and chop can
  each cap the final score regardless of size and period.
- **Wind direction is speed-gated and continuous** (2026-08-05): the direction
  penalty fades in over 5→20 km/h (`gate`) because wind damage scales with
  speed — a 6 km/h onshore drift is near-glassy, and the old buckets vetoed it
  exactly like a 30 km/h gale. >45 km/h is capped regardless of direction.
  Do not reintroduce stepped direction buckets; 2° of model noise used to move
  the rating two bands.
- **Preserve nulls end-to-end.** The engine scores unknown swell direction,
  unknown wind direction, and missing wind-wave/tide data neutrally — but only
  if callers pass `null`, never `?? 0`. A 0 is scored as a real due-north
  swell / perfectly clean sea. `fetchCurrentConditions` returns null for
  land/invalid cells so the map's nearest-neighbour fallback fires; hours where
  both wave and swell height are null are dropped in `mergeForecastData`, not
  emitted as fake flat.
- **Open-Meteo time strings are the spot's LOCAL clock with no offset.** Never
  `new Date(t)` them (Vercel runs UTC — the map's current hour was off by each
  spot's entire UTC offset, invisible in local dev). Shift `Date.now()` by
  `utc_offset_seconds` and compare strings, truncated to the hour so the
  in-progress hour wins. See `findNearestFutureHour` + `pickHourIndex`.
- `scoreFaceHeight` interpolates a curve rather than stepping buckets — step
  buckets erased the off-axis penalty whenever both sizes fell in one bucket.
- Sanity-check tuning changes with `npx tsx scripts/rating-sanity.ts`, which
  prints the verdict on ten hand-described sea states.
- Ratings feed `/api/forecast/[slug]`, `/api/spots?withConditions=true` and
  `/api/best-spots`. Only the forecast route has tide data; the other two pass
  no tide and let the weights renormalise.

## Open-Meteo current conditions (`lib/api/open-meteo.ts`)

- **Fetch coordinates in batches, not one at a time.** Open-Meteo takes
  comma-separated `latitude`/`longitude` lists (and a matching `timezone` list)
  and answers with a JSON array in request order.
  `fetchCurrentConditionsBatch` groups cache misses into chunks of
  `BATCH_COORDS` (50), so the map's ~130 coordinate buckets cost 3 round trips
  rather than ~130. `fetchCurrentConditions` is a one-point wrapper over it.
- **A short or reordered response is discarded, not zipped.** If the entry
  count doesn't match the request, every spot in that chunk returns null and
  falls back — handing a spot its neighbour's surf is worse than showing none.
- **Only definitive outcomes are cached.** A no-data cell (model returned null
  wave height — land/invalid grid point) caches the `{noData:true}` sentinel so
  it stops being re-requested; a transient chunk failure caches nothing so it
  retries. Don't collapse the two.
- Parsing lives in `parseCurrentConditions`, which is pure and unit-tested —
  Open-Meteo is unreachable from some networks, so keep the network layer thin
  and the logic testable with fixtures.
- **Conditions buckets are 0.05°, and the representative coordinate comes from
  the full dataset** (`conditionsBucketKey` / `conditionsBucketPoint` in
  `lib/spots/static-store.ts`). At 0.1° 29.5% of spots were served a
  neighbour's reading up to 11.3 km away, while Open-Meteo's marine grid is
  ~0.04° — the resolution was being discarded, not unavailable. 0.05° halves
  that (19.8%, max 5.5 km) for 3 extra parallel chunks. Going finer than the
  upstream grid buys nothing. Resolving the representative against the full
  dataset is what stops a `difficulty=` filter changing which coordinate is
  queried (and cached) for 229 spots.
- **`?withConditions=true` returns a marker projection, not full spot records.**
  It carries only what the map and its popups read. `/spots` merges it onto the
  full list it already has; the home map renders from it directly, so anything
  a popup needs must be added there too. Dropping `description` and the
  webcam/NOAA-station ids cut the US payload 384 KB → 226 KB.

## Spot data is generated, not hand-authored (2026-08-07)

Three fields are now derived by script and pinned by `tests/spots-seed.test.ts`.
Hand-editing them puts the seed and the script out of sync and the test fails.

- **Tide stations: `npx tsx scripts/map-tide-stations.ts`.** Nearest CO-OPS
  **reference (type R)** station within 75 km, null beyond. The type filter is
  the whole point: two thirds of CO-OPS's published tide-prediction stations are
  *subordinate*, they are frequently the closest one to a spot, and they cannot
  answer the hourly MLLW query `fetchTidePredictions` sends — they return
  `{"error":"No Predictions data was found"}`, which the fetch turns into an
  empty array. That is a silent, permanent blank tide chart, and it is exactly
  how `yakutat-surf-ak` pointed at a non-existent station 9453380 unnoticed.
  `--verify` probes every assigned station against the live API. The station
  snapshot in `scripts/data/noaa-tide-stations.json` is refreshed with
  `--refresh`; it is script/test-only and must not be imported by app code.
- **Harmonic tide stations: `npx tsx scripts/map-harmonic-stations.ts --write`.**
  CO-OPS is US-only, so 887 of 1,482 spots had no tide at all — blank chart, and
  `scoreTide` renormalised itself away, meaning international spots were rated
  on strictly fewer factors than Californian ones. This assigns each spot a
  harmonic-constituent station from `@neaps/tide-database` (6,115 stations, 126
  countries) within 100 km; `lib/api/harmonic-tides.ts` turns the constituents
  into the same `TidePoint[]` the NOAA path returns, with **zero network calls**
  (~20 ms of arithmetic for the whole 17-day window).
  - **`@neaps/tide-database` is a devDependency and must never be imported by
    app code** (58 MB). Only the generated
    `lib/tides/data/harmonic-stations.json` and `@neaps/tide-predictor` (MIT,
    zero deps) are importable at runtime — same rule as
    `scripts/data/noaa-tide-stations.json`.
  - **Nearest-by-distance is not safe on its own, and the guard is the point of
    the script.** TICON-4 includes river, slough and canal gauges, and they are
    frequently the closest station to a surf break. Measured against live CO-OPS
    over 595 US spots, **31% of distance-only assignments were wrong**:
    `goleta_slough` for Refugio and El Capitan, `watsonville_slough` for Pleasure
    Point, `manasquan_river` (5× the real amplitude) for Manasquan Inlet,
    `bethany_beach_canal` 0 km away carrying 17% of the real range, and a USGS
    river gauge at the Santa Margarita mouth serving Trestles and San Onofre
    0.805 m out of datum at r = 0.99. Every one looks perfectly plausible.
  - **Two referees, whichever is stronger for the spot.** US spots are checked
    against live CO-OPS predictions (ground truth: phase r ≥ 0.8, amplitude
    ratio 0.6–1.6, **and** RMSE ≤ 0.35 m, which is the only test that catches a
    pure datum shift). Everything else is checked against Open-Meteo
    `sea_level_height_msl`, which matters because it is a Copernicus ocean model
    rather than a tide gauge and so can tell that a gauge is in the wrong body of
    water. Both halves of phase-and-amplitude are required —
    `radhanagar-havelock-andaman` correlates at r = 0.96 while carrying 42% of
    the real amplitude.
  - **A downed referee aborts the run; it never writes.** "Everything failed the
    check" and "the check could not run" both produce an empty table, and
    writing that would read as a legitimate result. `GateUnavailableError` exits
    2 and leaves the previous table alone. Relatedly, `lib/tides/stations.ts`
    returns null for every lookup when `guard` is null in the JSON, so a
    `--skip-guard` table is inert rather than quietly serving wrong tides.
  - **CO-OPS throttles on a short rolling window** and says so only as a bare
    `{"message":"Forbidden"}` — no 429, no `Retry-After`. The gate fetches each
    distinct station once (595 spots share ~200 gauges), runs 2-wide with a
    400 ms pause, and backs off 15/45/90 s on a throttle. Don't raise the
    concurrency; a few hundred rapid calls earns a block lasting minutes.
  - **Open-Meteo is firewalled on some networks**, so the international gate
    cannot run everywhere. `--us-only` deliberately generates a US-only table;
    re-run without it from a network that can reach
    `marine-api.open-meteo.com` to add the rest of the world.
  - An offline substitute for the guard (inland-sounding station name, USGS
    source, or a tidal range anomalous against neighbouring stations) was built
    and **measured against the CO-OPS ground truth: 74% recall, 40% precision,
    and it discarded 23% of good assignments.** It is not a usable stand-in for
    a real referee — don't reintroduce it.
- **`bottomType`: `npx tsx scripts/backfill-bottom-type.ts`.** A stored seed
  field now, not a regex run against the description on every request (which
  meant editing marketing copy silently re-rated the spot). The store reads
  `s.bottomType` directly. `inferBottomType` survives only to classify newly
  added spots and the transitional Postgres-cuid rows.
- **Coordinates: `npx tsx scripts/check-spot-coordinates.ts`.** Confirms every
  spot resolves to a live Open-Meteo marine cell — a land cell renders
  permanently flat. Paced: Open-Meteo bills a multi-location request **per
  location**, so the full sweep is ~1,500 calls against a ~600/minute budget,
  and the rate limiter answers HTTP 200 with an error body that looks exactly
  like a land cell if you don't check for it.

Duplicate spots were merged; the retired slugs live in `lib/spots/spot-aliases.ts`
and resolve through `getSpotBySlug`, the `ids=` filter, and a next.config
redirect. Deleting a slug outright would hard-404 (`dynamicParams=false`) and
silently drop the spot from saved-spots localStorage.

`difficulty` includes **`expert`** (44 spots — Nazaré, Mullaghmore, Dungeons).
It was missing from the enum and coerced to `intermediate`, which is a safety
label, not a cosmetic one. Adding a difficulty means touching the enum in
`types/spot.ts`, both `VALID_DIFFICULTIES` sets, `DIFFICULTY_SCALE` in
`rating.ts`, the two `DIFFICULTY_STYLES` maps, `DIFFICULTY_COLOR`, `IDEAL`, and
the `/spots` filter dropdown.

## Things that will bite you

- **Deploy via `git push` to main** (Vercel auto-deploys). Do NOT use
  `vercel --prod` from this machine.
- **The Vercel build needs `DATABASE_URL`**: all 1,490 spot pages prerender at
  build (`app/spots/[slug]/page.tsx` — `dynamicParams=false` gives real 404s
  for unknown slugs; on-demand ISR cached soft-404 200s, see the 2026-06-09
  audit). Local builds without `DATABASE_URL` skip the prerender by design.
- **`npm run db:reset` force-resets the database** — never run it against prod.
- **The app is free and account-free (2026-08-07). Nothing is gated — do not
  re-introduce a gate.** `/api/best-spots` used to call `requireProAccess()`;
  that is gone, and `tests/best-spots-route.test.ts` fails if it returns. The
  sign-in/sign-up/pricing pages and `components/billing/*` are deleted.
  `lib/auth.ts`, `lib/auth-client.ts`, `lib/session.ts`, `lib/stripe.ts`,
  `lib/entitlements.ts`, `/api/auth/*`, `/api/billing/*`, `/api/stripe/webhook`
  and `/api/account` are all still present but **unreferenced by any UI**, and
  the `User`/`Session`/`Account`/`Verification` tables are deliberately kept so
  existing signups are not destroyed. Leaving that code dormant was a decision,
  not an oversight; delete it only if asked. (Webcams were removed entirely
  2026-07-15 at the user's request — quality was poor. `webcamUrl`/`webcamType`
  still exist in the spot dataset/DB as dead data;
  `WINDY_WEBCAM_API_KEY`/`YOUTUBE_API_KEY` env vars are no longer read.)
- Spot data is a static dataset (`lib/spots-data.ts` + `lib/spots/*`, ~1,490
  spots) seeded into Postgres; the DB cuid `id` keys saved-spots localStorage,
  so don't swap id sources.
- Fonts are self-hosted via `next/font` (CSP has no Google Fonts origins).
- `docs/deployment.md` is partially stale — trust the code. (README.md and
  WAVEFINDER_PROJECT.md were reconciled with the code on 2026-06-09.)

## Verify before claiming done

`npm run typecheck` · `npm run lint` · `npm test` (vitest) · `npm run build`.
CI runs lint (zero-warnings) + typecheck + test + `next build` (build job has
no `DATABASE_URL`, so the spot prerender is skipped there by design).

## Billing is retired (was Stripe TEST mode)

The app went free and account-free on 2026-08-07, so there is no checkout to
take live. The Stripe wiring still exists, dormant and unreferenced — if paid
plans ever come back it needs live price IDs, a live webhook endpoint/secret
and an `sk_live_` key, and email verification enforced first (`RESEND_API_KEY`,
`requireEmailVerification: true`, checkout gated on `emailVerified`). Details in
the 2026-06-09 audit + RUNBOOK, both of which predate the change.
