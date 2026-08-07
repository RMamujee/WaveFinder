# 06 — Forecast Accuracy Audit (2026-08-05)

Four parallel read-only audits of main @ `c70340c` (the day after the rating-engine
rewrite shipped), each with a different lens:

- **Physics** — the math in `lib/forecast/rating.ts` / `merge.ts` / `solar-uv.ts`, every
  number verified by executing the shipped functions.
- **Data pipeline** — Open-Meteo / NOAA ingestion, null handling, cache stacking; HIGH
  findings verified against **live production**.
- **Spot metadata** — the 1,490-spot static dataset the engine now multiplies against.
- **Freshness/consistency** — staleness budgets per surface and cross-surface disagreement.

Findings are merged, deduplicated, and re-ranked here by user-visible accuracy impact.
File:line references are against `c70340c`.

---

## Tier 1 — Broken in production right now (fix first)

### 1.1 Map "current conditions" reads the wrong hour — off by the spot's entire UTC offset
`lib/api/open-meteo.ts:183-185` — found independently by two audits, verified live.

`new Date(t) >= now` parses Open-Meteo's offset-less local-clock strings (`"2026-08-04T22:00"`)
in the **runtime's** zone. Vercel runs `TZ=UTC`, so every spot's local timestamps are
reinterpreted as UTC. `utc_offset_seconds` is in the response and never read.

- California (UTC-7) selects **+7 h ahead**; with `forecast_days: '1'` the lookup runs off the
  end of the local-day array and **pins to 23:00** — a Californian checking at 5 pm sees 11 pm
  conditions. Sydney selects 10 h **behind**.
- Live divergence at Huntington Beach Pier: map faceHeight **1.0 m @ 9.7 s** vs the same spot's
  page **0.67 m @ 6.7 s** — 49% apart, matching the 23:00 vs 22:00 rows of the raw API exactly.
- Invisible in local dev (dev machines run in local TZ) — that's why it survived.
- `findNearestFutureHour` (`merge.ts:192`) does this correctly; this path must mirror it.

**Fix:** offset `Date.now()` by `utc_offset_seconds`, compare local-clock strings
lexicographically; raise `forecast_days` to 2. Affects all 1,490 spots outside UTC.

### 1.2 The `?? 0` family — missing data scored as real readings
One root pattern, five distinct symptoms. The engine has explicit null-neutral branches
(`rating.ts:58` exposure=1, `rating.ts:122` speed-only wind) — the `?? 0` coercions upstream
make them **dead code** on the main paths. `best-spots/route.ts:163` (`?? null`) and
`spots/route.ts:172` (period fallback) are the reference implementations.

| Symptom | Where | Verified impact |
|---|---|---|
| Null marine cells → real "flat/poor", **and** `_needsFallback` never fires (`om !== null`) | `open-meteo.ts:187-193` → `spots/route.ts:166,204` | 3 spots live right now stuck flat: nexpa-michoacan, plage-blanche-morocco, punta-roquitas-lima |
| `swellDirection ?? 0` → scored as a real due-north swell → exposure collapses to 0.12 | `merge.ts:61`, `open-meteo.ts:191` | epic 92 → poor 29 on a 1.97 m face |
| `swellPeriod ?? 0` defeats the total-sea fallback → `breakingWaveHeight` returns 0 | `merge.ts:60`, `best-spots/route.ts:159` | face 2.02 m / 82 → face 0 / 29 while a 14 s total-sea period sits unused in the same row |
| `windWaveHeight ?? 0` → long-range hours scored **perfectly clean** (chopRatio 0 → 100) | `merge.ts:65` | identical hour: 75 "good" with real chop data vs 80 "epic" without — crosses a band because data is missing |
| Long-range double-null → fabricated 0 m / 0 s hours rated 'poor', averaged into day stats | `merge.ts:58-61,99-100` | live: 2026-08-19 at HB has 19/24 hours at 0; displayed avgPeriod 2.9 s |

**Fix:** preserve null end-to-end; return null from `fetchCurrentConditions` when the selected
hour is null (so fallback fires); exclude no-data hours from day aggregates; widen
`ForecastHour.swellDirection` to `number | null`.

