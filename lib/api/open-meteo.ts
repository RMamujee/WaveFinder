const MARINE_BASE = 'https://marine-api.open-meteo.com/v1/marine'
const WEATHER_BASE = 'https://api.open-meteo.com/v1/forecast'

const FETCH_TIMEOUT = 12000

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

/**
 * Fetch just the current (now) marine conditions from Open-Meteo.
 * Much lighter than a full 7-day forecast. Used as fallback when NOAA buoy is offline.
 */
export async function fetchCurrentConditions(
  lat: number,
  lng: number
): Promise<CurrentMarineConditions | null> {
  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      current: [
        'wave_height',
        'wave_period',
        'swell_wave_direction',
        'wind_speed_10m',
        'wind_direction_10m',
      ].join(','),
      wind_speed_unit: 'kmh',
      timezone: 'auto',
    })

    const [marineRes, windRes] = await Promise.all([
      fetch(`${MARINE_BASE}?${params}`, {
        next: { revalidate: 1800 },
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      }),
      fetch(`${WEATHER_BASE}?${new URLSearchParams({
        latitude: lat.toString(),
        longitude: lng.toString(),
        current: 'wind_speed_10m,wind_direction_10m',
        wind_speed_unit: 'kmh',
        timezone: 'auto',
      })}`, {
        next: { revalidate: 1800 },
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      }),
    ])

    if (!marineRes.ok) return null

    const marine = await marineRes.json()
    const wind = windRes.ok ? await windRes.json() : null

    const c = marine?.current
    if (!c) return null

    return {
      waveHeight:     c.wave_height ?? 0,
      wavePeriod:     c.wave_period ?? 0,
      swellDirection: c.swell_wave_direction ?? 0,
      windSpeed:      wind?.current?.wind_speed_10m ?? c.wind_speed_10m ?? 0,
      windDirection:  wind?.current?.wind_direction_10m ?? c.wind_direction_10m ?? 0,
    }
  } catch {
    return null
  }
}

export async function fetchMarineForecast(
  lat: number,
  lng: number
): Promise<OpenMeteoMarineResponse> {
  // Core wave params — always available
  const coreParams = new URLSearchParams({
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

  const res = await fetch(`${MARINE_BASE}?${coreParams}`, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  })

  if (!res.ok) {
    throw new Error(`Open-Meteo marine API error: ${res.status} ${res.statusText}`)
  }

  const data: OpenMeteoMarineResponse = await res.json()

  // Sea surface temperature — optional, not available at all coordinates
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
      signal: AbortSignal.timeout(8000),
    })
    if (sstRes.ok) {
      const sstData = await sstRes.json()
      if (sstData?.hourly?.sea_surface_temperature) {
        data.hourly.sea_surface_temperature = sstData.hourly.sea_surface_temperature
      }
    }
  } catch {
    // SST not available — UV & water panel will show "not available"
  }

  return data
}

export async function fetchWindForecast(
  lat: number,
  lng: number
): Promise<OpenMeteoWindResponse> {
  // Core wind params
  const coreParams = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    wind_speed_unit: 'kmh',
    forecast_days: '7',
    timezone: 'auto',
  })

  const res = await fetch(`${WEATHER_BASE}?${coreParams}`, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  })

  if (!res.ok) {
    throw new Error(`Open-Meteo weather API error: ${res.status} ${res.statusText}`)
  }

  const data: OpenMeteoWindResponse = await res.json()

  // UV index — optional separate call
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
      signal: AbortSignal.timeout(8000),
    })
    if (uvRes.ok) {
      const uvData = await uvRes.json()
      if (uvData?.hourly?.uv_index) {
        data.hourly.uv_index = uvData.hourly.uv_index
      }
    }
  } catch {
    // UV not available for this location
  }

  return data
}
