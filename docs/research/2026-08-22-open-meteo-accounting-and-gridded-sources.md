# WaveFinder — Free data source research: Open-Meteo accounting + non-per-location alternatives

Research date: **2026-08-22 / 2026-08-23 UTC**. All HTTP results below were obtained by
actually executing the requests from this machine (curl 8.18.0 / Node 24.14.1), not inferred.

Scope: WaveFinder is a free, non-commercial Next.js surf forecast app (~1,482 spots, ~1,192
distinct 0.05° conditions buckets) on Vercel. Its backbone is Open-Meteo Marine + Forecast.

---

## 0. TL;DR / decision table

| Source | Per-location billed? | Global? | Verdict |
|---|---|---|---|
| Open-Meteo Marine/Forecast (current backbone) | **YES — 1 call per location, hard floor** | Yes | **KEEP** as per-spot source; stop using it for whole-world sweeps |
| PacIOOS ERDDAP `ww3_global` (griddap JSON) | No — one request = whole grid | Yes | **ADOPT** for the world-map overview (see §4) |
| NOAA NOMADS GFS-wave GRIB filter | No | Yes | **SKIP/CONSIDER** — GRIB2 parsing on Vercel is the blocker (§4) |
| ECMWF Open Data | No | Yes | **SKIP** — GRIB2 + CCSDS packing (§4) |
| Copernicus Marine (CMEMS) | No | Yes | **SKIP** — auth + toolbox-centric (§4) |
| met.no Locationforecast / Oceanforecast | Per-location, but free & no key | Wind global / waves regional | **ADOPT as 429 fallback** (§5) |
| NDBC `latest_obs.txt` | No — one file, all buoys | US-centric | **CONSIDER** — observations, not forecast (§4/§5) |
| Stormglass / WorldTides / Surfline | Paid | — | **SKIP** (§5) |

**The single most important correction to WaveFinder's mental model:** the call cost is
`Σ_locations max(1, nVariables/10)`. The **floor of 1 per location is unconditional** — shrinking
`forecast_days` buys *nothing*, and shrinking the variable list below 10 buys nothing either.
The only way to make a world sweep affordable is to stop asking Open-Meteo for the world.

---

## 1. Open-Meteo call accounting — VERIFIED

### 1.1 The authoritative formula (from the open-source server itself)

The definitive answer is not in the docs — it is in the server source, which is the code that
actually runs on `api.open-meteo.com`.

