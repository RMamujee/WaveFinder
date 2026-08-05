import { getCache } from '@vercel/functions'

const MARINE_BASE = 'https://marine-api.open-meteo.com/v1/marine'
const WEATHER_BASE = 'https://api.open-meteo.com/v1/forecast'

// Some CDN/Cloudflare configs block headless requests without a UA
const HEADERS = {
  'User-Agent': 'WaveFinder/1.0 surf-forecast-app',
  'Accept': 'application/json',
}

// In-flight request dedup: when a cache entry expires, every concurrent
// request misses and would independently re-run the same multi-second
// Open-Meteo fan-out. Joining concurrent misses on one promise per key means
// a cold/expired key costs one upstream fetch per instance, not one per caller.
const inflight = new Map<string, Promise<unknown>>()

function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key)
  if (existing) return existing as Promise<T>
  const p = fn().finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

// Cross-region runtime cache wrapper. Falls back to fetching directly if the
// runtime cache is unavailable (e.g. local `npm start` without Vercel runtime).
async function withCache<T>(key: string, ttlSeconds: number, tags: string[], fn: () => Promise<T>): Promise<T> {
  let cache: ReturnType<typeof getCache> | null = null
  try {
    cache = getCache()
  } catch {
    cache = null
  }
  if (cache) {
    try {
      const hit = await cache.get(key) as T | null | undefined
      if (hit !== null && hit !== undefined) return hit
    } catch {
      // Cache read failed — fall through to origin fetch
    }
  }
  return dedupe(key, async () => {
    const value = await fn()
    if (cache && value !== null && value !== undefined) {
      try {
        await cache.set(key, value, { ttl: ttlSeconds, tags })
      } catch {
        // Cache write failed — return value anyway
      }
    }
    return value
  })
}


export interface OpenMeteoMarineResponse {
  utc_offset_seconds?: number
  hourly: {
    time: string[]
    wave_height: number[]
    wave_direction: number[]
    wave_period: number[]
    swell_wave_height: number[]
    swell_wave_direction: number[]
    swell_wave_period: number[]
    wind_wave_height: number[]
    wind_wave_direction: number[]
    wind_wave_period: number[]
    sea_surface_temperature?: number[]
    // True when the hour was filled from the long-range ECMWF WAM model
    // because the primary best_match model returned null past day ~10.
    is_long_range?: boolean[]
  }
}

export interface OpenMeteoWindResponse {
  hourly: {
    time: string[]
    wind_speed_10m: number[]
    wind_direction_10m: number[]
    wind_gusts_10m: number[]
    temperature_2m: number[]
    weather_code: number[]
    precipitation_probability: number[]
  }
}

export interface CurrentMarineConditions {
  waveHeight: number
  wavePeriod: number
  /** Null when the model omitted the field for this hour. Nulls are preserved
   *  (not coerced to 0) because the rating engine treats null as "unknown,
   *  score neutrally" — a 0 would be scored as a real due-north swell. */
  swellDirection: number | null
  /** Groundswell partition — the map used to approximate this as
   *  `waveHeight * 0.7`, which rated onshore chop as if it were swell. */
  swellHeight: number
  swellPeriod: number
  windWaveHeight: number | null
  windSpeed: number
  windDirection: number | null
}

export async function fetchCurrentConditions(
  lat: number,
  lng: number
): Promise<CurrentMarineConditions | null> {
  // Round to 2 decimal places (~1 km) for cache key — finer than the 1-decimal
  // bucket used in the route, so accuracy is preserved while still deduplicating
  // repeated calls from re-fetches or concurrent requests on a warm instance.
  // v4: v3 entries carry 0-coerced values where the model returned null and an
  // hour selected with the UTC-offset bug — both fixed in the 2026-08-05 pass.
  const cacheKey = `om:cond:v4:${lat.toFixed(2)},${lng.toFixed(2)}`

  let cache: ReturnType<typeof getCache> | null = null
  try { cache = getCache() } catch { cache = null }
  if (cache) {
    try {
      const hit = await cache.get(cacheKey) as CurrentMarineConditions | null | undefined
      // Vercel Runtime Cache returns null for missing keys, so we cannot
      // distinguish a stored null from an absent entry — treat null as a miss
      // and skip caching null results below.
      if (hit !== null && hit !== undefined) return hit
    } catch { /* fall through */ }
  }

  return dedupe(cacheKey, () => fetchCurrentConditionsUncached(lat, lng, cacheKey, cache))
}