### 1.3 A genuine calm is replaced by an invented onshore wind
`merge.ts:68` — `hasRealWind = rawWind.speed > 0` conflates "API gave nothing" with "dead
glassy". The fallback substitutes a Pierson-Moskowitz wind estimate **and swaps direction to
`wind_wave_direction`** (almost always onshore).

- Measured: model reports 0 km/h from 90° (offshore, glassy) → engine uses 13 km/h from 270°
  (onshore) → **29 "poor"**. The same hour at 1 km/h → **92 "epic"**. A 63-point swing on the
  single best condition a surf app exists to identify.
- Also fires for **every** hour when `fetchWindForecast` fails (returns empty arrays).

**Fix:** `hasRealWind = windMap.has(time)`; on true absence pass `windDirection: null` so the
speed-only branch (currently dead) is used as designed.

### 1.4 Wind veto cliff: 5 km/h of onshore drift rates like a 40 km/h gale
`rating.ts:117,130-137,301` — confirmed by physics audit after the data audit saw it dominate
every live probe.

- Direction buckets apply at **full strength** the instant speed reaches 5 km/h; ≥135° off-
  offshore → dirScore 10 → veto cap 29. Measured on a perfect 2.02 m face: **4.9 km/h onshore
  → 95 "epic"; 5.0 km/h → 29 "poor"**. A 0.1 km/h change moves three rating bands.
- **The swell cannot rescue it.** Sweeping swell under the live HB wind (6.2 km/h @ 277°):
  0.8 m @ 12 s → 29 · 1.4 m @ 15 s → 29 · 2.2 m @ 17 s → 29 · **3.5 m @ 18 s (15 ft faces,
  cleanliness 100) → 29 "poor"** — because of a breeze you'd call glassy from the sand.
- **The veto's reach is flat in speed** (full 8-speed × 24-direction sweep): 21% of the compass
  pins to "poor" at 5 km/h — and exactly the same 21% at 30 km/h. `scoreWind` has no notion
  that light wind is harmless, which is physically backwards: wind damage scales with speed;
  direction only sets its character. Below ~8–10 km/h neither direction materially textures
  the face.
- Compounding: direction is a 4-step function, so **2°** of model noise flips bands
  (224° → 62 "good"; 226° → 29 "poor" at 12 km/h).

**Fix (verified matrix in audit):** speed-gate a continuous direction curve —
`dirScore = 10 + 90·((1+cos diff)/2)^1.5`, then
`score = 100 − (100 − dirScore) · clamp((windSpeed−5)/15, 0, 1)`, plus `penalty = 70` above
45 km/h (closes the 90 km/h-offshore-rates-epic hole in the same edit). Under this shape the
HB cell scores 93 (near-glassy, correct), 15 km/h onshore still drops to 40, 25–30 km/h
onshore stays fully vetoed, and the existing 40 km/h-onshore regression test still passes.
The suite has **no test asserting light onshore wind is harmless** — that's why this shipped;
add one (1.4 m @ 15 s under 6 km/h onshore must not be "poor").

### 1.5 Conditions never refresh, while the UI claims "Live"
- `components/layout/Providers.tsx:17` sets `refetchOnWindowFocus: false`; repo-wide there is
  **zero** `refetchInterval` / `invalidateQueries` / `setInterval`. A tab opened at 6 am shows
  6 am ratings at noon — under a pulsing emerald **"Live conditions"** badge
  (`LiveMapHero.tsx:167`). `fetchedAt` is computed and typed but **never rendered**.
- Spot page `currentCondition` is computed at render time and frozen into the CDN-cached JSON
  (`forecast/[slug]/route.ts:68,82`, s-maxage=3600+swr=600): up to ~70 min stale on a CDN hit,
  ~2.2 h worst case through the full 4-layer stack (ISR 3600 + runtime cache 3600 + CDN 3600
  + swr 600). "Current" is also systematically the **next** hour (`merge.ts:198` compares with
  minutes included — ~30 min forward bias on average).

