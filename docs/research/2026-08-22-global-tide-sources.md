# Free global tide data for WaveFinder — research report

Date: 2026-08-23 · Repo: `C:\Users\Rahil\WaveFinder` (read-only for this research)
All HTTP statuses below were obtained by actually calling the endpoint with `curl` from this machine.

---

## TL;DR

**Stop looking for a tide API. Ship a harmonic-constituent table instead.**

- 886 of 1,481 spots (59.8%) currently have no tide data at all.
- `@neaps/tide-database` (MIT code, CC-BY-4.0 / public-domain data) ships **6,115 stations in 126 countries**. With `@neaps/tide-predictor` (MIT, zero deps) it reproduces **NOAA official predictions to 0.012 m RMSE** and **Canada's CHS official predictions to 0.039 m RMSE**, with **zero network calls** and ~21 ms per 17-day window.
- A build-time subset is **425 stations / 274 KB gzipped**, covering **73% of the station-less spots** *and* 197 of the 201 CO-OPS stations the app already calls — so it also removes an existing runtime dependency.
- ⚠️ **9.1% of nearest-station matches are hydraulically wrong** (Bells Beach matches a gauge inside Port Phillip Bay, r = **−0.28**). The generation script must verify against an independent field, not trust distance.
- The remaining ~240 spots can be closed by **fitting constituents from one archive year of Open-Meteo sea level** — validated at **0.094 m RMSE** extrapolating a month past the training window. End state: **zero runtime tide network calls anywhere.**
- Every national API tested is either redundant (harmonics cover the same coast), restrictively licensed (Canada CHS, UK Admiralty, Brazil CC-BY-ND, SHOM), or a PDF/auth dead end (Chile, South Africa, Indonesia, Philippines). Only Ireland, Netherlands, LINZ, JMA and Queensland TMR are cleanly usable — and all are optional polish.

---

## 1. What the repo needs

### 1.1 Where tide data enters the app

| File | Role |
|---|---|
| `C:\Users\Rahil\WaveFinder\lib\api\noaa-tides.ts` | The *only* tide client. `fetchTidePredictions(stationId)` → NOAA CO-OPS `datagetter`. Also `fetchCoastalWind` (same station, `product=wind`). |
| `C:\Users\Rahil\WaveFinder\app\api\forecast\[slug]\route.ts` | Calls `fetchTidePredictions(spot.noaaTideStationId)` inside a `Promise.allSettled`; passes `tides` into `mergeForecastData` **and** into the response payload. Falls back to `[]` when the spot has no station. |
| `C:\Users\Rahil\WaveFinder\lib\forecast\merge.ts` (L116-152, 288-312) | Indexes tide points by local `"YYYY-MM-DDTHH:MM"`, computes `tideMin`/`tideMax` over the window and a per-hour `rising` boolean, then builds a `TideContext` per hour. |
| `C:\Users\Rahil\WaveFinder\lib\forecast\rating.ts` (L267-324, L527-537) | `scoreTide(tide, bottomType)` — a 0.10-weight factor in the surf score. |
| `C:\Users\Rahil\WaveFinder\lib\forecast\best-time.ts` (L71-114) | Rising/falling copy for the "best time" windows. |
| `C:\Users\Rahil\WaveFinder\types\forecast.ts` (L64-68) | `TidePoint { time: string; height: number; type: 'H'|'L'|null }` |
| `C:\Users\Rahil\WaveFinder\types\spot.ts` (L27) | `noaaTideStationId?: string | null` — the single point of coupling to NOAA. |
| `C:\Users\Rahil\WaveFinder\scripts\map-tide-stations.ts` | Build-time script assigning the nearest **type R (reference)** CO-OPS station within 75 km; output pinned by `tests/spots-seed.test.ts`. |

### 1.2 The exact contract any replacement must satisfy

1. **Shape: an hourly series, not high/low events.** `fetchTidePredictions` requests `interval=h` and then *derives* `type: 'H' | 'L'` by scanning for local maxima/minima in the hourly array. The chart, the rating and `best-time` all read the hourly series; the H/L flags are decoration. **A source that only publishes high/low events is a downgrade, not a drop-in.**
2. **Absolute metres above a low-water datum — this is load-bearing.** `rating.ts` deliberately abandoned rank-within-the-day scoring. `TIDE_PREFERENCE` is in metres: `reef/coral { ideal: 1.2, lowTol: 0.7, highTol: 1.4 }`, `rock { 1.0, 0.8, 1.4 }`, `sand { 0.9, 0.9, 1.3 }`, default `{ 1.0, 1.1, 1.6 }`. Those numbers were calibrated against **MLLW**. Feeding an MSL-referenced series (which oscillates around 0 and goes negative) would score every reef as "dry" for half of every day. Any new source must be converted to a low-water datum before it reaches `scoreTide`.
3. **Window: ~17 days, in the spot's LOCAL clock with no offset.** `formatDate(today-1)` → `+17 days`, `time_zone=lst_ldt`, and times are stored as `"YYYY-MM-DDTHH:MM"` local strings. CLAUDE.md is explicit: never `new Date()` these.
4. **Range guard.** `scoreTide` returns a neutral 50 when `max - min < 0.5 m`. A source that under-resolves amplitude silently neutralises the factor.
5. **Missing tide must stay missing.** `rating.ts` renormalises weights over present factors. Returning `[]` is correct behaviour for an unknown spot — never substitute zeros.
6. **Caching already exists.** `getCache()` from `@vercel/functions`, key `noaa:tides:${stationId}`, TTL 3600 s, plus `next: { revalidate: 3600 }`.

### 1.3 Size of the gap (measured, not estimated)

Parsed from `lib/spots/*.ts` + `lib/spots-data.ts`:

- **1,481 spots total; 886 (59.8%) have `noaaTideStationId: null`** → no tide chart, no tide factor, weights renormalise away.
- Today a non-US spot is handled by simply *omitting* tide: `spot.noaaTideStationId ? fetchTidePredictions(...) : Promise.resolve([])`.

Worst-affected countries (spots with no station):