async function fetchCurrentConditionsUncached(
  lat: number,
  lng: number,
  cacheKey: string,
  cache: ReturnType<typeof getCache> | null
): Promise<CurrentMarineConditions | null> {
  try {
    // Use hourly endpoint (same model as spot forecast pages) and pick the nearest future hour.
    // The previous `current=` endpoint returned an instantaneous interpolated reading that
    // differed from what findNearestFutureHour returns on the spot page. Using hourly data
    // ensures map node heights exactly match what each spot's forecast page shows.
    const marineParams = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      hourly: 'wave_height,wave_period,swell_wave_height,swell_wave_period,swell_wave_direction,wind_wave_height,wind_wave_direction',
      // 2 days, not 1: forecast_days spans the spot's LOCAL calendar day, so a
      // west-of-UTC spot queried in its evening needs tomorrow's first hours in
      // range or the current-hour lookup runs off the end and pins to 23:00.
      forecast_days: '2',
      timezone: 'auto',
    })

    const weatherParams = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      current: 'wind_speed_10m,wind_direction_10m',
      wind_speed_unit: 'kmh',
      timezone: 'auto',
    })

    // Use allSettled so a slow/blocked weather API doesn't kill the marine result.
    // 5 s marine / 4 s weather: fast enough to keep batch latency low while still
    // giving Open-Meteo a reasonable window. Timeouts return null and are handled
    // by the nearest-neighbour fallback in the route.
    const [marineSettled, windSettled] = await Promise.allSettled([
      fetch(`${MARINE_BASE}?${marineParams}`, { signal: AbortSignal.timeout(5000), headers: HEADERS }),
      fetch(`${WEATHER_BASE}?${weatherParams}`, { signal: AbortSignal.timeout(4000), headers: HEADERS }),
    ])

    if (marineSettled.status === 'rejected' || !marineSettled.value.ok) return null

    const marine = await marineSettled.value.json()

    // Parse wind separately — weather API may return HTML (Cloudflare block) even with 200 OK
    let wind: { current?: { wind_speed_10m?: number; wind_direction_10m?: number } } | null = null
    try {
      if (windSettled.status === 'fulfilled' && windSettled.value.ok) {
        const windText = await windSettled.value.text()
        wind = JSON.parse(windText)
      }
    } catch {
      // Weather API returned non-JSON (e.g. Cloudflare HTML) — fall back to marine wind fields
    }

    const hourly = marine?.hourly
    if (!hourly?.time?.length) return null

    // Pick the current hour, in the SPOT's local clock. Open-Meteo returns
    // offset-less local-time strings; `new Date(t)` would parse them in the
    // runtime's zone (UTC on Vercel), selecting an hour offset by the spot's
    // entire UTC offset — a Californian checking at 5pm saw 11pm conditions.
    // Mirror findNearestFutureHour: shift now by utc_offset_seconds and compare
    // local-clock strings lexicographically, truncated to the hour so the
    // in-progress hour wins (not the next one).
    const offsetSeconds = (marine?.utc_offset_seconds as number) ?? 0
    const nowLocalHour = new Date(Date.now() + offsetSeconds * 1000)
      .toISOString()
      .slice(0, 13)
    const times = hourly.time as string[]
    let idx = times.findIndex((t) => t.slice(0, 13) >= nowLocalHour)
    if (idx === -1) idx = times.length - 1

    const waveHeight = (hourly.wave_height as (number | null)[])[idx]
    // Null here means a land/invalid marine cell or a missing hour — NOT flat.
    // Returning null lets the route's nearest-neighbour fallback fire instead
    // of rendering a fabricated "flat/poor" reading that never self-corrects.
    if (waveHeight == null) return null

    const wavePeriod     = (hourly.wave_period as (number | null)[])[idx] ?? 0
    const swellHeight    = (hourly.swell_wave_height as (number | null)[])?.[idx] ?? 0
    const swellPeriod    = (hourly.swell_wave_period as (number | null)[])?.[idx] ?? 0
    const swellDirection = (hourly.swell_wave_direction as (number | null)[])[idx] ?? null
    const windWaveH      = (hourly.wind_wave_height as (number | null)[])[idx] ?? null
    const windWaveDir    = (hourly.wind_wave_direction as (number | null)[])[idx] ?? null

    // Estimate wind speed from wind-wave height when weather API is unavailable
    const estimatedWindSpeed = windWaveH != null && windWaveH > 0
      ? Math.round(Math.sqrt(windWaveH / 0.0248) * 3.6)
      : 0

    const result: CurrentMarineConditions = {
      waveHeight,
      wavePeriod,
      swellHeight,
      swellPeriod,
      swellDirection,
      windWaveHeight: windWaveH,
      windSpeed:     wind?.current?.wind_speed_10m ?? estimatedWindSpeed,
      windDirection: wind?.current?.wind_direction_10m ?? windWaveDir,
    }
    try { await cache?.set(cacheKey, result, { ttl: 5 * 60, tags: ['open-meteo'] }) } catch {}
    return result
  } catch {
    return null
  }
}

