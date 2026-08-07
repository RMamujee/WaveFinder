# WaveFinder — Claude Code project notes

Free Surfline-style surf forecast app. Next.js 16 App Router, Prisma 5 +
Supabase Postgres (`wavefinder` schema), better-auth, Stripe (TEST mode),
Upstash Redis, deployed on Vercel at https://wave-finder.vercel.app.

## Current state & open work

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

## Things that will bite you

- **Deploy via `git push` to main** (Vercel auto-deploys). Do NOT use
  `vercel --prod` from this machine.
- **The Vercel build needs `DATABASE_URL`**: all 1,490 spot pages prerender at
  build (`app/spots/[slug]/page.tsx` — `dynamicParams=false` gives real 404s
  for unknown slugs; on-demand ISR cached soft-404 200s, see the 2026-06-09
  audit). Local builds without `DATABASE_URL` skip the prerender by design.
- **`npm run db:reset` force-resets the database** — never run it against prod.
- **Only `/api/best-spots` is Pro-gated — by design.** Forecast/surf-reports/
  water-quality/alerts are intentionally free per the pricing page.
  Do not "fix" this as a paywall hole. (Webcams were removed entirely 2026-07-15
  at the user's request — quality was poor. `webcamUrl`/`webcamType` still exist
  in the spot dataset/DB as dead data; `WINDY_WEBCAM_API_KEY`/`YOUTUBE_API_KEY`
  env vars are no longer read.)
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

## Before real customers (Stripe is in TEST mode)

Live price IDs + live webhook endpoint/secret + `sk_live_` key, enforce email
verification first (needs `RESEND_API_KEY`, `requireEmailVerification: true`,
gate checkout on `emailVerified`). Details in the 2026-06-09 audit + RUNBOOK.
