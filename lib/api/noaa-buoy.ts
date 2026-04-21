import type { BuoyReading } from '@/types/forecast'

const NDBC_BASE = 'https://www.ndbc.noaa.gov/data/realtime2'

export async function fetchBuoyData(buoyId: string): Promise<BuoyReading | null> {
  try {
    const res = await fetch(`${NDBC_BASE}/${buoyId}.txt`, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return null

    const text = await res.text()
    const lines = text.split('\n').filter((l) => l.trim().length > 0)

    if (lines.length < 3) return null

    // Line 0: headers (prefixed with #)
    // Line 1: units (prefixed with #)
    // Line 2+: data (most recent first)
    const headerLine = lines[0].replace(/^#\s*/, '')
    const dataLine = lines[2]

    if (!dataLine) return null

    const headers = headerLine.trim().split(/\s+/)
    const values = dataLine.trim().split(/\s+/)

    const get = (col: string): number | null => {
      const idx = headers.indexOf(col)
      if (idx === -1 || idx >= values.length) return null
      const v = values[idx]
      if (v === 'MM' || v === 'N/A') return null
      const n = parseFloat(v)
      return isNaN(n) ? null : n
    }

    const year = values[0]
    const month = values[1]?.padStart(2, '0')
    const day = values[2]?.padStart(2, '0')
    const hour = values[3]?.padStart(2, '0')
    const min = values[4]?.padStart(2, '0')

    return {
      time: `${year}-${month}-${day}T${hour}:${min}:00Z`,
      waveHeight: get('WVHT'),           // null if sensor offline (MM)
      dominantPeriod: get('DPD'),        // null if sensor offline
      averagePeriod: get('APD') ?? null,
      meanDirection: get('MWD') ?? 0,
      waterTemp: get('WTMP'),
      airTemp: get('ATMP'),
      windSpeed: get('WSPD'),
      windDirection: get('WDIR'),
    }
  } catch {
    return null
  }
}