**Fix:** `refetchInterval` matched to each route's TTL (~5 min conditions, ~30 min forecast);
render `fetchedAt` as "updated HH:MM"; derive currentCondition client-side from the hourly
array already in the payload; truncate the now-comparison to the hour.

---

## Tier 2 — Systematic accuracy bias (the big wins)

### 2.1 Only one of Open-Meteo's swell partitions is fetched — and they rank by height, not period
`open-meteo.ts:142,229-234`. `secondary_swell_wave_*` exists, returns real data, and is never
requested. When a small windswell outweighs the groundswell, the engine scores 6-second slop
while the actual surf sits in the ignored partition.

- Live, same hour, one uniform SoCal swell: primary-partition period spans **6.7–11.9 s**
  across 16 adjacent spots purely from ranking flips.
- Santa Monica: primary 0.54 m @ 6.0 s; secondary 0.34 m @ **11.15 s**. Combined-in-quadrature
  face is **34% larger** than reported; scorePeriod sees 15/100 instead of 55–75.
- NDBC buoy 46221 corroborated: observed 0.8 m @ **14.0 s** while model primary said 5.6 s.
- 57% of sampled spots had an ignored secondary with >1.5 s longer period.

**Fix:** request the secondary partition; score each through
`breakingWaveHeight × directionalExposure`; `faceHeight = √(ΣHb²)`; use the energy-weighted
partition's period for scorePeriod.

### 2.2 Mean period scored against peak-period thresholds
`rating.ts:103-110`. `swell_wave_period` is a **mean** period (Tm ≈ 0.8–0.85·Tp); the buckets
encode peak-period language ("16 s groundswell"). A true 16 s swell arrives as ~13.2 s and
scores 91 instead of 98, face 1.92 m instead of 2.08 m — systematic under-rating of exactly
the days worth shouting about. (`swell_wave_peak_period` exists but returns null on
best_match.) **Fix:** shift thresholds down ~15% (16→13.5, 14→12, 12→10, 10→8.5, 8→6.5), and
interpolate instead of stepping (0.1 s currently flips bands: 9.9 s → 79, 10.0 s → 84).

### 2.3 Buoy observations never correct the rating
`forecast/[slug]/route.ts:31,76`. Real NDBC observations are fetched and displayed but never
reach `rateSurfConditions`; 574 spots carry an unused `noaaBuoyId`. Live at HB: buoy observed
**13 s @ 156°** while the rating consumed 6.7 s @ 273° (period score 15 vs observation-
supported 90). Mean |dominant-period gap| across sampled buoys: 4.0 s. **Fix:** blend/override
model swell period+direction from the buoy for current hours, or at minimum surface the
disagreement as a confidence signal.

### 2.4 Tide scored by rank within the window, not water depth
`rating.ts:172-205`. `t` is dimensionless: "ideal reef tide" (0.62) resolves to 1.31 m at a
2.6 m-range station and **2.72 m** at a 6 m-range station. At a station barely clearing the
0.15 m guard, ±5 cm swings the factor 75 points. **Fix:** score absolute depth vs datum with
per-bottom-type ideals in metres (reef ~0.9–1.5 m MLLW, sand ~0.6–1.2 m); widen the neutral
guard to ~0.5 m; add rising/falling (series already in hand).

### 2.5 Cleanliness math: linear ratio where energy combines in quadrature, on the wrong height
`rating.ts:152,270`.
- `chopRatio = ww/(sw+ww)` — energy share is `ww²/(ww²+sw²)`. Over-penalises modest chop
  (−20 to −25 pts measured), under-penalises heavy chop: genuine victory-at-sea (0.6 m swell /
  1.0 m windsea) escapes the strong veto (52 cap instead of 29).
- Uses **raw** swell height, not the exposure-reduced `effectiveSwell` computed 7 lines up —
  off-axis spots whose swell mostly doesn't arrive still rate "clean" (0.23 ratio → 80 at a
  spot whose actual sea surface is windsea-dominated).

**Fix:** quadrature ratio with re-anchored buckets (~0.05/0.15/0.40/0.65); pass
`effectiveSwell`.

