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
    // Open-Meteo ranks swell partitions by HEIGHT, so the longer-period train
    // is often the second one. Absent past day ~10 (no decomposition) and on
    // payloads cached before the partition was requested — hence optional.
    secondary_swell_wave_height?: (number | null)[]
    secondary_swell_wave_direction?: (number | null)[]
    secondary_swell_wave_period?: (number | null)[]
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
  /** Second swell train. Partitions rank by height, so this is frequently the
   *  longer-period (more surfable) one. Null when the model reports none. */
  secondarySwellHeight: number | null
  secondarySwellPeriod: number | null
  secondarySwellDirection: number | null
  windWaveHeight: number | null
  windSpeed: number
  windDirection: number | null
}

export interface GeoPoint {
  lat: number
  lng: number
}

/** One location's entry in a (possibly multi-location) marine response. */
export interface MarineCurrentEntry {
  utc_offset_seconds?: number
  hourly?: {
    time?: string[]
    wave_height?: (number | null)[]
    wave_period?: (number | null)[]
    swell_wave_height?: (number | null)[]
    swell_wave_period?: (number | null)[]
    swell_wave_direction?: (number | null)[]
    secondary_swell_wave_height?: (number | null)[]
    secondary_swell_wave_period?: (number | null)[]
    secondary_swell_wave_direction?: (number | null)[]
    wind_wave_height?: (number | null)[]
    wind_wave_direction?: (number | null)[]
  }
}

/** One location's entry in a (possibly multi-location) weather response. */
export interface WeatherCurrentEntry {
  current?: {
    wind_speed_10m?: number | null
    wind_direction_10m?: number | null
  }
}

// Cached in place of a result when Open-Meteo definitively returned null for
// the cell (land/invalid grid point) — NOT for transient errors, which stay
// uncached so they retry.
export interface NoDataSentinel { noData: true }

const NO_DATA: NoDataSentinel = { noData: true }

// Coordinates sent per upstream request. Open-Meteo accepts comma-separated
// latitude/longitude lists and answers with a JSON array in the same order,
// but documents no cap — so this is bounded by URL length rather than by a
// stated limit. 50 coordinates is ~800 characters of query string.
const BATCH_COORDS = 50

function condCacheKey(lat: number, lng: number): string {
  // Round to 2 decimal places (~1 km) for the cache key — finer than the
  // 1-decimal bucket used in the route, so accuracy is preserved while
  // repeated calls still deduplicate.
  // v5: v4 entries predate the secondary swell partition, so a hit would rate
  // the map from the primary train alone while the spot page used both.
  return `om:cond:v5:${lat.toFixed(2)},${lng.toFixed(2)}`
}

function tryGetCache(): ReturnType<typeof getCache> | null {
  try { return getCache() } catch { return null }
}

/**
 * Index of the hour covering `now`, in the SPOT's local clock.
 *
 * Open-Meteo returns offset-less local-time strings; `new Date(t)` would parse
 * them in the runtime's zone (UTC on Vercel), selecting an hour offset by the
 * spot's entire UTC offset — a Californian checking at 5pm saw 11pm
 * conditions. Mirrors findNearestFutureHour: shift now by utc_offset_seconds
 * and compare local-clock strings lexicographically, truncated to the hour so
 * the in-progress hour wins (not the next one).
 */
export function pickHourIndex(
  times: string[],
  utcOffsetSeconds: number,
  nowMs: number = Date.now()
): number {
  const nowLocalHour = new Date(nowMs + utcOffsetSeconds * 1000).toISOString().slice(0, 13)
  const idx = times.findIndex((t) => t.slice(0, 13) >= nowLocalHour)
  return idx === -1 ? times.length - 1 : idx
}

/**
 * Pure parse of one location's marine + weather entry. Exported for tests.
 *
 * Returns NO_DATA (not null) when the model gave no wave height for the hour:
 * that is a land/invalid marine cell, a definitive answer worth caching, as
 * distinct from a transient failure which must stay uncached so it retries.
 */