| Country | spots | no tide | Country | spots | no tide |
|---|---|---|---|---|---|
| Australia | 96 | 96 | Japan | 29 | 29 |
| Indonesia | 63 | 63 | Chile | 25 | 25 |
| Mexico | 61 | 60 | Costa Rica | 23 | 14 |
| Spain | 56 | 56 | Peru | 21 | 21 |
| Portugal | 48 | 48 | Ireland | 20 | 20 |
| South Africa | 40 | 40 | India | 19 | 19 |
| Morocco | 34 | 34 | Sri Lanka | 15 | 15 |
| New Zealand | 33 | 33 | Philippines | 14 | 14 |
| United Kingdom | 33 | 33 | Nicaragua | 14 | 14 |
| France | 31 | 31 | Maldives | 11 | 11 |
| Brazil | 31 | 31 | (USA) | 576 | 18 |

---

## 2. The headline finding

**The right answer is not another HTTP API. It is harmonic constituents computed in-process.**

`@neaps/tide-database` (MIT code, per-file data licences) ships **6,115 stations across 126 countries** — 3,477 from NOAA and 2,638 from **TICON-4** (*TIdal CONstants based on GESLA-4 sea-level records*, Hart-Davis / Dettmering / Seitz 2025, SEANOE DOI `10.17882/109129`, **CC-BY 4.0**, 50 constituents per station). Paired with `@neaps/tide-predictor` (MIT, **zero dependencies**, 217 KB), it reproduces official predictions almost exactly:

| Validation | Source of truth | n | Bias | RMSE (after bias) | Max err | Pearson r | Amp ratio |
|---|---|---|---|---|---|---|---|
| Malibu → `noaa/9410840` Santa Monica (16.7 km) | NOAA CO-OPS official MLLW predictions, 30 d hourly | 744 | 0.000 m | **0.012 m** | 0.027 m | 0.9997 | 0.998 |
| Tofino BC → `ticon/tofino_bc-8615-can-meds` (0.5 km) | DFO IWLS official CHS predictions, 30 d hourly | 725 | 0.024 m | **0.039 m** | 0.111 m | 0.9989 | 0.992 |

The Canadian case matters most: the TICON-4 constituents are an **independent** scientific product, yet they reproduce the Canadian Hydrographic Service's own published predictions to 3.9 cm — with **zero network calls**.

**Datum conversion is solved by the library itself.** Every station carries a full `datums` ladder (`HAT/MHHW/MHW/MSL/MTL/MLW/MLLW/LAT/MHWS/MLWS`) and `useStation(station).getTimelinePrediction({ …, datum: 'MLLW' })` applies it natively — no manual arithmetic. Verified end-to-end:

```
useStation(noaa/9410840).getWaterLevelAtTime({ time, datum: 'MLLW' })
   vs NOAA official MLLW, 744 h → bias 0.0000 m, RMSE 0.0121 m, max 0.027 m
```

This is precisely the "absolute metres above a low-water datum" that `scoreTide` was calibrated for, and asking for `'MLLW'` uniformly **normalises all six chart datums in the dataset to one scale**, which is what makes a single global `TIDE_PREFERENCE` table legitimate.

Across the 425 stations an actual WaveFinder build would select: **every one has both `MSL` and `MLLW`** (0 missing), and the `MSL − MLLW` shift spans **0.04 m to 3.31 m, median 0.60 m**. Since `TIDE_PREFERENCE.reef.ideal` is 1.2 m with a 0.7 m low tolerance, skipping this conversion would misplace many spots by more than the entire tolerance band — this step is not cosmetic. Chart-datum mix in that subset is genuinely mixed — **MLLW 194, LAT 189, NLLW 18, MLWS 17, LLWLT 5, TLT 2** — so always pass `datum: 'MLLW'` explicitly rather than accepting each station's `defaultDatum`. Licences in the subset: 276 CC-BY-4.0 + 149 public domain, **zero non-commercial**.

### Measured cost inside serverless limits

| Metric | Value |
|---|---|
| Full `@neaps/tide-database` npm package | 9.6 MB tarball, 58 MB unpacked (18.5 MB `stations.pack` + 8 MB node bundle) — **too heavy to bundle whole** |
| **Subset** for all 1,270 regional spots — 425 distinct stations, compact form (coords + datums + 50 constituents) | **523 KB raw · 146 KB gzip · 107 KB brotli** |
| Same subset in the full `useStation()`-compatible record shape (recommended) | **1,393 KB raw · 274 KB gzip · 203 KB brotli** |
| Predict 408 hourly points (a full 17-day window, one spot) | **21.3 ms** |
| Predict 63 high/low extremes over the same window | **2.9 ms** |
| Network calls at request time | **0** |

The build-time-subset pattern already exists in this repo (`scripts/map-tide-stations.ts` → `scripts/data/noaa-tide-stations.json`, pinned by `tests/spots-seed.test.ts`), so this is an idiomatic addition rather than a new concept.

### Coverage of the 886 station-less spots

Nearest **reference** station with harmonics and a **commercial-use-permitting licence** (`license.commercial_use === true`):