### 2.6 Remaining curve/cap defects (each measured)
| Defect | Where | Measured |
|---|---|---|
| Hard cap releases discontinuously at 1.6 m face | `rating.ts:293-295` | 8 cm of face (4 cm of model swell) = 20 pts, "good"→"epic" |
| WRAP_FLOOR too generous on big swells (0.12 → effective 0.184 on face) | `rating.ts:51,60` | spot facing 180° away from a 6 m @ 17 s swell rates 72 "good" |
| No upper bound on offshore wind | `rating.ts:139-143` | 90 km/h straight offshore → 84 "epic" |
| One universal height curve; `difficulty` never consulted | `rating.ts:74-86` | beginner beach break and Nazaré share a curve peaking at 2.5–3.5 m |
| Day aggregates take night hours + zero-period hours | `merge.ts:134-137` | avgPeriod 8.1 s on a 15 s day; maxFaceHeight reported from 03:00 |
| computeWavePower mixes total-sea H with swell-partition T | `merge.ts:113` | 1.79–2.0× overstatement in mixed seas |
| UV formula wrong away from calibration point; clouds ignored | `solar-uv.ts:49` | LA winter noon: app 6.5 vs reference 2.7 (2.4×) |
| scoreFaceHeight ≥8 m returns 30 vs curve's [8.0, 35] | `rating.ts:91` | 5-pt discontinuity, deep in "closing out" |

---

## Tier 3 — Spot metadata (the data the engine multiplies against)

Sensitivity check (measured): facingDirection errors are worth up to **~60 score points**;
bottomType errors at most **~2.4** (tide factor, weight 0.10). Weight effort accordingly.
Good news: facingDirection is genuinely hand-authored (100 distinct values, no mass-default
spike), and 19/20 world-famous spots verify within tolerance.

| Finding | Where | Detail |
|---|---|---|
| **Pipeline cluster faces the wrong way** | `hawaii-gulf-lakes-carib.ts:34,49,154` | Backdoor stored at 10° vs Pipeline 320°, 56 m apart ("breaks off the same peak"); Off The Wall 5°, Log Cabins 5°, Rocky Point 358°. Worth 17 pts on a standard NW swell. Fix: 320–330°. |
| **Fiji reef passes face backwards** | spot data | Restaurants 45°, Swimming Pools 60° vs Cloudbreak 220°, <1 km apart — 175° spread in one 0.1° bucket. |
| **14 Oahu spots pull tides from Midway Atoll, 2,075 km away** | `hawaii-gulf-lakes-carib.ts` (station 1619910) | Correct station (1612668 Haleiwa) is 0–11 km from every one. Same pattern: Alaska → Anchorage (581–948 km), Gulf Coast → Tampa (523–740 km). Station 9453380 (Yakutat) doesn't exist → silent `[]` forever. Also feeds the visible tide chart + "observed coastal wind" readout — user-visible beyond the 0.10 weight. |
| **No tide-station distance cap** | seed data | Median spot→station 43.9 km; 24.6% >100 km; 5.3% >500 km. For 68.6% of mapped spots a closer station exists. Fix: script the mapping (nearest CO-OPS, cap ~75 km, null beyond — null is safe, weights renormalise). |
| **bottomType is regex-guessed from prose at runtime, not stored** | `static-store.ts:45` → `bottom-type.ts` | 0/1490 stored. `/beach|break/` catch-all makes sand the de-facto default (Rincon Point → sand); `/reef/` runs first so 58 "beach and reef" spots → pure reef; the point-break→rock rule is unreachable. Editing marketing copy silently changes ratings. Fix: promote to an explicit seed field; regex only as one-time migration. |
| 21 spots floored on their own described ideal swell | seed vs prose | Stored facing ≥90° off the description's "<DIR> swells" → clamped to 0.12 exposure, avg score 29 vs 88.7 for aligned spots. Review queue, not bulk edit — sometimes the prose is wrong (verified: Westward Ho! stored value is right). Santa Barbara cluster verified mostly FINE live (model already reports refracted 262–276° in the channel). |
| Duplicates + contradictions | seed | 3 exact dupes (Laniakea, Lahaina Harbor, Pohnpei ×2); sunset-beach vs sunset-beach-oahu disagree on facing AND station; velzyland pair 8 km apart (one misplaced). |
| 44 'expert' spots silently coerced to 'intermediate' | `static-store.ts:36-38` | Enum lacks 'expert' — Nazaré, Mullaghmore, Dungeons currently filterable as intermediate. Safety-relevant label. |
| Coordinate precision | seed | 2 spots at 0 decimals (~111 km): plage-blanche-morocco, periscopes-sumbawa; 19 at 1 decimal incl. HT's, Lance's Right, Nias. |
| 2 US spots discard a station <3 km away | seed | pago-pago (1770000, 1 km), saipan-beach (TPT2623, 3 km). |