export function parseCurrentConditions(
  marine: MarineCurrentEntry | undefined | null,
  wind: WeatherCurrentEntry | undefined | null,
  nowMs: number = Date.now()
): CurrentMarineConditions | NoDataSentinel | null {
  const hourly = marine?.hourly
  if (!hourly?.time?.length) return null

  const idx = pickHourIndex(hourly.time, marine?.utc_offset_seconds ?? 0, nowMs)

  // Null here means a land/invalid marine cell or a missing hour — NOT flat.
  // The route's nearest-neighbour fallback then fires instead of rendering a
  // fabricated "flat/poor" reading that never self-corrects.
  const waveHeight = hourly.wave_height?.[idx] ?? null
  if (waveHeight == null) return NO_DATA

  const windWaveH = hourly.wind_wave_height?.[idx] ?? null

  // Estimate wind speed from wind-wave height when the weather API is
  // unavailable: Hs_wind ≈ 0.0248 × U² (m/s).
  const estimatedWindSpeed = windWaveH != null && windWaveH > 0
    ? Math.round(Math.sqrt(windWaveH / 0.0248) * 3.6)
    : 0

  return {
    waveHeight,
    wavePeriod:     hourly.wave_period?.[idx] ?? 0,
    swellHeight:    hourly.swell_wave_height?.[idx] ?? 0,
    swellPeriod:    hourly.swell_wave_period?.[idx] ?? 0,
    swellDirection: hourly.swell_wave_direction?.[idx] ?? null,
    // Null (not 0) throughout: the rating engine only scores the second train
    // when it has both a real height and a real period.
    secondarySwellHeight:    hourly.secondary_swell_wave_height?.[idx] ?? null,
    secondarySwellPeriod:    hourly.secondary_swell_wave_period?.[idx] ?? null,
    secondarySwellDirection: hourly.secondary_swell_wave_direction?.[idx] ?? null,
    windWaveHeight: windWaveH,
    windSpeed:      wind?.current?.wind_speed_10m ?? estimatedWindSpeed,
    // Null when the weather API gave no direction — the engine's mean-
    // direction branch handles it. The old wind_wave_direction stand-in
    // rated an estimated breeze as if it blew from the chop's bearing,
    // which the forecast route's merge explicitly stopped doing.
    windDirection:  wind?.current?.wind_direction_10m ?? null,
  }
}

/**
 * Normalise an Open-Meteo response into a per-location list.
 *
 * A single-coordinate request returns a bare object; a multi-coordinate one
 * returns an array in request order. Returns null when the entry count does
 * not match the request — a short or reordered list would hand each spot its
 * neighbour's conditions, which is far worse than falling back.
 */
function asLocationList<T>(json: unknown, expected: number): T[] | null {
  const list = Array.isArray(json) ? json : [json]
  return list.length === expected ? list as T[] : null
}

async function fetchJson(url: string, timeoutMs: number): Promise<unknown | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: HEADERS })
    if (!res.ok) return null
    // Parse from text: Open-Meteo can answer with Cloudflare HTML at status 200.
    return JSON.parse(await res.text())
  } catch {
    return null
  }
}

/** One upstream round trip covering up to BATCH_COORDS locations. */
async function fetchConditionsChunk(
  points: GeoPoint[]
): Promise<(CurrentMarineConditions | NoDataSentinel | null)[]> {
  const latitude = points.map((p) => p.lat.toFixed(4)).join(',')
  const longitude = points.map((p) => p.lng.toFixed(4)).join(',')
  // Open-Meteo documents timezone as a comma-separated list for multi-coordinate
  // requests. Each entry then reports its own utc_offset_seconds, which is what
  // the local-clock hour selection needs.
  const timezone = points.map(() => 'auto').join(',')

  const marineParams = new URLSearchParams({
    latitude,
    longitude,
    hourly: 'wave_height,wave_period,swell_wave_height,swell_wave_period,swell_wave_direction,secondary_swell_wave_height,secondary_swell_wave_period,secondary_swell_wave_direction,wind_wave_height,wind_wave_direction',
    // 2 days, not 1: forecast_days spans the spot's LOCAL calendar day, so a
    // west-of-UTC spot queried in its evening needs tomorrow's first hours in
    // range or the current-hour lookup runs off the end and pins to 23:00.
    forecast_days: '2',
    timezone,
  })

  const weatherParams = new URLSearchParams({
    latitude,
    longitude,
    current: 'wind_speed_10m,wind_direction_10m',
    wind_speed_unit: 'kmh',
    timezone,
  })

  // fetchJson resolves null rather than throwing, so a slow or blocked weather
  // API cannot discard the marine result. Timeouts are generous relative to the
  // old per-spot 5 s because one failure now costs a whole chunk; the route's
  // nearest-neighbour fallback covers whatever does fail.
  const [marineJson, windJson] = await Promise.all([
    fetchJson(`${MARINE_BASE}?${marineParams}`, 12000),
    fetchJson(`${WEATHER_BASE}?${weatherParams}`, 9000),
  ])

  const marineList = asLocationList<MarineCurrentEntry>(marineJson, points.length)
  if (!marineList) return points.map(() => null)
  const windList = asLocationList<WeatherCurrentEntry>(windJson, points.length)

  const now = Date.now()
  return points.map((_, i) => parseCurrentConditions(marineList[i], windList?.[i], now))
}

