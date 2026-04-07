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
    uv_index?: number[]
  }
}

export interface CurrentMarineConditions {
  waveHeight: number
  wavePeriod: number
  swellDirection: number
  windSpeed: number
  windDirection: number
}

export async function fetchCurrentConditions(
  lat: number,
  lng: number
): Promise<CurrentMarineConditions | null> {
  try {
    // Marine API only accepts marine variables — weather vars (wind_speed_10m etc.) cause 400
    const marineParams = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      current: 'wave_height,wave_period,swell_wave_direction,wind_wave_height,wind_wave_direction',
      timezone: 'auto',
    })

    const weatherParams = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      current: 'wind_speed_10m,wind_direction_10m',
      wind_speed_unit: 'kmh',
      timezone: 'auto',
    })

    const [marineRes, windRes] = await Promise.all([
      fetch(`${MARINE_BASE}?${marineParams}`, { next: { revalidate: 1800 }, headers: HEADERS }),
      fetch(`${WEATHER_BASE}?${weatherParams}`, { next: { revalidate: 1800 }, headers: HEADERS }),
    ])

    if (!marineRes.ok) return null

    const marine = await marineRes.json()

    // Parse wind separately — weather API may return HTML (Cloudflare block) even with 200 OK
    let wind: { current?: { wind_speed_10m?: number; wind_direction_10m?: number } } | null = null
    try {
      if (windRes.ok) {
        const windText = await windRes.text()
        wind = JSON.parse(windText)
      }
    } catch {
      // Weather API returned non-JSON (e.g. Cloudflare HTML) — fall back to marine wind fields
    }

    const c = marine?.current
    if (!c) return null

    // Estimate wind speed from wind-wave height when weather API is unavailable
    const windWaveH = c.wind_wave_height ?? 0
    const estimatedWindSpeed = windWaveH > 0
      ? Math.round(Math.sqrt(windWaveH / 0.0248) * 3.6)
      : 0

    return {
      waveHeight:     c.wave_height ?? 0,
      wavePeriod:     c.wave_period ?? 0,
      swellDirection: c.swell_wave_direction ?? 0,
      windSpeed:      wind?.current?.wind_speed_10m ?? estimatedWindSpeed,
      windDirection:  wind?.current?.wind_direction_10m ?? c.wind_wave_direction ?? 0,
    }
  } catch {
    return null
  }
}

export async function fetchMarineForecast(
  lat: number,
  lng: number
): Promise<OpenMeteoMarineResponse> {
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
    ].join(','),
    forecast_days: '7',
    timezone: 'auto',
  })

  const res = await fetch(`${MARINE_BASE}?${params}`, {
    next: { revalidate: 3600 },
    headers: HEADERS,
  })

  if (!res.ok) {
    throw new Error(`Open-Meteo marine API error: ${res.status} ${res.statusText}`)
  }

  const data: OpenMeteoMarineResponse = await res.json()

  // Sea surface temperature — optional, silently skipped if unavailable
  try {
    const sstParams = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      hourly: 'sea_surface_temperature',
      forecast_days: '7',
      timezone: 'auto',
    })
    const sstRes = await fetch(`${MARINE_BASE}?${sstParams}`, {
      next: { revalidate: 3600 },
    })
    if (sstRes.ok) {
      const sstData = await sstRes.json()
      if (Array.isArray(sstData?.hourly?.sea_surface_temperature)) {
        data.hourly.sea_surface_temperature = sstData.hourly.sea_surface_temperature
      }
    }
  } catch {
    // SST unavailable for this location — water temp panel will show "not available"
  }

  return data
}

export async function fetchWindForecast(
  lat: number,
  lng: number
): Promise<OpenMeteoWindResponse> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    wind_speed_unit: 'kmh',
    forecast_days: '7',
    timezone: 'auto',
  })

  try {
    const res = await fetch(`${WEATHER_BASE}?${params}`, {
      next: { revalidate: 3600 },
      headers: HEADERS,
    })

    if (!res.ok) throw new Error(`status ${res.status}`)

    const text = await res.text()
    const data: OpenMeteoWindResponse = JSON.parse(text)

    // UV index — optional, silently skipped if unavailable
    try {
      const uvParams = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lng.toString(),
        hourly: 'uv_index',
        forecast_days: '7',
        timezone: 'auto',
      })
      const uvRes = await fetch(`${WEATHER_BASE}?${uvParams}`, {
        next: { revalidate: 3600 },
        headers: HEADERS,
      })
      if (uvRes.ok) {
        const uvText = await uvRes.text()
        const uvData = JSON.parse(uvText)
        if (Array.isArray(uvData?.hourly?.uv_index)) {
          data.hourly.uv_index = uvData.hourly.uv_index
        }
      }
    } catch { /* UV unavailable */ }

    return data
  } catch {
    // Wind API unavailable — return empty structure so forecast still loads
    // Wind wave direction from marine API will be used as fallback in merge
    return {
      hourly: {
        time: [],
        wind_speed_10m: [],
        wind_direction_10m: [],
        wind_gusts_10m: [],
      },
    }
  }
}
