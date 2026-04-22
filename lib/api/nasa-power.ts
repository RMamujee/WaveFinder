// NASA POWER Climatology API — 20-year monthly averages, no API key needed
const BASE = 'https://power.larc.nasa.gov/api/temporal/climatology/point'

export interface MonthlyClimate {
  month: number       // 1–12
  name: string        // 'Jan' etc.
  avgWindSpeedMs: number
  avgTempC: number
  avgPrecipMmDay: number  // mm/day
}

const MONTH_KEYS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export async function fetchSeasonalClimate(lat: number, lng: number): Promise<MonthlyClimate[] | null> {
  try {
    const params = new URLSearchParams({
      parameters: 'WS10M,T2M,PRECTOTCORR',
      community: 'RE',
      longitude: lng.toString(),
      latitude: lat.toString(),
      format: 'JSON',
    })
    const res = await fetch(`${BASE}?${params}`, {
      next: { revalidate: 86400 * 30 },  // 30-day cache — climatology is stable
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return null
    const json = await res.json()
    const param = json?.properties?.parameter
    if (!param) return null

    return MONTH_KEYS.map((key, i) => ({
      month: i + 1,
      name: MONTH_NAMES[i],
      avgWindSpeedMs: param.WS10M?.[key] ?? 0,
      avgTempC: param.T2M?.[key] ?? 0,
      avgPrecipMmDay: param.PRECTOTCORR?.[key] ?? 0,
    }))
  } catch {
    return null
  }
}