// Per-coordinate in-flight registry. A batch cannot join another batch
// wholesale, so each coordinate gets its own promise: two concurrent requests
// covering overlapping spots share the overlap instead of re-fetching it.
const condInflight = new Map<string, Promise<CurrentMarineConditions | null>>()

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Current conditions for many coordinates, resolved in request order.
 *
 * Cache hits and in-flight coordinates are served without a fetch; the rest are
 * grouped into multi-location Open-Meteo requests that run in parallel. The
 * map's ~130 unique coordinate buckets used to cost ~130 round trips in serial
 * batches of 40; they now cost 3.
 */
export async function fetchCurrentConditionsBatch(
  points: GeoPoint[]
): Promise<(CurrentMarineConditions | null)[]> {
  if (!points.length) return []
  const cache = tryGetCache()

  const keys = points.map((p) => condCacheKey(p.lat, p.lng))
  const unique = new Map<string, GeoPoint>()
  keys.forEach((k, i) => { if (!unique.has(k)) unique.set(k, points[i]) })

  const cached = new Map<string, CurrentMarineConditions | null>()
  const joined = new Map<string, Promise<CurrentMarineConditions | null>>()
  const settle = new Map<string, (v: CurrentMarineConditions | null) => void>()
  const toFetch: Array<{ key: string; point: GeoPoint }> = []

  await Promise.all([...unique].map(async ([key, point]) => {
    const existing = condInflight.get(key)
    if (existing) { joined.set(key, existing); return }

    if (cache) {
      try {
        const hit = await cache.get(key) as CurrentMarineConditions | NoDataSentinel | null | undefined
        // Vercel Runtime Cache returns null for missing keys, so a stored null
        // is indistinguishable from an absent entry — a definitive "this cell
        // has no marine data" is cached as a sentinel object instead, so land
        // cells don't re-hit Open-Meteo on every origin run.
        if (hit !== null && hit !== undefined) {
          cached.set(key, 'noData' in hit ? null : hit)
          return
        }
      } catch { /* fall through to fetch */ }
    }

    // Re-check: another caller may have registered while we awaited the read.
    const raced = condInflight.get(key)
    if (raced) { joined.set(key, raced); return }

    let resolve!: (v: CurrentMarineConditions | null) => void
    const promise = new Promise<CurrentMarineConditions | null>((r) => { resolve = r })
    condInflight.set(key, promise)
    joined.set(key, promise)
    settle.set(key, resolve)
    toFetch.push({ key, point })
  }))

  await Promise.all(chunk(toFetch, BATCH_COORDS).map(async (group) => {
    let results: (CurrentMarineConditions | NoDataSentinel | null)[]
    try {
      results = await fetchConditionsChunk(group.map((g) => g.point))
    } catch {
      results = group.map(() => null)
    } finally {
      // Registry entries must never outlive the fetch, or a transient failure
      // would pin every future caller to a promise nobody resolves.
      for (const { key } of group) condInflight.delete(key)
    }
    await Promise.all(group.map(async ({ key }, i) => {
      const outcome = results[i] ?? null
      // Only definitive outcomes are cached: a null here is a transient chunk
      // failure and must retry on the next request.
      if (cache && outcome) {
        try { await cache.set(key, outcome, { ttl: 5 * 60, tags: ['open-meteo'] }) } catch {}
      }
      settle.get(key)!(outcome && 'noData' in outcome ? null : outcome)
    }))
  }))

  return Promise.all(keys.map(async (k) =>
    cached.has(k) ? cached.get(k)! : (await joined.get(k)!) ?? null
  ))
}

export async function fetchCurrentConditions(
  lat: number,
  lng: number
): Promise<CurrentMarineConditions | null> {
  const [result] = await fetchCurrentConditionsBatch([{ lat, lng }])
  return result ?? null
}

export async function fetchMarineForecast(
  lat: number,
  lng: number
): Promise<OpenMeteoMarineResponse> {
  // 2-decimal bucket (~1 km) — colocated spots share one upstream fetch.
  // v3: v2 entries have no secondary swell partition.
  const cacheKey = `om:marine:v3:${lat.toFixed(2)},${lng.toFixed(2)}`
  return withCache(cacheKey, 3600, ['open-meteo', 'marine'], async () => {
    // Two parallel models: best_match has full swell decomposition but only
    // covers ~10 days reliably (nulls thereafter); ecmwf_wam025 reaches the
    // full 16-day horizon with wave_height/period/direction only. We merge:
    // primary fields fill from best_match where present, fall back to the
    // long-range model so days 11-16 show real data instead of zeros.
    const fields = [
      'wave_height', 'wave_direction', 'wave_period',
      'swell_wave_height', 'swell_wave_direction', 'swell_wave_period',
      // Second swell train: ranked by height, so this is frequently the
      // longer-period one. Fetched but never long-range-filled — ECMWF WAM
      // exposes no decomposition, so days 11-16 have a primary train only.
      'secondary_swell_wave_height', 'secondary_swell_wave_direction', 'secondary_swell_wave_period',
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