---

## Tier 4 — Serving-layer consistency

| Finding | Where | Detail |
|---|---|---|
| 0.1° bucketing serves 29% of spots another spot's swell | `spots/route.ts:130,163` | 438/1490 borrow a neighbour's reading (max 11.2 km); representative is name-sort order and **changes under filters** (229 spots flip source coords under a difficulty filter). Marine grid is ~0.04°, so 0.1° discards resolution the API already offers. Fix: bucket 0.02–0.05° or use centroid. |
| Region matching is substring: **"Ventura" matches "Fuerteventura"** | `best-spots/route.ts` + `static-store.ts:106-109` | Canary Islands spots returned in the California Ventura region, scored against California swell — in the Pro-gated feature. Whole regions also scored off ONE cell (NorCal: 52 spots / 307 km / 85° spread). Wind-fetch failure defaults `{speed:0}` → every hour scores glassy 100. |
| Fallback: no true-distance cap, no coastline check, full-exposure bias | `nearest-fallback.ts:16,80`, `spots/route.ts:213-245` | Simulated: 94 spots would borrow >100 km, cross-basin borrows (Gulf of Thailand ← Andaman Sea; Lake Erie ← Lake Ontario). Borrowed spots get exposure 1.0 (swellDirection null) — maximum face height exactly when data is least reliable — while borrowed **wind** IS scored against the local facing. Antimeridian: dLng unwrapped (Fiji↔Futuna ranked 75× too far); no cos(lat) scaling (2× distortion in Alaska). Fix: cap ~50 km true distance + facing within ~45°, else 'unknown'. |
| Map wind vs marine from different times | `open-meteo.ts:147-153` | Map uses instantaneous `current=` wind with the (H1-broken) hourly marine index — wind and waves up to ~10 h apart in one reading. |
| Map and spot page legitimately disagree | by design | Map path has no tide factor (weights renormalise) — can cross a rating band vs the spot page. Label it or unify. |
| DST edges | `noaa-tides.ts`, cached `utc_offset_seconds` | Fall-back hour: duplicate 01:00 tide key (second write wins); offset cached up to 1 h through transitions. Two hours a year — note, don't prioritise. |

**Staleness budget (worst case, fresh load / tab left open):** home map ~9 min / unbounded ·
browse map ~9 min / unbounded · spot "current" ~2.2 h / unbounded · best-spots ~90 min /
unbounded. The unbounded column is finding 1.5.

---

## Verified correct (aggregated — don't re-litigate)

- Komar & Gaughan implementation and constant; applying exposure **before** the ^0.4 is the
  textbook refraction form (Kr = √cos θ); exposure not double-counted; veto caps stack via
  min(), not additively; weight renormalisation works as documented (missing tide ≤2 pts).
- Direction convention end-to-end (FROM-bearings vs facing via angleDiff; offshore = facing+180).
- `findNearestFutureHour` offset math; lexicographic local-string comparison; wind/weather
  joined by time-key not index; long-range merge indexes by time; tide "YYYY-MM-DD HH:MM" →
  "T" rewrite matches Open-Meteo's key format exactly.
- NDBC parsing (headers, MM→null, UTC tagging); in-flight dedupe; withCache null-vs-miss.
- `cell_selection=sea` is a genuine no-op on this grid (tested 5 spots, byte-identical) — the
  real land-cell issue is the null handling (1.2), not cell selection.
