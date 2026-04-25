const MARINE_BASE = 'https://marine-api.open-meteo.com/v1/marine'
const WEATHER_BASE = 'https://api.open-meteo.com/v1/forecast'

// Some CDN/Cloudflare configs block headless requests without a UA
const HEADERS = {
  'User-Agent': 'WaveFinder/1.0 surf-forecast-app',
  'Accept': 'application/json',
}

export interface OpenMeteoMarineResponse {
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
  swellDirection: number
  windSpeed: number
  windDirection: number
}

// Module-level cache — survives across requests on the same warm instance,
// reducing Open-Meteo call volume for the conditions fan-out (~100+ locations).
const _condCache = new Map<string, { result: CurrentMarineConditions | null; exp: number }>()
const COND_CACHE_TTL = 5 * 60 * 1000

export async function fetchCurrentConditions(
  lat: number,
  lng: number
): Promise<CurrentMarineConditions | null> {
  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`
  const cached = _condCache.get(cacheKey)
  if (cached && Date.now() < cached.exp) return cached.result

  try {
    const marineParams = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      hourly: 'wave_height,wave_period,swell_wave_direction,wind_wave_height,wind_wave_direction',
      forecast_days: '1',
      timezone: 'auto',
    })

    const weatherParams = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      current: 'wind_speed_10m,wind_direction_10m',
      wind_speed_unit: 'kmh',
      timezone: 'auto',
    })

    const [marineSettled, windSettled] = await Promise.allSettled([
      fetch(`${MARINE_BASE}?${marineParams}`, { signal: AbortSignal.timeout(5000), headers: HEADERS }),
      fetch(`${WEATHER_BASE}?${weatherParams}`, { signal: AbortSignal.timeout(4000), headers: HEADERS }),
    ])

    if (marineSettled.status === 'rejected' || !marineSettled.value.ok) {
      _condCache.set(cacheKey, { result: null, exp: Date.now() + 60_000 })
      return null
    }

    const marine = await marineSettled.value.json()

    // Parse wind separately — weather API may return HTML (Cloudflare block) even with 200 OK
    let wind: { current?: { wind_speed_10m?: number; wind_direction_10m?: number } } | null = null
    try {
      if (windSettled.status === 'fulfilled' && windSettled.value.ok) {
        const windText = await windSettled.value.text()
        wind = JSON.parse(windText)
      }
    } catch {
      // fall back to marine wind fields
    }

    const hourly = marine?.hourly
    if (!hourly?.time?.length) {
      _condCache.set(cacheKey, { result: null, exp: Date.now() + 60_000 })
      return null
    }

    // Pick the nearest future hour — mirrors findNearestFutureHour from lib/forecast/merge.ts
    const now = new Date()
    let idx = (hourly.time as string[]).findIndex((t: string) => new Date(t) >= now)
    if (idx === -1) idx = (hourly.time as string[]).length - 1

    const waveHeight     = (hourly.wave_height as number[])[idx] ?? 0
    const wavePeriod     = (hourly.wave_period as number[])[idx] ?? 0
    const swellDirection = (hourly.swell_wave_direction as number[])[idx] ?? 0
    const windWaveH      = (hourly.wind_wave_height as number[])[idx] ?? 0
    const windWaveDir    = (hourly.wind_wave_direction as number[])[idx] ?? 0

    // Estimate wind speed from wind-wave height when weather API is unavailable
    const estimatedWindSpeed = windWaveH > 0
      ? Math.round(Math.sqrt(windWaveH / 0.0248) * 3.6)
      : 0

    const result: CurrentMarineConditions = {
      waveHeight,
      wavePeriod,
      swellDirection,
      windSpeed:     wind?.current?.wind_speed_10m ?? estimatedWindSpeed,
      windDirection: wind?.current?.wind_direction_10m ?? windWaveDir,
    }
    _condCache.set(cacheKey, { result, exp: Date.now() + COND_CACHE_TTL })
    return result
  } catch {
    _condCache.set(cacheKey, { result: null, exp: Date.now() + 60_000 })
    return null
  }
}

export async function fetchMarineForecast(
  lat: number,
  lng: number
): Promise<OpenMeteoMarineResponse> {
  // SST is included in the main request — it returns null values (not an error)
  // for locations where the model has no ocean coverage, so it's safe to bundle.
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    hourly: [
      'wave_height',
      'wave_direction',
      'wave_period',
      'swell_wave_height',
      'swell_wave_direction',
      'swell_wave_period',
      'wind_wave_height',
      'wind_wave_direction',
      'wind_wave_period',
      'sea_surface_temperature',
    ].join(','),
    forecast_days: '7',
    timezone: 'auto',
  })

  const res = await fetch(`${MARINE_BASE}?${params}`, {
    next: { revalidate: 3600 },
    headers: HEADERS,
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    throw new Error(`Open-Meteo marine API error: ${res.status} ${res.statusText}`)
  }

  return await res.json() as OpenMeteoMarineResponse
}

export async function fetchWindForecast(
  lat: number,
  lng: number
): Promise<OpenMeteoWindResponse> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,weather_code,precipitation_probability',
    wind_speed_unit: 'kmh',
    forecast_days: '7',
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
    // Wind API unavailable — return empty structure so forecast still loads
    // Wind wave direction from marine API will be used as fallback in merge
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
}