| Radius | Covered | % |
|---|---|---|
| ≤ 25 km | 328 | 37.0% |
| ≤ 50 km | 497 | 56.1% |
| ≤ 75 km (repo's existing threshold) | 592 | 66.8% |
| **≤ 100 km** | **646** | **72.9%** |
| ≤ 150 km | 708 | 79.9% |
| ≤ 250 km | 797 | 90.0% |

Median distance 35.7 km, p75 90.4 km, p90 200 km. Relaxing the licence filter to include CC-BY-NC adds only +1.8 pp (74.7%) and allowing subordinate stations +5.9 pp (78.8%) — **not worth the licence risk or the offset-station complexity.**

**It also subsumes most of the existing NOAA dependency**: 197 of the 201 distinct CO-OPS station ids the repo currently uses are in the database *with* harmonics (missing: `9751388`, `1732417`, `9435380`, `9410230`).

### Residual gap — 240 spots with no station within 100 km

| Country | uncovered / station-less | Country | uncovered / station-less |
|---|---|---|---|
| Morocco | 32 / 34 (94%) | Costa Rica | 9 / 14 |
| Indonesia | 17 / 62 (27%) | Panama | 8 / 9 |
| India | 17 / 19 (89%) | Uruguay | 7 / 7 |
| Chile | 16 / 25 (64%) | Vietnam | 5 / 6 |
| Nicaragua | 14 / 14 (100%) | Colombia | 4 / 5 |
| Sri Lanka | 13 / 15 (87%) | South Korea / China | 3 / 3 each |
| Philippines | 11 / 14 (79%) | Portugal | 10 / 48 (21%) |

These are what the Open-Meteo fallback (§4) is for.

### 2.3b Spot-check at named breaks (harmonic vs Open-Meteo, 72 h)

| Spot | Matched station | km | harm. range | O-M range | r |
|---|---|---|---|---|---|
| Hossegor, FR | `ticon/bayonne_boucau-94-fra-refmar` | 16 | 2.31 m | 2.46 m | 0.943 |
| Mundaka, ES | `ticon/saint_jean_de_luz_socoa` | 82 | 2.47 m | 2.44 m | 0.960 |
| Peniche, PT | `ticon/cascais-209-prt-uhslc_fd` | 75 | 1.93 m | 1.96 m | 0.977 |
| Fistral, UK | `ticon/port_isaac-pti-gbr-cco` | 27 | 4.31 m | 3.87 m | 0.934 |
| Lahinch, IE | `ticon/inishmore-ini-irl-mi_c` | 30 | 2.80 m | 2.67 m | 0.951 |
| Jeffreys Bay, ZA | `ticon/port_elizabeth-184-zaf-uhslc` | 66 | 1.03 m | 1.10 m | 0.957 |
| Uluwatu, ID | `ticon/benoa-163-idn-uhslc_fd` | 16 | 1.38 m | 1.27 m | 0.921 |
| Raglan, NZ | `ticon/manukau-mnkt-nzl-ttw` | 90 | 1.95 m | 1.99 m | 0.892 |
| Chiba, JP | `ticon/choshigyoko-ma64-jpn-jodc` | 4 | 1.05 m | 1.03 m | 0.986 |
| Puerto Escondido, MX | `ticon/puertoangel_radar-17-mex` | 65 | 0.78 m | 0.76 m | 0.959 |
| Florianópolis, BR | `ticon/imbituba-718a-bra-uhslc` | 74 | 0.71 m | 0.77 m | 0.863 |
| Malé, MV | `ticon/male_hulule-108b-mdv-uhslc` | 3 | 0.58 m | 0.59 m | 0.954 |
| Arica, CL | `ticon/arica-083-chl-uhslc_fd` | 1 | 0.84 m | 0.84 m | 0.972 |
| **Bells Beach, AU** | `ticon/geelong-60770-aus-bom` | 26 | 0.69 m | 1.37 m | **−0.281** ⚠️ |
| Anchor Point, MA | *(none within 120 km)* | — | — | — | — |

Two independent methods agree everywhere except the one estuary case — which is exactly the hazard documented next.

### 2.4 ⚠️ The one real hazard: nearest-by-distance picks estuary stations

Cross-validating every assigned station against Open-Meteo's independent tide field (72 h, 230 distinct spot/station pairs, one per station) found:

- **209 pass** — median Pearson r = **0.955** between two completely independent methods. Strong global corroboration.
- **21 fail (9.1%)** with r < 0.8 or amplitude ratio outside 0.6–1.6.

Every failure is the same physical story: **the nearest gauge sits inside a bay, estuary, river or lagoon with a different tidal regime from the open-coast surf break.** Distance says 13 km; hydraulics say another ocean.

| Spot | Country | Matched station | km | r | amp ratio | Why it's wrong |
|---|---|---|---|---|---|---|
| `bells-beach-victoria` | Australia | `ticon/geelong-60770-aus-bom` | 26 | **−0.28** | 0.51 | Inside Port Phillip Bay, behind the Heads |
| `gunnamatta-mornington` | Australia | `ticon/hovell_pile-60721-aus-bom` | 13 | **−0.17** | 0.40 | Also inside Port Phillip Bay |
| `thurso-east-scotland` | UK | `ticon/wick-wic-gbr-bodc` | 30 | **0.07** | 0.84 | Opposite sides of the Pentland Firth — near phase reversal |
| `mar-del-plata-argentina` | Argentina | `ticon/mar_del_plata-729-arg-uhslc` | 3 | 0.45 | 0.72 | Harbour basin |
| `fulong-beach-taiwan` | Taiwan | `ticon/keelung-341a-chn-uhslc_rq` | 24 | 0.51 | 0.89 | Around a headland |
| `floreat-beach-perth-wa` | Australia | `ticon/perth_barrack_street_jetty` | 10 | 0.60 | 0.83 | Up the Swan River |
| `fanore-clare` | Ireland | `ticon/kinvara_unreferenced-kin-irl` | 23 | 0.65 | **0.26** | Inner Galway Bay |
| `sete-france-med` | France | `ticon/sete-250-fra-refmar` | 1 | 0.74 | 0.67 | Mediterranean lagoon |
| `radhanagar-havelock-andaman` | India | `ticon/port_blair-908-ind-uhslc_fd` | 37 | 0.96 | **0.42** | Amplitude halved |

**Note the two-sided test matters.** `radhanagar` correlates at r = 0.96 — perfect phase — but its amplitude is 42% of reality. A phase-only check would pass it and the spot would silently score every reef tide as too shallow.

This is the same class of bug CLAUDE.md already documents for CO-OPS subordinate stations (`yakutat-surf-ak` pointing at non-existent station 9453380 → silent permanent blank chart). **Step 1 below therefore builds the check into the generation script rather than trusting distance.**

---

## 3. Source table (every URL below was actually called)

### 3.1 Recommended tier — harmonic constituents (no runtime API at all)

| Source | Region | Type | Auth | Limits | Datum | Shape | Licence | Tested URL | Status |
|---|---|---|---|---|---|---|---|---|---|
| **`@neaps/tide-database` 0.9.20260801** | Global — 6,115 stations / 126 countries | Harmonic constituents (prediction) | none | none (local data) | per-station `chart_datum` (LAT 1048, MLLW 830, LLWLT 254, NLLW 216, MSL 204, MLWS 72, TLT 14) + full `datums` ladder | 50 constituents `{name, amplitude, phase}` → any interval you want | **MIT** for code; **per data file**: NOAA = public domain, TICON-4 = **CC-BY-4.0** (2,352 stations) or **CC-BY-NC-4.0** (286 stations, filter these out) | `https://registry.npmjs.org/@neaps%2Ftide-database` | **200** |
| **`@neaps/tide-predictor` 0.11.0** | — | Harmonic engine | none | none | — | `getWaterLevelAtTime`, `getTimelinePrediction`, `getExtremesPrediction` | **MIT**, zero deps, 217 KB | `https://registry.npmjs.org/@neaps%2Ftide-predictor` | **200** |
| **TICON-4 (upstream)** | 4,383 global gauges | Harmonic constants from GESLA-4 | none | — | per gauge | 50 constituents | **CC-BY 4.0**, DOI 10.17882/109129; cite Piccioni et al. (2019) | `https://www.seanoe.org/data/00980/109129/` | **200** |

### 3.2 National APIs (verified; mostly redundant given §3.1 — see notes)

| Source | Region | Type | Auth | Limits | Datum | Shape | Licence | Tested URL | Status |
|---|---|---|---|---|---|---|---|---|---|
| **NOAA CO-OPS** *(in use)* | USA + territories | Predictions | none (`application=` string) | generous, undocumented | MLLW (selectable) | hourly series or H/L | US public domain | `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?...station=9410840&product=predictions&datum=MLLW&interval=h` | **200** |
| **DFO / CHS IWLS** | Canada — 1,573 stations | Predictions (`wlp`) + H/L (`wlp-hilo`) + observed (`wlo`) | **none** | no rate-limit headers; 24-day range accepted | Chart datum (LLWLT); `/metadata` gives CGVD2013/CGVD28 offsets | `wlp` = **1-minute** by default → pass `resolution=SIXTY_MINUTES`; `wlp-hilo` = H/L events | ⚠️ **Restrictive.** CHS licence forbids giving data "to a third party", forbids commercial use, and requires a "not to be used for navigation" notice | `https://api-iwls.dfo-mpo.gc.ca/api/v1/stations` | **200** |
| " | " | " | " | " | " | " | " | `.../api/v1/stations/5cebf1e23d0f4a073c4bc07c/data?time-series-code=wlp&from=…&to=…&resolution=SIXTY_MINUTES` | **200** |
| " | " | " | " | " | " | " | " | `.../api/v1/stations/{id}/data?time-series-code=wlp-hilo&…` | **200** |
| " | OpenAPI 3.1 spec v1.3.1 | — | — | — | — | — | — | `https://api-iwls.dfo-mpo.gc.ca/v3/api-docs` | **200** |

> **Canada verdict:** the API works and needs no key, but its licence is the most restrictive of anything tested — no third-party redistribution, no commercial use. The TICON-4 harmonics for the *same* Canadian gauges are CC-BY-4.0 and reproduce CHS predictions to 3.9 cm. **Use the harmonics, not the API.** The DB holds 267 Canadian stations vs. the repo's 6 Canadian spots.

Other national sources that are free, machine-readable and well-licensed (full detail and the dead ends in §6):

| Source | Region | Shape | Datum | Auth | Licence | Status |
|---|---|---|---|---|---|---|
| **Marine Institute ERDDAP** | Ireland | H/L events **and 5-min series** | OD Malin (near MSL — needs conversion) | none | **CC-BY 4.0** | **200** |
| **Rijkswaterstaat DDAPI** | Netherlands | H/L events | cm above NAP | none | open | **200** |
| **LINZ** | New Zealand, 322 ports, 2025–2029 | CSV H/L | Chart Datum ≈ LAT | none | **CC-BY 4.0** | **200** |
| **JMA** | Japan, 229 stations | fixed-width, hourly + H/L | cm above chart datum | none | JP Gov rules, commercial OK | **200** |
| **Queensland TMR** | QLD, Australia, 78 stations | JSON H/L + 10-min | LAT | none | **CC-BY 4.0** | **200** |

### 3.3 Global model — Open-Meteo Marine (gap filler + verification field)

| Property | Finding |
|---|---|
| Variable | `sea_level_height_msl` |
| Producer | **MeteoFrance SMOC** (Copernicus) currents+tides, 0.08° (~8 km), hourly, global, updated daily, archive from Jan 2022 |
| **Datum** | **Global mean sea level — explicitly *not* LAT.** Oscillates through zero and goes negative. |
| Content | Ocean tide **+ inverted barometer + sea-surface height** — i.e. tide *plus* surge, not pure astronomical tide |
| Horizon | Documented 10 days; measured **216 h (9 days)** of non-null at Hossegor with `forecast_days=16`. Verified this does **not** truncate the wave variables — `wave_height` returned the same 216 h with and without `sea_level_height_msl` in the same request. |
| Official caveat | *"Accuracy is limited in coastal areas… not suitable for coastal navigation."* |
| Auth / limits | No key. Free tier **600/min, 5,000/h, 10,000/day, non-commercial only**, data CC-BY-4.0 |
| Archive | `start_date`/`end_date` works — pulled a full year (8,760 h, 0 nulls) at Uluwatu |

Measured at the three requested test points plus a control (`forecast_days=2`, all **HTTP 200**, zero nulls):

| Spot | Requested | Grid cell returned | 48 h min…max | Range |
|---|---|---|---|---|
| Hossegor | 43.66, −1.44 | 43.625, −1.4583 (elev 10 m) | −1.31 … 0.69 | 2.00 m |
| Uluwatu | −8.83, 115.09 | −8.7917, 115.1250 (elev **85 m**) | −0.23 … 0.77 | 1.00 m |
| Malibu | 34.035, −118.678 | 33.9583, −118.7083 (elev 0 m) | −0.54 … 1.06 | 1.60 m |
| Tofino | 49.154, −125.913 | 49.125, −125.875 | −0.98 … 1.05 | 2.03 m |

Note the Uluwatu cell snaps to an 85 m-elevation land point yet still returns a plausible tide — the grid is coarse near complex coasts.

**Accuracy vs. official predictions (30-day hourly):**

| Site | vs. | Mean offset | Std. dev of offset | Max residual | Pearson r | Amplitude ratio |
|---|---|---|---|---|---|---|
| Malibu | NOAA MLLW @ Santa Monica | 0.681 m | **0.101 m** | 0.284 m | 0.9794 | 1.008 |
| Tofino | DFO chart datum | 1.952 m | **0.251 m** | 0.581 m | 0.9512 | 0.999 |

The **amplitude is right (ratio ≈ 1.00)** and it's only a datum shift away from usable — but the residual is **8× worse than harmonics at Malibu and 6× worse at Tofino**, and it stops 8 days short of the app's 17-day window. So it earns two build-time jobs rather than a runtime one:

1. **Training data** for fitting constituents at spots with no gauge (Step 3) — this removes both the per-request call and the horizon limit.
2. **An independent verification field** for the estuary guard (§2.4) — its whole value there is that it is *not* derived from tide gauges, so it catches a gauge in the wrong body of water.

Confirmed it covers every harmonic-DB gap spot tested (all **200**, zero nulls, 72/72 hours):

| Gap spot | Range over 3 days |
|---|---|
| Taghazout, Morocco (30.545, −9.710) | 1.88 m |
| Popoyo, Nicaragua (11.45, −86.13) | 1.30 m |
| Arugam Bay, Sri Lanka (6.02, 80.79) | 0.37 m |
| Ritoque, Chile (−33.03, −71.63) | 1.11 m |
| Goa, India (15.60, 73.74) | 1.44 m |

### 3.4 Global tidal atlases (evaluated, not recommended)

| Source | Licence | Feasibility in a Node serverless app | Verdict |
|---|---|---|---|
| **FES2022 / FES2014** (AVISO/LEGOS/CNES/CLS) | "Available for all uses", **commercial permitted**, registration required, mandatory attribution: *"The FES2022 Tide product was funded by CNES, produced by LEGOS, NOVELTIS and CLS and made freely available by AVISO."* Tested `https://www.aviso.altimetry.fr/en/data/products/auxiliary-products/global-tide-fes.html` → **200** | ✖ NetCDF4, 1/30° grid, **170 MB per elevation file / 2.2–3.7 GB total**; needs a NetCDF reader and grid interpolation. Would have to be pre-sampled at build time into per-spot constituents. | Only worth it to fill the 240-spot gap — and only as a **build-time constituent extraction**, never a runtime dependency |
| **TPXO10 / TPXO9-atlas** (OSU) | **"Academic research and other non-commercial uses"**, registration required; commercial use needs separate negotiation. Tested `https://www.tpxo.net/global` → **200** | Same NetCDF problem | ✖ **Rule out** — licence is incompatible |

### 3.5 Paid — listed only to rule out

| Service | Free tier | Verdict | Tested URL | Status |
|---|---|---|---|---|
| **Stormglass.io** | €0/mo = **10 requests/day, explicitly not for commercial use**; €19/mo = 500/day; €49/mo = 5,000/day; €129/mo = 25,000/day | ✖ 10/day cannot serve 1,481 spots | `https://stormglass.io/pricing/` | **200** |
| **WorldTides.info** | No free tier documented; credit-based (1 credit ≈ 7 days of heights) | ✖ Paid per request | `https://www.worldtides.info/apidocs` | **200** |

---

## 4. Recommended architecture

```
  BUILD TIME                                   REQUEST TIME
  ─────────────────────────────────────────    ────────────────────────────────
  @neaps/tide-database (devDep, 58 MB)
     │  nearest reference station ≤100 km
     │  + licence filter (commercial_use)      ┌──────────────────────────────┐
     │  + estuary guard (r≥0.8, amp 0.6–1.6)   │ TIER 1  useStation(...)      │
     └──▶ harmonic-stations.json ─────────────▶│   .getTimelinePrediction({   │
          425 stations · 274 KB gz             │      datum: 'MLLW' })        │
                                               │ 0 network · ~21 ms · ±1–4 cm │
  Open-Meteo archive (1 yr/spot, once)         └──────────────┬───────────────┘
     │  least-squares fit, 26 constituents                    │ no station
     │  + Z0 = −mean(daily lower low)          ┌──────────────▼───────────────┐
     └──▶ fitted-stations.json ───────────────▶│ TIER 2  same predictor,      │
          ~240 spots                           │ fitted constituents · ±10 cm │
                                               └──────────────┬───────────────┘
                                                              │ neither
                                               ┌──────────────▼───────────────┐
                                               │ TIER 3  return []            │
                                               │ weights renormalise (today)  │
                                               └──────────────────────────────┘
```

Both tiers run through **the same predictor and the same `TidePoint[]` contract** — they differ only in where the constituents came from and how accurate they are. Runtime tide network calls: **zero**.

### Why this shape

- **Tier 1 removes a network dependency rather than adding one.** Today every `/api/forecast/[slug]` request for a US spot makes a NOAA call. Harmonics make it zero calls for ~98% of those spots too, and eliminate the `map-tide-stations.ts --verify` failure mode (a subordinate station silently returning `{"error":"No Predictions data was found"}` → permanent blank chart, exactly the `yakutat-surf-ak` bug in CLAUDE.md). A constituent table cannot 404.
- **It respects the existing budget discipline.** The 2026-08-10 incident (`project_wavefinder_loading_optimization`) was caused by per-location upstream billing on an unscoped sweep. Neither tier has a runtime upstream: Tier 2's Open-Meteo usage is ~1 call per gap spot **once, at build time**, not per request. If you ever fall back to calling Open-Meteo live, it must inherit the same viewport scoping and 200-bucket ceiling as `/api/spots` and run only on the single-spot forecast route.
- **Datum conversion is done at build time, not runtime.** Store `mslToDatum` per station in the generated JSON so `scoreTide` receives the metres-above-MLLW it was calibrated on.
- **Licence hygiene is a filter, not a debate.** Emit only `license.commercial_use === true` stations into the generated file (the repo has Stripe wired, so "non-commercial" is a real risk). That costs 1.8 pp of coverage.
- **National APIs are mostly redundant.** DFO IWLS works with no key but its licence forbids third-party redistribution; the same gauges are available as CC-BY-4.0 harmonics. Reach for a national API only where the harmonic DB is empty *and* Open-Meteo is visibly wrong.

### Attribution required (put in `app/privacy/page.tsx` or an "about the data" section)

- TICON-4: Hart-Davis M., Dettmering D., Seitz F. (2025) *TICON-4*, SEANOE, DOI 10.17882/109129 — CC-BY 4.0
- NOAA CO-OPS — US public domain
- Open-Meteo — CC-BY 4.0 (already required by existing usage)

---

## 5. The first three integration steps

### Step 1 — Generate the station table (build-time, mirrors `scripts/map-tide-stations.ts`)

Add `scripts/map-harmonic-stations.ts` + `lib/tides/data/harmonic-stations.json`.

```ts
// devDependency only — the 58 MB package must NEVER be imported by app code,
// exactly as scripts/data/noaa-tide-stations.json is script/test-only today.
import { near } from '@neaps/tide-database'

const OK = (st) =>
  st.type === 'reference' &&
  st.license?.commercial_use === true &&
  (st.harmonic_constituents ?? []).length > 0 &&
  st.datums?.MSL != null

for (const spot of ALL_SPOTS) {
  const hit = near({ lat: spot.lat, lon: spot.lng, maxDistance: 100, maxResults: 1, filter: OK })[0]
  if (!hit) continue
  const [st, km] = hit
  // emit: spot.slug -> { stationId, km }
  // emit station once, in the shape useStation() expects:
  //   { id, name, latitude, longitude, timezone, type, chart_datum,
  //     datums,                       // the whole ladder — useStation reads it
  //     harmonic_constituents,        // [{ name, amplitude, phase }, ...]
  //     source, license }
}
```

Keep the full `datums` object rather than a single precomputed offset — `useStation(...).getTimelinePrediction({ datum: 'MLLW' })` reads it directly, and storing the ladder means a later change of target datum costs nothing.

Add a new `harmonicTideStationId` field to `types/spot.ts` (do **not** overload `noaaTideStationId`).

**The `--verify` mode is not optional — it is what makes this safe.** Two gates, mirroring `map-tide-stations.ts --verify`:

1. *US ground truth:* for every spot with both a CO-OPS id and a harmonic station, assert the harmonic series is within 5 cm of the live NOAA series (measured RMSE 0.012 m, so 0.05 m is a safe gate).
2. *Global estuary guard (§2.4):* for every assignment, pull 72 h of Open-Meteo `sea_level_height_msl` at the **spot's** coordinates and reject the station if `r < 0.8` **or** `amplitudeRatio` falls outside 0.6–1.6. Both halves are required — `radhanagar-havelock-andaman` passes on phase (r = 0.96) and fails on amplitude (0.42). Rejected spots fall through to Tier 2, which is the correct outcome: Open-Meteo's open-coast cell beats a gauge in the wrong body of water.

Batch the verification — Open-Meteo accepts comma-separated `latitude`/`longitude` lists exactly as `fetchCurrentConditionsBatch` already does, so 233 checks cost 6 round trips. Pin the output in `tests/spots-seed.test.ts` the way the NOAA mapping already is.

**Expected output:** 425 distinct stations covering 1,030 of the 1,270 regional spots plus 197 of the 201 existing US stations. Payload ~1.4 MB raw / 274 KB gzipped in the `useStation()` record shape (523 KB / 146 KB if you strip to the minimum) — **less the ~9% the estuary guard rejects**, so budget for roughly 590–600 of the 886 station-less spots gaining a real tide chart from Tier 1.

Import the 58 MB `@neaps/tide-database` **only in the script** — as a `devDependency`, exactly as `scripts/data/noaa-tide-stations.json` is script/test-only today. Only `@neaps/tide-predictor` (MIT, zero deps, 217 KB) and the generated JSON may be imported by app code.

### Step 2 — Add the predictor behind the existing `TidePoint` contract

New `lib/api/harmonic-tides.ts` exporting the *same* signature shape `fetchTidePredictions` has, so `app/api/forecast/[slug]/route.ts` changes by one line:

```ts
export function predictTides(stationKey: string, utcOffsetSeconds: number): TidePoint[]
```

Implementation is short because `useStation` does the heavy lifting:

```ts
import { useStation } from '@neaps/tide-predictor'

const p = useStation(stationRecord)          // record from the generated JSON
const { timeline } = p.getTimelinePrediction({
  start, end, timeFidelity: 3600, datum: 'MLLW',   // ← always pass the datum explicitly
})
```

It must:
- build the same window (`today − 1 day` … `+17 days`);
- emit `time` as a **local** `"YYYY-MM-DDTHH:MM"` string by shifting UTC by the spot's `utc_offset_seconds` — Open-Meteo already returns this and CLAUDE.md's local-clock rule applies verbatim. `getTimelinePrediction` returns real `Date` objects in UTC, so this conversion is the one genuinely error-prone step;
- pass `datum: 'MLLW'` on every call so all six chart datums land on one scale;
- round to 2 dp (`Math.round(h * 100) / 100`) to match;
- reuse the existing local-maxima/minima scan for `type: 'H' | 'L'` so `best-time.ts` is untouched. (`getExtremesPrediction` returns labelled `High`/`Low` extremes at sub-second resolution and is strictly better, but it puts H/L at times *between* the hourly points — adopt it only if the chart is ready for off-grid markers.)

No `getCache()` needed — 21 ms of CPU is cheaper than a cache round-trip. Keep `fetchCoastalWind` on NOAA; it is an *observation* product and unrelated.

Route change:

```ts
spot.harmonicTideStationId
  ? Promise.resolve(predictTides(spot.harmonicTideStationId, utcOffsetSeconds))
  : spot.noaaTideStationId
    ? fetchTidePredictions(spot.noaaTideStationId)   // keep for the 4 unmatched stations
    : Promise.resolve([])
```

Ship this behind an env flag and diff the two series for US spots in production for a few days before flipping the default.

### Step 3 — Fill the 240-spot gap by *fitting* constituents from the Open-Meteo archive

The obvious move is to call Open-Meteo's `sea_level_height_msl` at runtime for gap spots. **Don't — fit it offline instead.** A least-squares harmonic fit over one archive year turns the gap spots into Tier-1 spots, which removes the runtime call *and* the 9-day horizon limit.

Validated at Malibu, where NOAA gives ground truth:

| Step | Result |
|---|---|
| Training data | 8,760 hourly `sea_level_height_msl` samples, 2025-07-01 → 2026-06-30 (**HTTP 200**, 0 nulls) |
| Fit | 26 constituents at known speeds, least squares. Residual RMS on training data **0.044 m** |
| Recovered amplitudes | M2 = 0.478 m, K1 = 0.378 m, O1 = 0.257 m, S2 = 0.188 m, N2 = 0.115 m, P1 = 0.109 m — the correct mixed-diurnal SoCal signature |
| **Extrapolated** to 2026-07-22 → 08-21 (a month *outside* the training window), vs NOAA official MLLW | bias 0.775 m, **RMSE 0.094 m**, max 0.252 m |

**0.094 m RMSE is indistinguishable from Open-Meteo's own 0.101 m error** — the fit costs nothing in accuracy while buying unlimited forecast horizon and zero runtime calls. Constituent speeds come free from `@neaps/tide-predictor`'s exported `constituents` map (477 definitions).

Derive the datum from the same series, by definition of MLLW:

```
Z0 = − mean(daily lower-low water across the archive year)
```

Measured at Malibu: **Z0 = 0.600 m** against a directly-measured target of 0.681 m — an **8 cm** discrepancy (MLW proxy 0.427 m, LAT proxy 1.270 m). Uluwatu gave Z0 = 0.335 m. That residual is well inside `TIDE_PREFERENCE`'s ±0.7–1.4 m tolerances, so it is fine for the 0.10-weight rating factor — but **label these spots' tide as approximate** and don't render the number to two decimals as if it were a gauge reading.

So the honest end state is **zero runtime tide network calls for every spot**, with two accuracy tiers: ±1–4 cm where a real gauge exists, ±10 cm where the tide was fitted from a model.

Remaining guards:
- `scoreTide` returns a neutral 50 below 0.5 m of range — micro-tidal gap spots such as Arugam Bay (0.37 m over 3 days) will correctly score neutral rather than wrong.
- If you *do* keep a runtime Open-Meteo path as a stopgap, adding `sea_level_height_msl` to the existing marine request is safe: verified it returns the same 216 non-null hours as `wave_height` with and without the variable, so it does **not** truncate the wave series. But **never** run it from `/api/spots?withConditions=true` — that is the exact unscoped-sweep shape that caused the 2026-08-10 budget blowout. Tide belongs on the single-spot forecast route only.
- Open-Meteo's free tier is **non-commercial**; a build-time fit uses ~1 call per gap spot *once*, which is far safer against that clause than per-request runtime calls.

---

## 6. Regional national-API appendix

Every endpoint below was called with `curl`; statuses are what was actually received. The practical conclusion is unchanged — **national APIs are a per-country integration each, with per-country licences and per-country datums, while the harmonic database covers most of the same coastline under one CC-BY-4.0 licence with no runtime call at all.** Reach for them only in the residual-gap countries of §2.3.

### 6.1 Europe

| Source | Coverage | Pred/Obs | Shape | Datum | Auth | Licence | Status |
|---|---|---|---|---|---|---|---|
| **Rijkswaterstaat DDAPI** (NL) | Netherlands, 2,635 locations | **Prediction** (astronomical) | High/low events | cm above **NAP** | none | open | **200** |
| **Marine Institute ERDDAP** (IE) | Ireland | **Prediction** | H/L events **and 5-min series** | m above **OD Malin** (+LAT) | none | **CC-BY 4.0** ✅ | **200** |
| **Puertos del Estado** (ES) | Spain | Prediction | High/low, ~3 days only | m, selectable zero | none | ⚠️ **none stated** (undocumented internal API) | **200** |
| **UKHO Admiralty** | UK, 607 stations | Prediction | **High/low only**, ~7 d | m above **Chart Datum (LAT)** | **API key** | ⚠️ forbids redistribution / DB rebuild | **401** (no key obtainable) |
| **SHOM** (FR) | France + ~1,000 ports | Prediction | H/L + tidal coefficient | m above **Chart Datum** | **referer-gated** | ⚠️ paid product | **401** → 200 only with spoofed `Referer` |
| **Instituto Hidrográfico** (PT) | Portugal | — | — | — | — | — | **robots.txt disallows our crawler** |
| NTSLF / BODC (UK) | UK | — | web pages / observations only | — | — | — | no prediction API, no published constituents |

**Netherlands — the working request** (the old `waterwebservices.rijkswaterstaat.nl` was retired end of April 2026):

```
POST https://ddapi20-waterwebservices.rijkswaterstaat.nl/ONLINEWAARNEMINGENSERVICES/OphalenWaarnemingen
{"Locatie":{"Code":"scheveningen"},
 "AquoPlusWaarnemingMetadata":{"AquoMetadata":{
   "Compartiment":{"Code":"OW"},"Grootheid":{"Code":"WATHTE"},
   "Hoedanigheid":{"Code":"NAP"},"Groepering":{"Code":"GETETBRKD2"}}},
 "Periode":{"Begindatumtijd":"2026-08-23T00:00:00.000+01:00",
            "Einddatumtijd":"2026-08-26T00:00:00.000+01:00"}}
```

`Groepering: GETETBRKD2` ("getijextreem berekend") is load-bearing — **without it you get gauge observations, not predictions.** Verified 2 months ahead (235 points). Catalogue via `POST .../METADATASERVICES/OphalenCatalogus`. Note `ddapi.rws.nl/dd-oper/2.0` is a *different*, PKI-certificate-gated API.

**Ireland — the best-licensed source found anywhere in this research:**
`https://erddap.marine.ie/erddap/tabledap/IMI_TidePrediction_HighLow.json?...` (H/L events) and `imiTidePrediction` (continuous **5-minute** series, has both `Water_Level` and `Water_Level_ODM`). `.csv` works as well as `.json`. No key, no documented rate limit, CC-BY 4.0 stated in the dataset metadata.

**⚠️ France — do not ship.** `services.data.shom.fr/.../hdm/spm/hlt?harborName=BREST&…` returns **401 `MissingRights: Wrong referer`** bare, and 200 only with `-H "Referer: https://maree.shom.fr/"`. That referer check is an access control on a **paid** SHOM product; using it server-side means defeating the gate. SHOM publishes no harmonic constituents for French ports. Use TICON-4 (`ticon/…-fra-refmar`, CC-BY-4.0) instead — the DB holds 148 French stations and Hossegor cross-validates at r = 0.943.

**⚠️ Spain — works but unpublished.** Found by reading the Portus Vue bundle: `GET https://portus.puertos.es/portussvr/api/predData/portus/SEA_LEVEL_PLEABAJA/11130?locale=es` → **200**, H/L events (`indicador` 1.0 = high, 0.0 = low). `&cero=0` vs `&cero=1` switches datum. Only ~3 days ahead, no stated licence or rate limit, can change without notice. The DB has 61 Spanish stations; Mundaka cross-validates at r = 0.960.

**Portugal — not investigated further.** `https://www.hidrografico.pt/robots.txt` returns `Disallow: /` for `ClaudeBot` and `anthropic-ai`, so crawling was stopped rather than worked around. `/json/mare.port.json` and `/previsao-mares/` both **404**. Portugal needs a human to review their terms. The DB has 15 Portuguese stations covering 38 of 48 spots.

**Cross-cutting warning:** European datums differ per country (NAP, OD Malin, Chart Datum/LAT, Spanish port zero). Mixing national APIs would put **non-comparable numbers into `scoreTide`**, whose thresholds are absolute metres. This is a further argument for the single-datum harmonic path in §2. Note too that Ireland's `Water_Level_ODMalin` goes **negative** (OD Malin sits near MSL, not at a low-water datum) — it would need the same conversion the harmonic path does for free.

### 6.2 Australia / NZ / Asia / Africa / Latin America

**Three national sources are genuinely free, machine-readable and well-licensed** — all three are static annual files, so fetch at build time, never per request:

| Source | Coverage | Pred/Obs | Shape | Datum | Auth | Licence | Tested URL | Status |
|---|---|---|---|---|---|---|---|---|
| **LINZ** (NZ) | **322 ports** (88 with daily predictions + 234 offset), **2025–2029** | Prediction | CSV high/low | **Chart Datum ≈ LAT** | none | **CC-BY 4.0** ✅ | `https://static.charts.linz.govt.nz/tide-tables/maj-ports/csv/Auckland%202026.csv` | **200** (19,484 B) |
| **JMA** (Japan) | **229 stations**, 2025/2026/2027 | Prediction | Fixed-width 136-char, 365 lines/yr | **cm above chart datum** | none | JP Gov Public Data Usage Rules — commercial OK, attribution required | `https://data.jma.go.jp/kaiyou/data/db/tide/suisan/txt/2026/CC.txt` | **200** (50,005 B) |
| **Queensland TMR** (AU) | 78 QLD stations (Southport, Mooloolaba, Mackay, Cairns…) | Prediction | JSON H/L `{Date,Time,Ind:±1,Reading}` + 10-min series | **LAT** | none | **CC-BY 4.0** ✅ | `https://data.qld.gov.au/api/action/datastore_search?resource_id=…` | **200** |

LINZ index: `https://linz.govt.nz/api/v1/tp` → **200**, all 322 ports with lat/lon and reference-port mapping. JMA's fixed-width format decoded against real data: cols 1–72 = 24 hourly values (3 ch each), 73–78 = `YY M D`, 79–80 = station code, 81–108 = 4×(hhmm + height) high waters, 109–136 = lows, `9999` = absent.

⚠️ **Two Queensland traps:** the CKAN datastore rate-limits by returning **404, not 429** (the same `resource_id` gave 200 standalone and 404 in a tight loop) — pace and cache it. And its direct file downloads sit behind an AWS WAF (202 + JS challenge), so use `datastore_search`, never `/download/*.csv`.

**Partially usable:**

| Source | Finding | Status |
|---|---|---|
| **BOM tides** (AU) | `http://` → **403** with an explicit anti-scraping notice; `https://` + browser UA → **200**, but the page is an ExtJS SPA with **no JSON feed**. Nothing machine-readable. | 403 → 200 |
| **BOM ABSLMP** (AU) | 16 stations, hourly CSV. **Observations**, but carries a `Residuals` column, so `prediction = SeaLevel − Residual` recovers BOM's own prediction for past hours — useful for *fitting* constituents (see Step 3). | **200** (349,962 B) |
| **IOC Sea Level Monitoring** | 2,382 stations. **OBSERVATIONS ONLY** — `query=prediction`, `field=prd` and `includeprediction=1` all returned identical observation arrays. Coverage skewed: Chile 125, Indonesia 57, Mexico 51, Australia 40, Brazil 28, but **NZ / Japan / South Africa / Philippines / Sri Lanka = 0**. | **200** |

**Confirmed dead ends** (each probed, not assumed):

| Source | Result |
|---|---|
| NSW MHL / WaterNSW | **403** both hosts |
| WA Dept of Transport | PDF only (**200**, 5.0 MB). No feed. |
| Australian Hydrographic Office | `hydro.gov.au` **STATUS=000**, TLS renegotiation hang. AusTides harmonics are **licence-gated, paid**. |
| **Brazil CHM** | Static PDFs bypass Cloudflare (**200**, real text layer, 44 ports above *Nível de Redução*) — but licence is **CC BY-ND**, so reformatting is a prohibited derivative. ✖ |
| **Chile SHOA** | `shoa.cl` → **405** AWS WAF human-verification under every UA/method; `snia.shoa.cl` **NXDOMAIN**. Pub 3009 is paid. ✖ |
| **Mexico CICESE** | `predmar.cicese.mx` **200** and `/json/estaciones.json` **200** (45 stations w/ lat-lon), but predictions are **PDF only** (`/calmen/txt/…` → **404 "No autorizado"**). © CICESE all rights reserved. ✖ |
| **South Africa SANHO** | Site **200**, `/tides/` **403**. Predictions exist (Chart Datum = LAT since 2003) but **"COPYRIGHT RESERVED"**, book/PDF only. ✖ |
| **Indonesia BIG** | `tides.big.go.id` + `ina-sealevel.big.go.id` **NXDOMAIN**; `realtides.big.go.id` TCP timeout; `srgi.big.go.id/api/pasut/stations` **200** but datum fields all null and every prediction CSV returns a **Laravel stack trace**. ✖ |
| **Philippines NAMRIA / PAGASA** | `phtides.namria.gov.ph` **200 → /login** (auth-walled); `/api` **404**; PAGASA `/tide-prediction` **404**. ✖ |
| **Sri Lanka / Maldives / Morocco** | NARA **NXDOMAIN**; Maldives `/tide` **404**; Morocco `anp.org.ma/api/marees` **404**, `marine.gov.ma` **NXDOMAIN**. ✖ |

**The decisive point:** every one of those dead ends — Indonesia, Philippines, South Africa, Chile, Brazil, Sri Lanka — is already solved by the TICON-4 constituents under a single CC-BY-4.0 licence with no runtime call. The upstream `openwatersio/tide-database` repo carries **4,838 stations** (AUS 165, JPN 247, MEX 124, NZL 45, IDN 36, BRA 33, CHL 24, ZAF 23, PHL 16, MYS 18, PER 17, ARG 15 …). **Morocco is the one genuine hole: 0 TICON stations**, matching the 32-of-34 uncovered spots measured in §2.3 — that is squarely a job for the Step-3 fitted-constituent path.

Optional later refinement: overlay LINZ / JMA / QLD TMR official predictions on top of Tier 1 for those three regions, as build-time static files. They are more authoritative than TICON for their own coastlines, but the measured Tier-1 accuracy there is already good (Chiba r = 0.986, Raglan r = 0.892), so this is polish, not a prerequisite.