- facingDirection is authored data; famous-spot ground truth passes (Pipeline 320, Malibu 200,
  OB-SF 275, Mavericks 300, Teahupoo 200, J-Bay 145, …).
- No conditions data is baked into the 24 h-ISR spot page (client component fetches at
  runtime); best-spots correctly `private,no-store`.
- Cache-key versioning discipline is broadly fine — all runtime TTLs ≤1 h bound shape-drift to
  a one-hour post-deploy window (one historical lapse: `is_long_range` added without a bump,
  degraded gracefully).

## Status

- **Phase 1 — shipped** (PR #10, 2026-08-05): 1.1-1.5 in full.
- **Phase 2 — shipped** (2026-08-07): tide stations re-derived from coordinates
  by `scripts/map-tide-stations.ts` (nearest CO-OPS *reference* station ≤75 km,
  null beyond) · Pipeline-cluster and Tavarua facings · 8 duplicate records
  merged behind `lib/spots/spot-aliases.ts` · `expert` added to the difficulty
  enum end-to-end · `bottomType` promoted to a stored seed field with the three
  rule-ordering bugs fixed · `tests/spots-seed.test.ts` seed assertions ·
  `scripts/check-spot-coordinates.ts` verifies every spot resolves to a live
  marine cell.
  **Correction to this audit:** it recommends station 1612668 (Haleiwa) for the
  Oahu cluster. That is a *subordinate* station — two thirds of CO-OPS's
  published list is — and subordinate stations cannot answer the hourly MLLW
  query `fetchTidePredictions` sends. Verified live: 1612668 returns nothing,
  1612340 (Honolulu, type R) returns 72 hourly points. "Nearest station" must
  read "nearest reference station" or it recreates the Yakutat failure at scale.
  Still open from tier 3: the 21 coarse coordinates (frozen as a backlog in the
  seed test) and the 21 spots floored on their own described ideal swell.
- **Phase 3 — shipped** (2026-08-07): 2.1 secondary partition · 2.2 mean→peak
  period recalibration + interpolation · 2.3 buoy blending · 2.4 absolute-depth
  tide + rising/falling · 2.5 quadrature cleanliness on `effectiveSwell` · 2.6
  cap ramps and the ≥8 m height-curve discontinuity · difficulty-scaled height
  curve · tier-4 fallback caps (50 km + 45° facing, true distance) and 0.05°
  bucketing with a filter-stable representative · tier-4 best-spots region
  scoping (word-boundary match, up to 4 swell cells per region).
  Still open from tier 2/4: WRAP_FLOOR generosity (2.6 row 2), map wind/marine
  time skew, map-vs-page tide disagreement.
- **Phase 4 — not started.**

## Recommended fix order

1. **Phase 1 — correctness (small diffs, verified-live bugs):** 1.1 timezone hour selection +
   forecast_days=2 · 1.2 null-preservation family · 1.3 calm-vs-missing wind · 1.4 wind veto
   ramp + continuous direction curve · freshness 1.5 (refetchInterval + fetchedAt + client-side
   current + hour truncation). Every one has a pinned before/after number for tests.
2. **Phase 2 — data quality:** Pipeline/Fiji facings · Midway/Anchorage/Tampa stations +
   scripted station mapping with 75 km cap · delete dupes · 'expert' enum · bottomType → stored
   field · seed assertions (<500 m pairs ≤45°, station exists + within N km).
3. **Phase 3 — model upgrades:** secondary swell partition (biggest single accuracy win) ·
   mean→peak period recalibration + interpolated scorePeriod · quadrature cleanliness on
   effectiveSwell · absolute-depth tide + rising/falling · cap ramps · buoy blending ·
   difficulty-scaled height curve · fallback caps + bucketing refinement · best-spots region
   scoping.
4. **Phase 4 — polish:** wave power partition sum · UV formula + cloud attenuation · gust
   penalty · day-aggregate daylight filtering · DST edges.

Audit produced by four parallel agents with live-production verification; probe scripts and
raw API captures were session-scratchpad artifacts (not retained in repo). Prior audits:
`00`–`05` in this directory.
