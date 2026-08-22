const AIR_BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality'

const HEADERS = {
  'User-Agent': 'WaveFinder/1.0 surf-forecast-app',
  'Accept': 'application/json',
}

export interface CurrentAirQuality {
  usAqi: number | null
  europeanAqi: number | null
  pm25: number | null
  pm10: number | null
  dust: number | null
  label: string
  color: string
  bg: string
}

/**
 * Pick the entry for the spot's in-progress local hour. Exported for tests.
 *
 * The request uses `timezone=auto`, so Open-Meteo's `hourly.time` strings are
 * the SPOT's local clock with no offset — `new Date().getHours()` is the
 * server's clock (UTC on Vercel), so comparing the two was off by the spot's
 * entire UTC offset (+7 h for California, and enough to roll the date for
 * Hawaii). Shift now by `utc_offset_seconds` and compare hour-truncated
 * strings, the same technique as `findNearestFutureHour` / `pickHourIndex`.
 *
 * When nothing matches, return the NEAREST hour — the last entry when the
 * whole window is already in the past — never index 0, which would report
 * yesterday's air as current.
 */
export function pickAirHourIndex(
  times: string[],
  utcOffsetSeconds: number,
  nowMs: number = Date.now()
): number {
  if (!times.length) return -1
  const nowLocalHour = new Date(nowMs + utcOffsetSeconds * 1000).toISOString().slice(0, 13)
  const idx = times.findIndex((t) => t.slice(0, 13) >= nowLocalHour)
  return idx === -1 ? times.length - 1 : idx
}

function aqiInfo(aqi: number): { label: string; color: string; bg: string } {
  if (aqi <= 50)  return { label: 'Good',                   color: '#16a34a', bg: '#f0fdf4' }
  if (aqi <= 100) return { label: 'Moderate',               color: '#d97706', bg: '#fffbeb' }
  if (aqi <= 150) return { label: 'Sensitive Groups',       color: '#f97316', bg: '#fff7ed' }
  if (aqi <= 200) return { label: 'Unhealthy',              color: '#dc2626', bg: '#fef2f2' }
  if (aqi <= 300) return { label: 'Very Unhealthy',         color: '#7c3aed', bg: '#f5f3ff' }
  return               { label: 'Hazardous',               color: '#7f1d1d', bg: '#fff1f2' }
}

export async function fetchAirQuality(lat: number, lng: number): Promise<CurrentAirQuality | null> {
  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      hourly: 'us_aqi,european_aqi,pm2_5,pm10,dust',
      forecast_days: '1',
      timezone: 'auto',
    })
    const res = await fetch(`${AIR_BASE}?${params}`, {
      headers: HEADERS,
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const json = await res.json()
    const h = json.hourly
    if (!h) return null

    const times: string[] = h.time ?? []
    const idx = pickAirHourIndex(times, json.utc_offset_seconds ?? 0)
    if (idx < 0) return null

    const usAqi: number | null = h.us_aqi?.[idx] ?? null
    const info = usAqi !== null ? aqiInfo(usAqi) : { label: 'Unknown', color: '#6b7280', bg: '#f9fafb' }

    return {
      usAqi,
      europeanAqi: h.european_aqi?.[idx] ?? null,
      pm25: h.pm2_5?.[idx] ?? null,
      pm10: h.pm10?.[idx] ?? null,
      dust: h.dust?.[idx] ?? null,
      ...info,
    }
  } catch {
    return null
  }
}