export async function fetchMarineForecast(
  lat: number,
  lng: number
): Promise<OpenMeteoMarineResponse> {
  // 2-decimal bucket (~1 km) — colocated spots share one upstream fetch.
  const cacheKey = `om:marine:v2:${lat.toFixed(2)},${lng.toFixed(2)}`
  return withCache(cacheKey, 3600, ['open-meteo', 'marine'], async () => {
    // Two parallel models: best_match has full swell decomposition but only
    // covers ~10 days reliably (nulls thereafter); ecmwf_wam025 reaches the
    // full 16-day horizon with wave_height/period/direction only. We merge:
    // primary fields fill from best_match where present, fall back to the
    // long-range model so days 11-16 show real data instead of zeros.
    const fields = [
      'wave_height', 'wave_direction', 'wave_period',
      'swell_wave_height', 'swell_wave_direction', 'swell_wave_period',
      'wind_wave_height', 'wind_wave_direction', 'wind_wave_period',
      'sea_surface_temperature',
    ]
    const baseParams = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      forecast_days: '16',
      timezone: 'auto',
    })
    const primary = new URLSearchParams(baseParams)
    primary.set('hourly', fields.join(','))
    const longRange = new URLSearchParams(baseParams)
    // ECMWF WAM 0.25 only exposes the basic 3 wave fields
    longRange.set('hourly', 'wave_height,wave_period,wave_direction')
    longRange.set('models', 'ecmwf_wam025')

    const fetchOne = async (qs: URLSearchParams, timeoutMs: number) => {
      let lastErr: unknown
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch(`${MARINE_BASE}?${qs}`, {
            next: { revalidate: 3600 },
            headers: HEADERS,
            signal: AbortSignal.timeout(timeoutMs),
          })
          if (!res.ok) throw new Error(`Open-Meteo marine API error: ${res.status} ${res.statusText}`)
          const data = await res.json() as OpenMeteoMarineResponse
          if (!Array.isArray(data?.hourly?.time) || data.hourly.time.length === 0) {
            throw new Error('Open-Meteo marine API returned empty or malformed hourly data')
          }
          return data
        } catch (err) {
          lastErr = err
        }
      }
      throw lastErr instanceof Error ? lastErr : new Error('Open-Meteo marine API failed')
    }

    // Run both in parallel. The primary is required; if the long-range fails
    // we still return primary alone (days 11-16 will be null as before).
    const [primaryRes, longRes] = await Promise.allSettled([
      fetchOne(primary, 20000),
      fetchOne(longRange, 15000),
    ])
    if (primaryRes.status === 'rejected') throw primaryRes.reason
    const main = primaryRes.value
    if (longRes.status !== 'fulfilled') return main

    // Index long-range by time so we can fill gaps regardless of array offsets.
    const long = longRes.value.hourly
    const longByTime = new Map<string, number>()
    long.time.forEach((t, i) => longByTime.set(t, i))

    const fill = (arr: (number | null)[], srcArr: (number | null)[] | undefined) => {
      if (!srcArr) return arr
      return main.hourly.time.map((t, i) => {
        const v = arr[i]
        if (v != null) return v
        const j = longByTime.get(t)
        return j != null ? srcArr[j] ?? null : null
      })
    }

    // Tag each hour where the primary model returned null wave_height — those
    // are the ones the long-range fill actually substituted for. Consumers
    // (UI, alerts) treat these as lower-confidence "outlook" data.
    const isLongRange = main.hourly.wave_height.map((v) => v == null)

    const filled: OpenMeteoMarineResponse = {
      ...main,
      hourly: {
        ...main.hourly,
        wave_height: fill(main.hourly.wave_height, long.wave_height),
        wave_period: fill(main.hourly.wave_period, long.wave_period),
        wave_direction: fill(main.hourly.wave_direction, long.wave_direction),
        // No swell decomposition past day 10 — substitute total wave so the
        // surf rating engine has *something* to score with rather than zero.
        swell_wave_height: fill(main.hourly.swell_wave_height, long.wave_height),
        swell_wave_period: fill(main.hourly.swell_wave_period, long.wave_period),
        swell_wave_direction: fill(main.hourly.swell_wave_direction, long.wave_direction),
        is_long_range: isLongRange,
      } as OpenMeteoMarineResponse['hourly'],
    }
    return filled
  })
}

export async function fetchWindForecast(
  lat: number,
  lng: number
): Promise<OpenMeteoWindResponse> {
  const cacheKey = `om:wind:${lat.toFixed(2)},${lng.toFixed(2)}`
  return withCache(cacheKey, 3600, ['open-meteo', 'wind'], async () => {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,weather_code,precipitation_probability',
      wind_speed_unit: 'kmh',
      forecast_days: '16',
      timezone: 'auto',
    })

    try {
      const res = await fetch(`${WEATHER_BASE}?${params}`, {
        next: { revalidate: 3600 },
        headers: HEADERS,
        signal: AbortSignal.timeout(15000),
      })

      if (!res.ok) throw new Error(`status ${res.status}`)

      const text = await res.text()
      const data: OpenMeteoWindResponse = JSON.parse(text)

      return data
    } catch {
      // Wind API unavailable — return empty structure so forecast still loads.
      // Wind wave direction from marine API will be used as fallback in merge.
      return {
        hourly: {
          time: [] as string[],
          wind_speed_10m: [] as number[],
          wind_direction_10m: [] as number[],
          wind_gusts_10m: [] as number[],
          temperature_2m: [] as number[],
          weather_code: [] as number[],
          precipitation_probability: [] as number[],
        },
      }
    }
  })
}
