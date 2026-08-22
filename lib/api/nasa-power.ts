// NASA POWER Climatology API — 20-year monthly averages, no API key needed
const BASE = 'https://power.larc.nasa.gov/api/temporal/climatology/point'

export interface MonthlyClimate {
  month: number       // 1–12
  name: string        // 'Jan' etc.
  // Null when POWER has no value for that month — callers must render a gap,
  // never substitute 0. See `powerValue`.
  avgWindSpeedMs: number | null
  avgTempC: number | null
  avgPrecipMmDay: number | null  // mm/day
}

const MONTH_KEYS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

/**
 * NASA POWER signals "no data" with the sentinel -999, not with null or an
 * absent key. `?? 0` therefore only caught the absent case and let -999 through
 * as a real reading: a missing month rendered as -1798 °F, and any month POWER
 * did omit became a genuine 0 °C / 0 m/s that skewed the panel's min/max.
 * Exported for tests.
 */
export function powerValue(v: unknown): number | null {
  if (typeof v !== 'number' || !isFinite(v)) return null
  // POWER uses -999 (and -999.0) as its fill value across every parameter.
  if (v <= -999) return null
  return v
}

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
      avgWindSpeedMs: powerValue(param.WS10M?.[key]),
      avgTempC: powerValue(param.T2M?.[key]),
      avgPrecipMmDay: powerValue(param.PRECTOTCORR?.[key]),
    }))
  } catch {
    return null
  }
}