**Source: `Sources/App/Helper/Writer/ForecastApiResult.swift`**
(https://raw.githubusercontent.com/open-meteo/open-meteo/main/Sources/App/Helper/Writer/ForecastApiResult.swift)

Quoted verbatim:

```swift
    /// Calculate excess weight of an API query. The following factors are considered:
    /// - 14 days of data are considered a weight of 1
    /// - 10 weather variables are a weight of 1
    /// - The number of dails and weather variables is scaled linearly afterwards. E.g. 15 weather variales, account for 1.5 weight.
    /// - Number of locations
    ///
    /// `weight = max(variables / 10, variables / 10 * days / 14) * locations`
    ///
    /// See: https://github.com/open-meteo/open-meteo/issues/438#issuecomment-1722945326
    func calculateQueryWeight() -> Float {
        let referenceDays = 14
        let referenceVariables = 10
        // Sum up weights for each location. Technically each location can have a different time interval
        return results.reduce(0, {
            let nDays = $1.time.range.durationSeconds / 86400
            let timeFraction = Float(nDays) / Float(referenceDays)
            let variablesFraction = Float(nVariablesTimesDomains) / Float(referenceVariables)
            let weight = max(variablesFraction, timeFraction * variablesFraction)
            return $0 + max(1, weight)
        })
    }
```

**Read the last two lines carefully — the doc comment understates the real behaviour:**

```
weight = Σ over locations of  max( 1 , max(V/10, (D/14)·(V/10)) )
```

where `V = nVariablesTimesDomains`, `D = days`.

Three consequences that matter enormously for WaveFinder:

1. **`max(1, …)` is a per-location floor.** Every location in a multi-location request costs
   **at least one full API call**, regardless of how few variables or how short the horizon.
   A 50-coordinate request can never cost less than 50 calls. WaveFinder's CLAUDE.md note
   ("Open-Meteo bills a multi-location request **per location**") is **correct**.
2. **`max(variablesFraction, timeFraction · variablesFraction)`** — since `timeFraction ≤ 1`
   for any request under 14 days, the left branch always wins. **Reducing `forecast_days`,
   `forecast_hours` or `past_days` below 14 days changes the cost by exactly zero.**
   (A user asked precisely this on the Open-Meteo newsletter: *"The nDays being 1 or 7 doesn't
   seem to affect the api call weight at all. Is this a bug?"* — it is not a bug, it is this `max`.)
   Above 14 days the time term takes over and cost scales linearly with duration.
3. **`nVariablesTimesDomains` counts variables × models.** From
   `Sources/App/Controllers/ForecastapiController.swift`:

```swift
let nVariables = (nParamsHourly + nParamsMinutely + nParamsCurrent + nParamsDaily) * domains.reduce(0, { $0 + $1.countEnsembleMember }) + nVariableNonEnsemble
```

   `hourly=`, `current=`, `minutely_15=` and `daily=` variables are counted **identically** —
   a `current=` variable is not cheaper than an `hourly=` one. And `models=a,b` **doubles** V.

### 1.2 What this means for WaveFinder's actual requests

From `lib/api/open-meteo.ts` → `fetchConditionsChunk`, per 50-coordinate chunk:

| Leg | Variables (V) | days (D) | weight/location | weight/chunk |
|---|---|---|---|---|
| Marine (`hourly=` 11 vars, `forecast_days=2`) | 11 | 2 | `max(1, max(1.1, 0.157)) = 1.1` | **55** |
| Weather (`current=` 2 vars) | 2 | ~0 | `max(1, 0.2) = 1.0` | **50** |
| **Total** | | | **2.1 / bucket** | **105** |

**A full 1,192-bucket sweep = 24 chunks × 105 = ~2,503 API calls.** This confirms the ~2,400
figure in the brief. Against the free budget that is:

- **600/min** → a full sweep needs ≥ **4.2 minutes** of pacing to not be shed;
- **5,000/hour** → **2 full sweeps per hour**, absolute ceiling;
- **10,000/day** → **~4 full sweeps per day**, for the entire planet's traffic combined.

### 1.3 Two free optimisations found while verifying this

**(a) Drop one marine variable → 9% off the marine leg, zero data loss.**
`fetchConditionsChunk` requests 11 hourly variables, including `wind_wave_direction`.
`parseCurrentConditions` reads `wind_wave_height` and `wind_wave_period` but **never reads
`wind_wave_direction`** (verified by reading the function — it is declared in the
`MarineCurrentEntry` interface but never dereferenced in the returned object).
Dropping it takes V from 11 → 10, so `V/10 = 1.0` and the per-location floor binds:
**1.1 → 1.0 per location, ~119 calls saved per sweep, no behaviour change.**

**(b) Add `wind_gusts_10m` (and `cloud_cover`) to the map's weather leg — literally free.**
The weather leg asks for 2 `current=` variables → `V/10 = 0.2` → the floor of 1 binds.
Going to 4 variables gives `V/10 = 0.4` → the floor *still* binds → **cost unchanged at 1.0**.
Verified that gusts are available in `current=`:

```
GET https://api.open-meteo.com/v1/forecast?latitude=34.035&longitude=-118.678
    &current=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,cloud_cover
    &wind_speed_unit=kmh&timezone=auto
HTTP 200
{"current_units":{...,"wind_gusts_10m":"km/h",...},
 "current":{"time":"2026-08-22T23:30","interval":900,"wind_speed_10m":4.0,
            "wind_direction_10m":153,"wind_gusts_10m":4.0,"temperature_2m":19.5,"cloud_cover":25}}
```

This matters because CLAUDE.md records that gusts *are* scored by the rating engine
(`GUST_WEIGHT` 0.4) but `merge.ts` deliberately passes `null` when the weather API had no gust
entry. The map path currently never supplies one, so the map rating never sees a measured gust.
**It can, at zero quota cost.**

### 1.4 Free-tier limits — verified in code AND on the pricing page

**Source: `Sources/App/Helper/Vapor/RateLimiter.swift`** — the defaults are the published limits:

```swift
    private static let limitDaily = Float(Environment.get("CALL_LIMIT_DAILY").flatMap(Int.init) ?? 10_000)
    static let limitHourly = Float(Environment.get("CALL_LIMIT_HOURLY").flatMap(Int.init) ?? 5_000)
    private static let limitMinutely = Float(Environment.get("CALL_LIMIT_MINUTELY").flatMap(Int.init) ?? 600)
    static let concurrencyLimit = Environment.get("CONCURRENCY_LIMIT").flatMap(Int.init) ?? 1
    static let concurrencyLimitHard = Environment.get("CONCURRENCY_LIMIT_HARD").flatMap(Int.init) ?? 5
    static let concurrencyLimitTotal = Environment.get("CONCURRENCY_LIMIT_TOTAL").flatMap(Int.init) ?? 4096
```

**Source: https://open-meteo.com/en/pricing** (fetched, HTTP 200, 47,947 bytes), verbatim from
the plan comparison table:

> Free / Open-Access API … Minutely Limit ⚠️ 600 calls / min … Hourly Limit ⚠️ 5.000 calls / hour
> … Daily Limit ⚠️ 10.000 calls / day … Monthly Limit ⚠️ 300.000 calls / month

And from the same page's FAQ, verbatim:

> **How is one API call defined?** Typically, one API call corresponds to one HTTP API request.
> However, if you select 200 weather variables simultaneously and make extensive use of the API,
> the number of API calls can increase. Requests for data covering more than 10 weather variables
> or extending over a period of more than 2 weeks for a single location are considered multiple
> API calls. To calculate the number of API calls accurately, fractional counts are used.
> For example, a request for 2 weeks of data with 15 weather variables will be calculated as
> 1.5 API calls, while 4 weeks of data equals 3.0 API calls. This distinction is crucial for
> developing future features such as APIs for multiple locations simultaneously.
> A request with the parameters selected below will cost 1.0 API call

> **What sets apart the free API from the customer API?** The free API is for non-commercial use,
> rate-limited to 10,000 calls/day, and carries no uptime guarantee. The customer API runs on
> dedicated servers, has no daily rate limit, and [includes a commercial use licence].

Note the pricing FAQ's own cost calculator has a **Locations** input, and the official newsletter
post *Weather Data for Multiple Locations At Once*
(https://openmeteo.substack.com/p/weather-data-for-multiple-locations) states the formula as
`weight = nLocations * (nDays / 14) * (nVariables / 10)` — which omits the `max(1, …)` floor and
the `max(V/10, …)` branch. **The source code above is the accurate version; the newsletter is not.**

**Maximum locations per request** (`Sources/App/configure.swift`):

```swift
    /// Maximum number of locations for multi point requests
    static let numberOfLocationsMaximum: Int = {
        return (Environment.get("LOCATIONS_LIMIT").map(Int.init) ?? 1000) ?? 1000
    }()
```
→ **1,000 coordinates per request** (error message: `"Only up to 1000 locations can be requested at once"`).
WaveFinder's `BATCH_COORDS = 50` is far under the cap; raising it reduces HTTP overhead but
**does not reduce quota cost at all**, since cost is per location.

There is also a hard rejection for oversized single requests
(`Sources/App/Helper/Vapor/ApiKeyManager.swift`):

```swift
                guard weight <= RateLimiter.limitHourly else {
                    throw ForecastApiError.generic(message: "Your API call requests too much data. Please reduce the number of variables, locations and/or weather models.")
                }
```

### 1.5 Are the limits per IP? — YES, verified

`RateLimiter.swift` header comment, verbatim:

```swift
/**
 Limit API request rate for the free API.
 Count how many calls have been made by a given IP address.
 */
```

Counters are keyed on the raw IPv4 address (`socket.address.sin_addr.s_addr`) or a hash of the
IPv6 address, held in in-memory dictionaries (`dailyPerIPv4`, `hourlyPerIPv4`, `minutelyPerIPv4`, …).
The one exception (`ApiKeyManager.swift`):

```swift
            /// For CloudFlare worker applications, use the `CF-Worker` header for rate limiting instead of IP address
            let isCFWorker = RateLimiter.cloudFlareWorkerIPs.contains(address)
```

**Two operational consequences for a Vercel deployment:**

- Vercel serverless functions egress from a **shared, rotating pool of IPs**. That means
  (a) WaveFinder's quota can be consumed by *other Vercel tenants* hitting Open-Meteo from the
  same egress IP, and (b) WaveFinder's own budget is spread unpredictably across several IPs.
  This is a strong explanation for erratic, non-reproducible 429s.
- The counters are **per server process, in memory** (`RateLimiter.instance` is an actor with plain
  dictionaries; there is no shared store). Open-Meteo runs multiple API instances behind a load
  balancer, so shedding is **probabilistic and partial**, not a clean cutoff — exactly the
  "11 of 24 chunks rejected" pattern recorded in WaveFinder's source comments.

### 1.6 The 429 bodies — which is which (verified in code and live)

`RateLimiter.swift`, verbatim:

```swift
enum RateLimitError: Error, AbortError {
    case dailyExceeded
    case hourlyExceeded
    case minutelyExceeded
    case tooManyConcurrentRequests
    case serviceOverloaded

    var status: NIOHTTP1.HTTPResponseStatus {
        switch self {
        case .serviceOverloaded:
            return .serviceUnavailable
        default:
            return .tooManyRequests
        }
    }

    var reason: String {
        switch self {
        case .dailyExceeded:
            return "Daily API request limit exceeded. Please try again tomorrow."
        case .hourlyExceeded:
            return "Hourly API request limit exceeded. Please try again in the next hour."
        case .minutelyExceeded:
            return "Minutely API request limit exceeded. Please try again in one minute."
        case .tooManyConcurrentRequests:
            return "Too many concurrent requests"
        case .serviceOverloaded:
            return "The service is overloaded"
        }
    }
}
```

| Body `reason` | HTTP | Cause | Correct client action |
|---|---|---|---|
| `Minutely API request limit exceeded. Please try again in one minute.` | 429 | >600 weight in the current minute for this IP | back off ~60 s; **retrying in <1 s is pointless** |
| `Hourly API request limit exceeded. Please try again in the next hour.` | 429 | >5,000 weight this hour | serve stale; do not retry this hour |
| `Daily API request limit exceeded. Please try again tomorrow.` | 429 | >10,000 weight today | serve stale for the rest of the day |
| `Too many concurrent requests` | 429 | ≥5 simultaneous in-flight requests from this IP | **reduce concurrency**, short retry is appropriate |
| `The service is overloaded` | **503** | global `requestsRunning > 4096` | short retry |

### 1.7 EMPIRICAL PROOF of per-location billing

This is the decisive test. 40 concurrent requests, **each carrying 50 coordinates**, one variable,
one day — i.e. the cheapest possible per-location request:

```
GET https://marine-api.open-meteo.com/v1/marine?latitude=<50 lats>&longitude=<50 lons>
    &hourly=wave_height&forecast_days=1                      ×40 concurrent
```

Result — statuses in completion order:

```
429 429 429 429 429 429 429 429 429 429 429 429 429 429 429 429 429 200 429 200
200 429 200 200 200 200 429 200 200 200 429 429 429 429 429 429 429 200 429 200
```

**Exactly 12 requests returned 200; 28 returned 429.** `12 × 50 locations = 600` — precisely the
documented minutely limit. Error body of every 429, verbatim:

```json
{"error":true,"reason":"Minutely API request limit exceeded. Please try again in one minute."}
```

A repeat run with 16 concurrent × 50 coordinates gave the same answer: **12 × 200, 4 × 429**
(again 12 × 50 = 600).

**Conclusion: one coordinate in a multi-location request consumes one full unit of the 600/min
budget.** Batching coordinates saves HTTP round trips and latency; it saves **zero** quota.
Note also that a low-variable, single-day request was *not* cheaper than 1 — direct confirmation
of the `max(1, …)` floor.

A separate control test — 12 concurrent **single-location** requests — returned **12 × HTTP 200**
with no shedding, confirming the concurrency limiter in production is more permissive than the
code's `CONCURRENCY_LIMIT_HARD ?? 5` default (env-overridden in prod), and that the shedding above
was quota, not concurrency.

### 1.8 Request lifecycle (why a failed request still costs you)

`ApiKeyManager.swift`, verbatim excerpt:

```swift
            } catch {
                // In an error case, also increment to API rate limiter by 1
                // Some users do infinite retries on errors!
                ...
                await RateLimiter.instance.increment(address: address, count: 1)
```

**Every error response still bills 1 call.** WaveFinder's `fetchJson` retries a 429 up to
`RATE_LIMIT_ATTEMPTS = 3` times — each rejected attempt costs another call, and with a
`RATE_LIMIT_BACKOFF_MS` of 400/800 ms the retries land inside the *same* rejected minute for a
`minutelyExceeded`. **Recommendation: parse the `reason` string and only retry
`Too many concurrent requests`; treat the three limit-exceeded reasons as terminal for this
request and go straight to the stale-if-error copy.** (The code already reads the body for a
200-with-error-body case in `fetchWindForecast`; the same guard is missing on the 429 path.)

### RECOMMENDATION — §1

- **ADOPT** the two zero-cost wins in §1.3: drop `wind_wave_direction` (−9% marine leg),
  add `wind_gusts_10m` + `cloud_cover` to the map weather leg (free, improves rating quality).
- **ADOPT** reason-aware 429 handling (§1.8) — the current blind 3× retry actively wastes quota.
- **ADOPT** the finding that `forecast_days` tuning is worthless below 14 days; don't spend
  effort there.
- **KEEP** Open-Meteo for per-spot forecast pages (`/api/forecast/[slug]`), where 1 spot = ~2 calls
  is entirely reasonable. **Stop** trying to make the world map affordable on it — §4 is the fix.

---

## 2. Open-Meteo Marine API — variables, models, and the tide question

### 2.1 Variable reality check (tested, not assumed)

**Test — Malibu (34.035, −118.678), every variable of interest, `forecast_days=1`:**

```
GET https://marine-api.open-meteo.com/v1/marine?latitude=34.035&longitude=-118.678
    &hourly=wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,
      swell_wave_direction,swell_wave_peak_period,secondary_swell_wave_height,
      secondary_swell_wave_period,secondary_swell_wave_direction,tertiary_swell_wave_height,
      wind_wave_height,wind_wave_period,wind_wave_peak_period,sea_surface_temperature,
      sea_level_height_msl,ocean_current_velocity,ocean_current_direction
    &forecast_days=1&timezone=auto
→ HTTP 200
```

Real response (abridged), grid point returned `33.958336, -118.70833`:

```json
"hourly_units":{"swell_wave_peak_period":"undefined","tertiary_swell_wave_height":"undefined",
                "wind_wave_peak_period":"undefined","sea_level_height_msl":"m",
                "ocean_current_velocity":"km/h","sea_surface_temperature":"°C"},
"wave_height":[0.74,0.74,0.76,...],
"swell_wave_height":[0.60,0.60,0.62,...],
"swell_wave_period":[12.45,12.55,12.60,...],
"swell_wave_peak_period":[null,null,null,... all 24 null],
"secondary_swell_wave_height":[0.36,0.40,0.42,...],
"secondary_swell_wave_period":[4.45,4.35,4.40,...],
"tertiary_swell_wave_height":[null,... all 24 null],
"sea_surface_temperature":[22.5,22.5,22.4,...],
"sea_level_height_msl":[-0.43,-0.48,-0.42,-0.28,-0.10,0.09,0.26,0.36,0.40,...],
"ocean_current_velocity":[0.6,0.6,0.6,...],
"ocean_current_direction":[252,252,288,...]
```

Note the `"undefined"` unit string: Open-Meteo emits that for a variable it accepted but for which
the selected model carries no data. **It is not an error and it does not cost less.**

| Variable | Real? | Verified behaviour |
|---|---|---|
| `swell_wave_peak_period` | **Yes, but regionally** | null on `best_match` in the Americas/Asia/Oceania; **real in Europe** — see §2.3 |
| `secondary_swell_wave_*` | **Yes** | Present at Malibu and Hossegor on `best_match`. Not available on `ewam`/`gwam`/`ecmwf_wam025` |
| `tertiary_swell_wave_*` | Yes, GFS-wave only | null on `best_match` at Malibu. Docs: *"Tertiary components are only available for the GFS wave models."* |
| `sea_level_height_msl` | **Yes, and truly global** | 24/24 non-null at all 9 spots tested worldwide (§2.4) |
| `sea_surface_temperature` | **Yes, global** | 24/24 at all 9 spots |
| `ocean_current_velocity` / `_direction` | **Yes, global** | 24/24 at all 9 spots |
| `wind_wave_peak_period` | Yes, regionally | null at Malibu on `best_match` |
| `invert_barometer_height` | Yes | documented; the surge component of `sea_level_height_msl` |

### 2.2 `models=` — tested availability matrix

**Test — Malibu, `hourly=wave_height,swell_wave_height,swell_wave_period,swell_wave_peak_period,secondary_swell_wave_height`, per model.** Counts are non-null hours out of 24:

| `models=` | HTTP | wave_h | swell_h | swell_T | **peak_T** | **2nd swell** | first wave_h |
|---|---|---|---|---|---|---|---|
| `best_match` | 200 | 24 | 24 | 24 | **0** | **24** | 0.72 |
| `ewam` | 200 | — | — | — | — | — | `{"error":true,"reason":"No data is available for this location"}` |
| `gwam` | 200 | 24 | 24 | 24 | **24** | 0 | 1.02 |
| `ncep_gfswave025` | 200 | 24 | 24 | 24 | 0 | 24 | 0.56 |
| `ncep_gfswave016` | 200 | 24 | 24 | 24 | 0 | 24 | 0.40 |
| `meteofrance_wave` | 200 | 24 | 24 | 24 | 0 | 24 | **0.72** |
| `ecmwf_wam025` | 200 | 24 | **0** | **0** | 0 | 0 | 0.72 |
| `era5_ocean` | 200 | **0** | 0 | 0 | 0 | 0 | — |

**`best_match` at Malibu is byte-identical to `meteofrance_wave`** (0.72 / 0.58 / 12.5 / 0.28 and
the same grid point 33.958336, −118.70833).

**Test — Hossegor (43.66, −1.44), same variables:**

| `models=` | grid point returned | wave_h | **peak_T** | **2nd swell** |
|---|---|---|---|---|
| `best_match` | 43.625, −1.4583282 | 0.80 | **8.40 (24/24)** | **0.06 (24/24)** |
| `ewam` | 43.65, −1.5 | 0.78 | 8.40 | 0 |
| `gwam` | 43.75, −1.5 | 0.80 | 8.40 | 0 |
| `meteofrance_wave` | 43.625, −1.4583282 | 0.80 | **0** | 0.06 |
| `ncep_gfswave025` | 43.75, −1.5 | 0.96 | 0 | 0 (all zeros) |

**Key structural finding: `best_match` is a per-variable blend, not a single model.**
At Hossegor it serves MeteoFrance MFWAM's grid point and secondary-swell partition **while
filling `swell_wave_peak_period` from EWAM**, which MeteoFrance does not carry. At Malibu, where
EWAM (Europe-only) has no coverage, the peak period simply falls through to null.

This **corrects the note in WaveFinder's CLAUDE.md** ("`swell_wave_peak_period` exists but returns
null on best_match"): it is null on `best_match` *outside Europe*, and populated *inside* Europe.
Any code that assumes it is uniformly null will silently mis-handle European spots — and,
conversely, the rating engine's "period thresholds are for a MEAN period (Tm ≈ 0.8–0.85·Tp)"
calibration is correct only because the engine reads `swell_wave_period`, not the peak. Keep it
that way; do not opportunistically switch to peak period where it happens to exist, or European
spots would be scored on a different quantity than everywhere else.

**Model catalogue** (source: https://open-meteo.com/en/docs/marine-weather-api):

| Model | `models=` id | Resolution | Temporal | Coverage | Update |
|---|---|---|---|---|---|
| MeteoFrance MFWAM | `meteofrance_wave` | 0.08° (~8 km) | 3-hourly | Global | 12 h |
| MeteoFrance SMOC (currents, tides) | — (backs `ocean_current_*`, `sea_level_height_msl`) | 0.08° (~8 km) | Hourly | Global | 24 h |
| ECMWF WAM | `ecmwf_wam` | 9 km | Hourly | Global | 6 h |
| ECMWF WAM 0.25 | `ecmwf_wam025` | 0.25° (~25 km) | 3-hourly | Global | 6 h |
| NCEP GFS Wave 0.25° | `ncep_gfswave025` | 0.25° (~25 km) | Hourly | Global | 6 h |
| NCEP GFS Wave 0.16° | `ncep_gfswave016` | 0.16° (~16 km) | Hourly | **52.5°N–15°S only** | 6 h |
| DWD EWAM | `ewam` | **0.05° (~5 km)** | Hourly | **Europe only** | 12 h |
| DWD GWAM | `gwam` | 0.25° (~25 km) | Hourly | Global | 12 h |
| ERA5-Ocean | `era5_ocean` | 0.5° (~50 km) | Hourly | Global | daily, **5-day delay** |

**Best for nearshore surf:** `best_match` already is. It selects the **0.08° (~8 km) MeteoFrance
MFWAM** globally — the finest global wave grid Open-Meteo carries — and upgrades to the
**0.05° (~5 km) DWD EWAM** in Europe for fields MFWAM lacks. Nothing you can select manually beats
it: `gwam`, `ecmwf_wam025` and `ncep_gfswave025` are all 3× coarser and `ncep_gfswave016` has no
coverage south of 15°S (i.e. no Australia, no most of Indonesia, no South Africa, no Chile/Peru).
`era5_ocean` is a 5-day-delayed reanalysis and returned **all nulls** for a forecast window.

**This also validates WaveFinder's 0.05° conditions bucketing.** CLAUDE.md reasons that
"Open-Meteo's marine grid is ~0.04°" — the real number is **0.08° (MFWAM)** globally, 0.05° in
Europe. So 0.05° buckets are already at or finer than the upstream grid worldwide, and the
CLAUDE.md conclusion ("going finer than the upstream grid buys nothing") holds a fortiori.

**Tested: widening the buckets is NOT a useful lever — negative result.** I extracted every
`lat:`/`lng:` pair from `lib/spots/*.ts` (1,270 coordinates recovered by regex; an undercount of
the full dataset, but the *ratios* are what matter) and recomputed
`Math.round(lat/d) + ',' + Math.round(lng/d)` bucket counts:

```
bucket 0.050deg ->  1056 buckets   sweep@2.1/bucket = 2218 calls
bucket 0.060deg ->  1034 buckets   sweep = 2171
bucket 0.080deg ->   992 buckets   sweep = 2083     (-6% vs 0.05°)
bucket 0.100deg ->   958 buckets   sweep = 2012
bucket 0.125deg ->   899 buckets   sweep = 1888
bucket 0.150deg ->   870 buckets   sweep = 1827
bucket 0.250deg ->   772 buckets   sweep = 1621     (-27%, at 5x coarser than the model grid)
```

Surf spots lie strung along coastlines rather than clustered in blobs, so coarsening the grid
merges very few of them. Going 0.05° → 0.08° saves **6%**; even a reckless 0.25° saves only 27%
while throwing away real model resolution and re-introducing the "spot served a neighbour's
reading 11 km away" defect that the 0.1° → 0.05° change was made to fix.
**Do not pursue bucket widening — it cannot close a 5–20× gap.**

### 2.3 Does asking for a specific model change the cost? — NO for one model, YES for several

From `nVariables = (…) * domains.reduce(0, { $0 + $1.countEnsembleMember })` (§1.1):
- `models=` omitted, or one model → **1 domain** → cost identical to `best_match`.
- `models=a,b` → **2 domains** → **V doubles**, and the response splits into suffixed columns.

Verified live:

```
GET https://api.open-meteo.com/v1/forecast?latitude=43.66&longitude=-1.44
    &hourly=wind_speed_10m&models=gfs_seamless,ecmwf_ifs025&forecast_days=1
→ HTTP 200
hourly keys: [ 'time', 'wind_speed_10m_gfs_seamless', 'wind_speed_10m_ecmwf_ifs025' ]
```

**Direct implication for `fetchMarineForecast`:** it currently issues the `best_match` request and
the `ecmwf_wam025` long-range request as **two separate HTTP calls**. Cost today:
primary 13 vars → 1.3, long-range 3 vars → floor 1.0, `forecast_days=16` → `D/14 = 1.14`, so
`max(1.3, 1.14·1.3)=1.49` and `max(1, 1.14·0.3)=1.0` → **~2.5 calls per spot page.**
Merging them into one `models=best_match,ecmwf_wam025` request would give V = 16·2 = 32 →
`max(3.2, 1.14·3.2) = 3.65` → **worse**. **Keep them as two requests.** (Useful negative result.)

### 2.4 `sea_level_height_msl` as a global tide source — TESTED

**Docs, verbatim** (https://open-meteo.com/en/docs/marine-weather-api): the variable
*"accounts for ocean tides, the inverted barometer effect, sea surface height, global mean steric
variation, and global mean mass volume variation"*. On the datum: the reference is
*"the global mean sea level, not the lowest astronomical tide."* On coverage:
*"Accuracy is limited in coastal areas—while it can be reasonably accurate near unobstructed
coasts, it may be completely unreliable further inland."*

**Global coverage test — 9 spots on 6 continents, `forecast_days=1`, non-null hours / 24:**

```
Malibu            HTTP200 msl=24  rng -0.48..0.95 = 1.43m   sst=24 curr=24 peakT=0
Hossegor          HTTP200 msl=24  rng -1.12..0.42 = 1.54m   sst=24 curr=24 peakT=24
Uluwatu Bali      HTTP200 msl=24  rng -0.06..0.77 = 0.83m   sst=24 curr=24 peakT=0
Pipeline Oahu     HTTP200 msl=24  rng  0.35..0.85 = 0.50m   sst=24 curr=24 peakT=0
Jeffreys Bay ZA   HTTP200 msl=24  rng -0.61..-0.08 = 0.53m  sst=24 curr=24 peakT=0
Nazare PT         HTTP200 msl=24  rng -0.90..0.29 = 1.19m   sst=24 curr=24 peakT=24
Gold Coast AU     HTTP200 msl=24  rng -0.22..0.83 = 1.05m   sst=24 curr=24 peakT=0
Chicama PE        HTTP200 msl=24  rng -0.03..0.55 = 0.58m   sst=24 curr=24 peakT=0
Thurso Scotland   HTTP200 msl=24  rng -1.06..0.32 = 1.38m   sst=24 curr=24 peakT=24
```

**Coverage is genuinely global — 9/9 spots, no nulls, no gaps.** The semidiurnal signal is clearly
present and the magnitudes are physically plausible (Hawaii's microtidal ~0.5 m; European Atlantic
1.2–1.5 m on what is evidently a neap).

**But it is NOT a drop-in replacement for WaveFinder's NOAA CO-OPS tide predictions, for one
decisive reason: the datum.**

CLAUDE.md is explicit that *"Tide is scored in metres of water, not rank within the day's range …
a reef sits at a fixed depth below datum, so it needs an absolute amount of water over it."*
`fetchTidePredictions` queries CO-OPS in **MLLW**, where values are ~0 → +2 m. `sea_level_height_msl`
is referenced to **mean sea level**, so the same tide reads ~−1 → +1 m. Feeding MSL values into a
tide factor calibrated on MLLW metres would shift every spot's "water over the reef" by roughly
half the local tidal range — systematically rating low tide as far shallower than it is. It would
be the same class of bug the rank-scoring rewrite was done to eliminate.

Secondary caveats: it is an ~8 km global ocean model, so it will understate range in estuaries,
bays and resonant systems (Bay of Fundy, Bristol Channel, NW Australia), and the docs themselves
warn accuracy "is limited in coastal areas".

### 2.5 The `bounding_box=` parameter — an escape hatch that isn't (tested)

Open-Meteo has an undocumented-on-the-main-docs-page `bounding_box=south,west,north,east` mode
(`Sources/App/Controllers/ForecastapiController.swift`, `case .boundingBox`). It looks like exactly
the "one request, whole grid" primitive WaveFinder needs. **It is not.**

```
GET https://marine-api.open-meteo.com/v1/marine?bounding_box=33.9,-118.9,34.1,-118.5
    &hourly=wave_height&forecast_days=1
→ HTTP 400  {"error":true,"reason":"Bounding box calls not supported for domain marine_best_match"}

GET .../marine?bounding_box=33.9,-118.9,34.1,-118.5&hourly=wave_height&forecast_days=1&models=gwam
→ HTTP 200, 0 bytes  (no sea cells at gwam's 0.25° grid inside that box)

GET .../marine?bounding_box=20,-130,40,-110&hourly=wave_height&forecast_days=1&models=gwam
→ HTTP 400  {"error":true,"reason":"Only up to 1000 locations can be requested at once"}
```

Three disqualifying properties:

1. **Not supported on `best_match`** — you must pin an explicit model, giving up the MFWAM/EWAM
   blend that makes Open-Meteo's marine data good (§2.2).
2. **Hard-capped at 1,000 grid cells.** A 20°×20° box at 0.25° is 6,400 cells and is rejected.
   The whole ocean at 0.25° is ~1,036,800 cells — three orders of magnitude over the cap.
3. **Still billed per grid cell.** In the source, each grid point becomes its own entry in the
   `locations` array, and `calculateQueryWeight()` reduces over exactly that array. A bounding box
   is billed identically to listing those coordinates by hand — and worse in practice, because you
   pay for every land and open-ocean cell in the box, not just the ~1,192 you care about.

**SKIP.** There is no per-request (as opposed to per-location) pricing anywhere in Open-Meteo's
free API. The gridded answer has to come from somewhere else — §4.

**RECOMMENDATION — §2**

- **SKIP** switching the primary tide source. Keep NOAA CO-OPS (MLLW, harmonic, station-accurate)
  wherever a reference station exists.
- **CONSIDER** `sea_level_height_msl` as the **fallback tide for the ~two-thirds of spots that have
  no CO-OPS reference station within 75 km** (per `scripts/map-tide-stations.ts`), which today get
  no tide factor at all and rely on weight renormalisation. It costs **zero extra quota** if total
  marine variables stay ≤ 10. It must be **datum-shifted before scoring** — the tractable approach
  is to add a per-spot constant ≈ half the local mean tidal range (derivable from a 30-day
  `sea_level_height_msl` series computed once, offline, and stored in the seed like the tide-station
  mapping already is). Do **not** feed raw MSL metres into `scoreTide`.
- **ADOPT** `sea_surface_temperature` for global water temp (already fetched in
  `fetchMarineForecast`) — it is global and reliable.
- **SKIP** `ocean_current_*` for surf scoring — docs: *"Accuracy at coastal areas is limited.
  This is not suitable for coastal navigation."*
- **ADOPT** the correction that `swell_wave_peak_period` is Europe-populated, not universally null.
- **SKIP** widening conditions buckets. Measured: 0.05° → 0.08° saves only 6% of buckets, and even
  0.25° saves 27% while destroying resolution. Keep 0.05°.

---

## 3. Open-Meteo Forecast API — coastal wind

### 3.1 Tested model comparison at two coastal points

**Malibu (34.035, −118.678), `current=wind_speed_10m,wind_direction_10m,wind_gusts_10m`, km/h:**

```
best_match             elev=0  grid 34.027634,-118.69173   spd=4.0  dir=153  gust=4.0
gfs_seamless           elev=0  grid 34.027634,-118.69173   spd=4.0  dir=153  gust=4.0
gfs_global             elev=0  grid 34.03189,-118.71094    spd=2.6  dir=106  gust=5.4
ecmwf_ifs025           elev=0  grid 34,-118.75             spd=3.0  dir=76   gust=6.1
ecmwf_aifs025          elev=0  grid 34,-118.75             spd=null dir=null gust=null
icon_seamless          elev=0  grid 34,-118.625            spd=3.2  dir=63   gust=8.6
meteofrance_seamless   elev=0  grid 34,-118.75             spd=2.9  dir=180  gust=7.2
jma_seamless           elev=0  grid 34,-118.5              spd=2.3  dir=162  gust=null
gem_seamless           elev=0  grid 34.08146,-118.75577    spd=3.6  dir=35   gust=3.6
ukmo_seamless          elev=0  grid 34.03125,-118.6875     spd=2.9  dir=119  gust=5.0
```

**Hossegor (43.66, −1.44):**

```
best_match             elev=10 grid 43.66,-1.4400005       spd=20.0 dir=98  gust=28.4
meteofrance_seamless   elev=10 grid 43.66,-1.4400005       spd=19.0 dir=100 gust=28.8
icon_seamless          elev=10 grid 43.625,-1.4375         spd=10.1 dir=92  gust=20.5
ecmwf_ifs025           elev=10 grid 43.5,-1.5              spd=11.9 dir=88  gust=25.6
gfs_seamless           elev=10 grid 43.638138,-1.40625     spd=9.1  dir=83  gust=25.9
icon_d2                — {"error":true,"reason":"No data is available for this location"}
```

### 3.2 Findings

- **`best_match` is already the correct choice and should not be overridden.** At Malibu it
  resolves to `gfs_seamless` → HRRR at a ~3 km grid point (34.027634, −118.69173). At Hossegor it
  resolves to `meteofrance_seamless` → AROME at a **~1.3 km** grid point that matches the request
  coordinate almost exactly.
- **The resolution difference is not cosmetic.** At Hossegor, 1 km AROME reports **20.0 km/h**
  where 25 km GFS/ECMWF report **9.1–11.9 km/h**. That is the difference between "light onshore,
  ridable" and "blown out" — a two-band swing in WaveFinder's speed-gated wind factor. Pinning a
  global `models=` value would degrade exactly the coastal gradients the rating engine cares about.
- **Grid-point proximity ranking near a coast** (Malibu): `gfs_seamless`/HRRR ≈ `ukmo_seamless`
  (~0.03°) ≫ `icon_seamless` (0.125°) ≈ `ecmwf_ifs025`/`meteofrance_seamless` (0.25°) —
  a coarse grid on a coastline frequently samples a **land** cell, which is why direction varies by
  up to 145° between models at the same point.
- **`wind_gusts_10m` is available in `current=`** (verified, §1.3) but is **null on `jma_seamless`**
  and `ecmwf_aifs025` returned **null for all wind fields** — do not select those explicitly.
- **Cost of `models=`:** selecting one model costs the same as `best_match`; selecting N models
  multiplies the variable count by N (§2.3). Since `best_match` is also the best answer, there is
  no reason to set it at all.

### RECOMMENDATION — §3

- **KEEP `best_match`** (i.e. keep omitting `models=`) for wind. It is both free and best.
- **ADOPT** adding `wind_gusts_10m` and `cloud_cover` to the map's `current=` leg — zero quota cost,
  and it feeds `GUST_WEIGHT` and the UV cloud attenuation that the engine already implements.
- **SKIP** any per-region model pinning; it would be a strict downgrade.

---

## 4. Gridded alternatives — one HTTP request, no per-location billing

### 4.1 PacIOOS ERDDAP `ww3_global` — **ADOPT** (the answer for the world map)

**Base:** `https://pae-paha.pacioos.hawaii.edu/erddap/griddap/ww3_global`
**Seam-free alias:** `https://pae-paha.pacioos.hawaii.edu/erddap/griddap/ww3_global_lon180`

This is a **WaveWatch III global run hosted by PacIOOS (University of Hawaii), served as plain
JSON or CSV over griddap. No GRIB parsing, no API key, no registration, no per-location billing.**

**Grid** (from `.dds`): `time x depth(1) x latitude(311, -77.5..77.5, 0.5deg) x longitude(720, 0..359.5, 0.5deg)`.
**Horizon:** 5-day hourly forecast, GFS-wind-forced. Verified live: `(last)` resolved to
**2026-08-29T18:00Z**, i.e. 7 days ahead of the test date — genuinely forward-looking forecast data,
not a hindcast.

**Variables — full partitioning, not just bulk Hs** (from `.das`):

| Group | Variables |
|---|---|
| Combined sea | `Thgt` (sig. wave height, m), `Tper` (peak period, s), `Tdir` (peak direction, deg) |
| **Swell partition** | `shgt`, `sper`, `sdir` |
| **Wind-wave partition** | `whgt`, `wper`, `wdir` |

That partition split is exactly what WaveFinder's rating engine needs — it scores the swell
partition and derives cleanliness from the wind-wave share, and refuses to score the combined sea.

**License** (verbatim, `NC_GLOBAL.license` in `.das`):
> "The data may be used and redistributed for free but is not intended for legal use... no warranty..."

Free redistribution, PacIOOS/NOAA attribution appreciated. No documented hard request-rate limit.

**Tested requests (real, live):**

| Request | Status | Size | Time |
|---|---|---|---|
| Whole globe, full res, 1 var — `Thgt[(last)][0][0:310][0:719]` | 200 | **11,848,278 B (11.3 MB)** | **>120 s** (too slow) |
| Global, stride 4 (2 deg), 1 var | 200 | 742,952 B | 14.6 s |
| Global, stride 4, 3 vars combined | 200 | 942,120 B (JSON) / 761,821 B (CSV) | 18.8 s / 17.2 s |
| Global, stride 8 (4 deg), 3 vars | 200 | 235,725 B | 6.5 s |
| **W. North America box (25-60N, -145..-115), 3 vars, FULL res** | **200** | **297,331 B** | **9.8 s** |
| **Europe box (35-62N, -20..5) via `lon180`, 3 vars, FULL res** | **200** | **186,125 B** | **9.0 s** |
| Australia/NZ box (-45..-10, 110-180), 3 vars, full res | 200 | 685,259 B | 18.9 s |
| S. America box (-40..12, 275-320), 3 vars, full res | 200 | 632,355 B | 16.0 s |
| Small CA box (30-40N, 235-245E), 1 var, full res | 200 | 23,468 B | 4.2 s |

Real response body (note land cells are `null` **in place** — correctly indexed, unlike the GRIB path):

```json
{"table":{"columnNames":["time","depth","latitude","longitude","Thgt","Tper","Tdir"],
 "columnUnits":["UTC","m","degrees_north","degrees_east","meters","second","degrees"],
 "rows":[["2026-08-29T18:00:00Z",0,35,-20,1.66,9.345794,352],
         ["2026-08-29T18:00:00Z",0,30,244.5,null], ...]}}
```

**Two integration gotchas found by testing:**

1. **`curl` needs `-g`** (globoff) — griddap's bracket syntax collides with curl's glob ranges.
   Irrelevant for `fetch()` in Node, but it will bite anyone debugging by hand.
2. **The main dataset's longitude axis is 0-359.5, so Europe/Africa straddle the seam.**
   A request for `[(340):(360)]` returns **HTTP 404**:
   `"Constraint=\"[(340):(360)]\": \"Stop\" is greater than the axis maximum=360 (and even 359.5)."`
   **Use the `ww3_global_lon180` alias** (-180..180) for anything crossing the prime meridian —
   verified working, 186 KB / 9.0 s for a full-resolution Europe box.

**Resolution reality check — I measured this rather than assuming it.**
I pulled the full-resolution W. North America box and computed, for the 99 real WaveFinder spots
inside it, the great-circle distance to the nearest grid cell **that actually carries data**:

```
grid cells in box = 4331,  with data = 2972 (68.6%)
real spots inside box: 99
km to nearest cell WITH DATA:  median=27.5   p75=33.9   p90=39.1   max=142.6
>28 km (half a cell): 47/99      >55 km (one full cell): 2/99
```

So a coastal spot is typically snapped to a WW3 point **~27 km offshore**, and only 2 of 99 spots
are more than one grid cell from data. That is **much coarser than Open-Meteo's 0.08 deg MFWAM**
(CLAUDE.md records a 5.5 km max mismatch at 0.05 deg bucketing) — but it is **not** disqualifying
for an overview, for a reason specific to this app:

> WaveFinder's rating engine already treats the model's swell partition as a **deep-water** input
> and transforms it itself — `faceHeight` is the partition shoaled by its own period
> (Komar & Gaughan) and reduced by directional exposure. A 27 km-offshore WW3 swell partition is a
> *legitimate* input to that transform. What genuinely degrades at 0.5 deg is the **wind-wave
> partition** (hence the cleanliness factor) and any nearshore wind effect — which is why this
> belongs on the **map overview**, not on the spot page.

**Recommended architecture (concrete):**

- A **Vercel cron job** fetches ~6 full-resolution regional boxes (W-NA, E-NA, Europe/W-Africa,
  Australia/NZ/Pacific, S-America, Asia/Indian Ocean) with `Thgt,Tper,Tdir,shgt,sper,sdir,whgt`
  in **one combined query per box**, then snaps all ~1,192 buckets to their nearest valid cell and
  writes a single compact blob to Redis. Measured: ~200-700 KB and 9-19 s per box, so the whole
  world is ~2-3 MB and fits comfortably in a cron invocation. **Cost: 0 Open-Meteo calls.**
- The map reads that blob. Open-Meteo is then used **only** on `/api/forecast/[slug]` spot pages
  (~2.5 calls each) and optionally to refine the handful of buckets actually in the viewport.
- Bundle variables into **one** query per box — adding variables is far cheaper than extra requests.
- **Never** request the full-resolution global grid in one call (11.3 MB, >120 s — measured).

**VERDICT: ADOPT.** It is the only source tested that delivers global, forecast-horizon, partitioned
wave data as parse-free JSON with zero per-location billing and no credentials.

### 4.2 NOAA CoastWatch ERDDAP — **SKIP (not a separate source)**

`https://coastwatch.pfeg.noaa.gov/erddap/` lists `NWW3_Global_Best`, but requesting its griddap URL
returns **HTTP 302** with `Location: https://pae-paha.pacioos.hawaii.edu/erddap/griddap/ww3_global.json?...`
— it is a **pure alias/redirect to the same PacIOOS backend**. It provides **no redundancy and no
failover value**. Do not count it as a second data path.

### 4.3 NOAA NOMADS GFS-wave GRIB filter — **SKIP** (great data, no safe JS decoder)

**Base:** `https://nomads.ncep.noaa.gov/cgi-bin/filter_gfswave.pl`

The service itself is excellent and was verified working:

| Request | Status | Size | Time |
|---|---|---|---|
| Whole globe, **all** vars/levels, `gfswave.t00z.global.0p25.f000.grib2` | 200 | **12,142,831 B (12.1 MB)** | 6.6 s |
| Whole globe, only `HTSGW+PERPW+DIRPW` (`lev_surface=on&var_HTSGW=on&...`) | 200 | **1,919,355 B (1.9 MB)** | 9.2 s |
| CA-coast subregion (30-40N, -125..-115) | 200 | **4,688 B** | 2.6 s |

- **Cycles:** 4/day (00/06/12/18z) under `/pub/data/nccf/com/gfs/prod/gfs.YYYYMMDD/HH/wave/gridded/`;
  00z files timestamped 03:33 UTC → **~3.5 h latency**.
- **Horizon:** to **f384 (16 days)**, 209 files/cycle. **Resolution:** 0.25 deg global, 0.16 deg
  regional (`atlocn`, `epacif`, `wcoast`, `global.0p16`), 9 km arctic.
- **Variables (from `.idx`, 19 messages):** WIND, WDIR, UGRD, VGRD, HTSGW, PERPW, DIRPW, WVHGT,
  **SWELL x3 partitions**, WVPER, **SWPER x3**, WVDIR, **SWDIR x3** — richer than PacIOOS WW3
  (three swell partitions, and wind included in the same file).
- **License:** public-domain NOAA output, no login.
- **Rate limit:** searched the NOMADS homepage, `/txt_descriptions/`, and the filter CGI help page —
  **no published numeric limit or abuse-policy document found.** NCEP is widely reported to throttle
  heavy automated users; flagged as **unverified** rather than asserted.

**The blocker is GRIB2 decoding in pure JS on Vercel. This was tested, not assumed:**

| npm package | Last publish | Weekly DL | Outcome |
|---|---|---|---|
| `grib2json` | 2018-10 | 6 | Node wrapper around a **Java** CLI — needs a JVM. Ruled out. |
| `grib2-simple` | 2018-06 | 140 | Pure JS but README scopes it to **DWD** files; no NCEP/JPEG2000 support. 7+ yr stale. |
| `vgrib2` | 2022-10 | 24 | Pure-JS deps but no documented packing-template support; low adoption. |
| `wgrib2js` | **2025-10** | 24 | Best candidate — claims Templates 5.0/5.2/5.3. **Installed and actually run.** |

Two hard failures with `wgrib2js`:

1. **The production global file is Template 5.40 (JPEG2000).** Dumping
   `section5.dataRepresentationTemplateNumber` gave **40** for all 3 messages. `wgrib2js` does not
   implement 5.40 and silently falls back to undecoded bytes (`hasData:false, hasRawData:true`).
   **Zero real values recovered from the global file.**
2. **A silent data-corruption bug even on formats it does support.** The small subregion file
   re-encodes as Template 5.0 and decodes to plausible values (Hs 1.34 m, Tp 14.4 s, Dp 189 deg) —
   but GFS-wave grids carry a **bitmap section** (land/sea mask, `bitMapIndicator=0`, confirmed
   present) and `wgrib2js` **does not apply it**. It assigns the N decoded ocean-only values to the
   **first N grid indices in scan order**. Proof: deep-ocean points off San Francisco (index 1286)
   and Eureka (index 1604) returned **no data**, while every value present was crammed into indices
   0-831 of 1640. For any real (non-rectangular) coastline this **silently misattributes values to
   the wrong lat/lon** — the worst possible failure mode for a surf app, and precisely the class of
   bug CLAUDE.md's "a short or reordered response is discarded, not zipped" rule exists to prevent.

**VERDICT: SKIP.** Shipping this would mean writing and validating your own GRIB2 decoder
(JPEG2000 + correct bitmap remapping). Revisit only if PacIOOS proves inadequate and someone is
prepared to own a decoder.

### 4.4 ECMWF Open Data — **SKIP** (the Range trick works; the decode does not)

- **License:** **CC-BY-4.0** — *"the data may be redistributed and used commercially, subject to
  appropriate attribution."* (https://www.ecmwf.int/en/forecasts/datasets/open-data)
- **Wave fields ARE included.** Directory listing of
  `https://data.ecmwf.int/forecasts/20260822/00z/ifs/0p25/wave/` (HTTP 200, 18,278 B) shows
  **85 GRIB2 files**, 3-hourly to 144 h then 6-hourly to **360 h (15 days)**, ~10.7 MB each,
  **~908 MB per run**. Streams `oper`, `wave`, `enfo`, `waef` (legacy `scda`/`scwv` retired in
  IFS Cycle 50r1, May 2026). All 4 cycles present, **~6.5-7.5 h dissemination lag**.
  Access capped at **500 simultaneous connections**; rolling **12-run archive**.
- **The `.index` byte-offset trick is real and was verified.** `20260822000000-0h-wave-fc.index`
  (200, 2,647 B) maps params to offsets:

```json
{"param": "swh",  "_offset": 6028502, "_length": 855004}
{"param": "mwd",  "_offset": 6883506, "_length": 978630}
{"param": "pp1d", "_offset": 7862136, "_length": 956484}
{"param": "mwp",  "_offset": 8818620, "_length": 916663}
```

   (plus swell partitions `h1012`...`h2530`, `wmb`, `mp2`, `cdww`.) A real Range GET:

```
Range: bytes=6028502-6883505
-> HTTP/1.1 206 Partial Content
   Content-Range: bytes 6028502-6883505/10770437
   Content-Length: 855004
   first bytes: 47 52 49 42  ("GRIB")
```

   One global field for 855 KB instead of 10.7 MB. Genuinely clever, genuinely works.

- **And then it dies at the decode.** Parsing the downloaded bytes' Section 5 gives
  **Data Representation Template Number = 42 = "Grid point data - CCSDS compression"** (AEC /
  CCSDS 121.0-B). A search of npm and GitHub found **no JS or WASM CCSDS/AEC decoder**; `libaec`
  has no known WASM port, and existing JS GRIB readers shell out to Java or wgrib2.

**VERDICT: SKIP** under the stated "no native binaries" constraint. The data and license are ideal;
the packing is undecodable in pure JS today.

### 4.5 Copernicus Marine (CMEMS) — **CONSIDER** (the most interesting long shot)

Product **`GLOBAL_ANALYSISFORECAST_WAV_001_027`** (Meteo-France global wave model), confirmed via
STAC metadata (HTTP 200, 21,296 B): **1/12 deg (0.083 deg)** — i.e. **the same resolution as
Open-Meteo's MFWAM backbone** — 3-hourly, daily analysis + **10-day forecast**, with total,
wind-wave and primary/secondary swell partitions.

- **Legacy access is dead.** `my.cmems-du.eu` and `nrt.cmems-du.eu` (old MOTU/OPeNDAP) return 200
  but are **domain-parked** ("Domain Intercepted by 301Domains") — retired.
- **New finding: the ARCO Zarr stores on CloudFerro S3 are readable anonymously, today.**
  The STAC item lists `native`, `wmts` and three **Zarr** assets on `s3.waw3-1.cloudferro.com`.
  Tested with **no credentials**: `.zattrs`, `.zgroup`, `VHM0/.zarray`, `VHM0/.zattrs` all
  **HTTP 200**. `VHM0/.zarray`: shape `[11200 time, 2041 lat, 4320 lon]`, chunks `[1184,16,32]`,
  dtype `<i2`, **compressor `blosc`/`lz4`** — *not* CCSDS, and **`numcodecs` + `zarrita.js` decode
  blosc/lz4 in pure JS/WASM**. A real chunk fetch for Hossegor (chunk `9.92.66`) returned
  **HTTP 200, 112,004 bytes** with a valid blosc header.
- **Caveats that keep this out of ADOPT:** bucket LIST is blocked (`403 AccessDenied`), so chunk
  keys must be computed from metadata rather than browsed; a Malibu chunk returned 403 (S3 returns
  403 for nonexistent keys, so this is likely index math, not a coverage gap — `.zattrs` confirms
  -80..90 lat, -180..180 lon, genuinely global); and **CMEMS's own docs say the store
  "cannot be accessed directly... use a library such as xarray"** — this is an artifact of how their
  supported client fetches data, not a documented public API, so it could be ACL'd or restructured
  without notice.
- **License** (https://marine.copernicus.eu/user-corner/service-commitments-and-licence): free of
  charge but formally requires **registration** ("a login and password to access to products",
  non-transferable) and attribution: *"Generated using E.U. Copernicus Marine Service Information;
  [DOIs]"*. Credentials in a server-side env var would be consistent with that for a non-commercial
  app, but the anonymous path is not what the licence contemplates.

**VERDICT: CONSIDER.** If PacIOOS's 0.5 deg proves too coarse, this is the upgrade path — 0.083 deg
global wave partitions, JS-decodable, no per-location billing. But it is a **spike, not a day-one
dependency**: undocumented access pattern, real chunk-index engineering, and a ToS that wants
registration.

### 4.6 met.no THREDDS — **SKIP** (regional)

`https://thredds.met.no/thredds/catalog/fou-hi/fou-hi.html` carries `ww3_4km` and `mywavewam3`.
`.das` global attributes: *"...domain covers the Nordic Seas, North Sea, and Baltic Sea on a 4km
horizontal, spatial resolution"*, `geospatial_lat_min/max: 43.0/85.0`, `lon: -31.0/94.0` —
**regional, not global.** Files are 8.79 GB per 6-hourly run, but OPeNDAP constrained subsetting
works: a single-point `.ascii` request returned **398 bytes in 2.3 s**, and a 73-hour 5-variable
point series **12.8 KB in ~5 s**. `.json` is **not supported** (400 "Unrecognized request") — only
`.ascii`/`.dds`/`.das`/`.dods`, parseable with string ops and no NetCDF library. The grid uses
**rotated-pole coordinates** (`rlat`/`rlon`), so lat/lon to index needs the rotation formula or the
2D auxiliary arrays. **SKIP** for a global app; interesting only if Europe-specific detail is ever
wanted.

### 4.7 NDBC `latest_obs.txt` — **ADOPT** (one request, every buoy)

```
GET https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt
-> HTTP 200, 103,887 bytes, 2.8 s, Cache-Control: max-age=600
873 lines / ~871 stations (includes some international)
46025 ... WDIR 310 WSPD 4.0 WVHT 1.1 DPD 6 APD 5.0 MWD 262
```

**One 104 KB request covers every NDBC buoy on earth**, refreshed ~every 10 minutes, with
`WVHT` (m), `DPD`/`APD` (s), `MWD` (deg) and `WDIR`/`WSPD`/`GST`. Zero per-location cost.
(The per-buoy `realtime2/<id>.txt` is 610 KB of 45-day history — use `latest_obs.txt` instead.)

This is **observations, not a forecast**, so it cannot replace a model. But CLAUDE.md records that
NDBC observations **already feed the rating engine** (`MergeContext.buoy`, blending period/direction
toward the buoy with max weight 0.6). WaveFinder presumably fetches these per-station today;
**switching that to the single `latest_obs.txt` pull is a straight win** — fewer requests, one
cache entry, and it makes buoy blending available to the *map* as well as the spot page.

**VERDICT: ADOPT** as a cheap, global-file observational layer and nowcast sanity check.

---

## 5. 429 / outage fallback for per-spot forecasts

### 5.1 met.no Locationforecast — **ADOPT** (global wind fallback)

**Terms** (https://api.met.no/doc/TermsOfService), verbatim:
> "Anything over 20 requests/second per application (total, not per client) requires special agreement."

> "Do not ask too often, and don't repeat requests until the time indicated in the `Expires`
> response header." / "Cache data locally and use the `If-Modified-Since` request header to avoid
> repeatedly downloading the same data."

> "All requests must (if possible) include an identifying User Agent-string (UA) in the request with
> the application/domain name, optionally version number."

FAQ: *"you must identify yourself in the User-Agent header. If this is generic or missing you will
be throttled (for old products) or blocked (for new products from 2020 onwards)"* — bad examples
cited: `wget/1.12`, `Dalvik/2.1.0`. Also: *"When using requests with latitude/longitude, truncate
all coordinates to max 4 decimals."*

**License** (https://api.met.no/doc/License): dual **NLOD 2.0 + CC BY 4.0** —
*"Credit should be given to The Norwegian Meteorological Institute, shortened MET Norway, as the
source of data."*

**A non-obvious empirical finding on UA enforcement (tested):**

| User-Agent sent | Result |
|---|---|
| none (`curl -A ""`) | **200** |
| empty header | **200** |
| curl default (`curl/8.x`) | **200** |
| **`Mozilla/5.0`** (generic browser spoof) | **403 Forbidden** (reproduced twice) |

The block targets **spoofed/generic** UAs, not missing ones. WaveFinder's existing
`'User-Agent': 'WaveFinder/1.0 surf-forecast-app'` is exactly the right shape; adding a contact
address would match the ToS example.

**Tested — global coverage confirmed:**

| Point | Status | Size |
|---|---|---|
| Norway 58.97, 5.60 | 200 | 37,461 B |
| Malibu 34.03, -118.68 | **200** | 38,933 B |
| Hossegor 43.66, -1.44 | **200** | 39,259 B |
| Bali -8.81, 115.09 | **200** | 38,935 B |

`compact` gives `wind_speed`, `wind_from_direction`, `air_temperature`, `cloud_area_fraction`,
`precipitation_amount`, `relative_humidity`, `air_pressure_at_sea_level`.
**`complete` (88,754 B) adds `wind_speed_of_gust`** — which the rating engine's `GUST_WEIGHT` wants.
Horizon: 86 entries over 10 days (hourly ~48 h, then 6-hourly). `Expires` ~32 min ahead.

**VERDICT: ADOPT** as the drop-in fallback for `fetchWindForecast` when Open-Meteo 429s or fails.
It is free, keyless, global, and covers every wind field WaveFinder scores (speed, direction, gust,
cloud cover for UV). Honour `Expires`/`If-Modified-Since`; units are **m/s** (convert to km/h).

### 5.2 met.no Oceanforecast — **SKIP as a global fallback**

Tested at four points:

| Point | Status |
|---|---|
| Norway 58.97, 5.60 | **200**, 45,823 B |
| Malibu 34.03, -118.68 | **422** |
| Hossegor 43.66, -1.44 | **422** |
| Bali -8.81, 115.09 | **422** |

422 body, verbatim (header `X-ErrorClass: Outsidegeographicarea`):

```
The location is outside the geographic area supported by the product.
Oceanforecast is only available for Northern/Western Europe
```

Even where it works, it returns `sea_surface_wave_height`, `sea_surface_wave_from_direction`,
`sea_water_to_direction`, `sea_water_speed`, `sea_water_temperature` — **and no wave period field
at all**, which makes it unusable for a rating engine built on period-driven shoaling.
Horizon 210 hourly entries (~8.75 days).

**VERDICT: SKIP.** It fails on both counts: not global (it rejects Hossegor — a *French Atlantic*
spot — so "Western Europe" is narrower than it sounds), and no period.

### 5.3 NOAA / NWS — **SKIP** (gridpoints) / **CONSIDER** (CWF text), US-only either way

**Usage policy** (https://www.weather.gov/documentation/services-web-api), verbatim:
> "The rate limit is not public information, but allows a generous amount for typical use. If the
> rate limit is exceeded a request will return with an error, and may be retried after the limit
> clears (typically within 5 seconds)."
> "A User Agent is required to identify your application... Example:
> `User-Agent: (myweatherapp.com, contact@myweatherapp.com)`"

- `api.weather.gov/points/34.03,-118.68` → **200**, 3,727 B (`gridId: LOX`, `forecastZone: PZZ655`).
- `gridpoints/LOX/139,47` → **200**, 203,811 B. The schema **does** include `waveHeight`,
  `wavePeriod`, `waveDirection`, `primarySwellHeight/Direction`, `windWaveHeight` — **but every
  value across the entire horizon was `0`**, a single flat block. These are unpopulated
  placeholders on a land-anchored grid. **Do not trust them; a naive integration would render a
  permanently flat forecast that looks like real data.**
- `zones/forecast/PZZ655/forecast` → **404**:
  `{"title":"Marine Forecast Not Supported","detail":"Forecasts for marine areas are not yet supported by this API."}`
- **CWF (Coastal Waters Forecast) text products do carry real numbers.**
  `products/types/CWF/locations/LOX` → 200; the product text (200, 11,741 B) contains:

```
.TONIGHT...NW wind 15 to 25 kt... Seas 5 to 7 ft.
Wave Detail: NW 7 ft at 8 seconds and S 2 ft at 15 seconds.
```

  Real height/period/direction — but **unstructured text**, **zone granularity** (tens of miles),
  and **US-only**.

**VERDICT: SKIP** the `gridpoints` wave fields (empirically placeholder zeros).
**CONSIDER** CWF text only as a last-resort US supplement. Note WaveFinder already mounts
CoastalAlertsPanel against NWS for official warnings — that use is unaffected and remains valid.

### 5.4 Paid providers — ruled out

| Provider | Why SKIP |
|---|---|
| **Stormglass.io** | Free tier is **10 requests/day** and **forbids commercial use** even free; 1,482 spots need orders of magnitude more. Paid from EUR 19/mo for 500 req/day. |
| **WorldTides** | **Tide height only** — no wave height/period/direction at all. Credit-metered (~$1/10,000 predictions, 100 free on signup). Wrong data type *and* not free at scale. |
| **Surfline / Magicseaweed** | Magicseaweed's public API was shut down after Surfline's 2023 acquisition; Surfline has no public developer API. No legitimate free access exists. |

---

## 6. Recommended plan for WaveFinder

**Immediate, zero-risk, no new dependency (sections 1.3, 3):**

1. Drop `wind_wave_direction` from `fetchConditionsChunk` (unused; 11 to 10 vars) — **-9% marine leg**.
2. Add `wind_gusts_10m` and `cloud_cover` to the map's `current=` leg — **free**, and it feeds
   `GUST_WEIGHT` and UV cloud attenuation that the engine already implements but the map never feeds.
3. Make 429 handling reason-aware (section 1.8): only retry `"Too many concurrent requests"`; treat
   `Minutely/Hourly/Daily ... limit exceeded` as terminal and go straight to stale-if-error.
   Every retry currently costs a call even when it fails.

**The structural fix (section 4.1):** move the world-map overview onto **PacIOOS ERDDAP
`ww3_global`**, refreshed by cron into Redis, ~6 full-resolution regional boxes,
**0 Open-Meteo calls**. Keep Open-Meteo for spot pages and optional viewport refinement. This is
what removes the 2,500-call sweep entirely, and it makes the existing 200-bucket ceiling and
`unknown` grey-pin fallback unnecessary rather than merely tolerable.

**Resilience (sections 5.1, 4.7):** met.no **Locationforecast** as the wind fallback on Open-Meteo
failure; **NDBC `latest_obs.txt`** as a single-request observational layer for buoy blending.

**Do not pursue:** bucket widening (section 2.2, measured 6%), `bounding_box=` (section 2.5, still
per-cell), GRIB2 anything on Vercel (sections 4.3, 4.4), Oceanforecast as a global wave source
(section 5.2), NWS `gridpoints` wave fields (section 5.3).

---

## 7. Confidence and caveats

- **Verified by direct execution:** every Open-Meteo call-accounting claim (source code + two live
  rate-limit experiments), every marine/wind variable and model result, the `bounding_box` rejection,
  all PacIOOS ERDDAP sizes/timings, the spot-to-grid distance statistics, the met.no coverage
  matrix, the NWS placeholder-zero finding, and the NDBC file size.
- **Verified by a delegated agent executing live requests** (reported with URLs, statuses and byte
  counts): NOMADS sizes and the `wgrib2js` failures, ECMWF `.index`/Range behaviour and template 42,
  the CMEMS Zarr anonymous reads, met.no ToS quotes.
- **Explicitly NOT verified:** any numeric NOMADS rate limit (no published policy found — do not
  assume one exists or that none does); whether `marine-api` and `api` subdomains keep separate
  rate-limit counters (a small request to each succeeded immediately after saturating marine, but
  Open-Meteo's per-instance in-memory counters make this untestable from outside — **assume shared
  and pace accordingly**); OSMC and EMODnet Physics ERDDAP servers (reachable, not deep-tested).
- **Time-sensitive:** the CMEMS anonymous S3 path is undocumented and may be closed without notice.
  Open-Meteo's limits are env-configurable server-side and the production values for
  `CONCURRENCY_LIMIT` are clearly higher than the code defaults.
