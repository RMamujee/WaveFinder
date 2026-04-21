import type { TidePoint, CoastalWindReading } from '@/types/forecast'

const NOAA_TIDES_BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter'

interface NOAATideHourly {
  t: string  // "YYYY-MM-DD HH:MM"
  v: string  // height in meters
}

interface NOAATidesResponse {
  predictions?: NOAATideHourly[]
  error?: { message: string }
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

export async function fetchTidePredictions(stationId: string): Promise<TidePoint[]> {
  // Start 1 day before today so the server's UTC clock never misses the
  // spot's local "today" (Vercel runs UTC; a California spot at 11pm is
  // still "today" locally but "tomorrow" UTC).
  const today = new Date()
  today.setDate(today.getDate() - 1)
  const end = new Date(today)
  end.setDate(today.getDate() + 8)

  // Fetch hourly predictions for 7 days — gives a smooth curve (168 points)
  // and enough data to filter by any day in the forecast window.
  const params = new URLSearchParams({
    begin_date: formatDate(today),
    end_date:   formatDate(end),
    station:    stationId,
    product:    'predictions',
    datum:      'MLLW',
    time_zone:  'lst_ldt',
    interval:   'h',          // hourly — smooth curve
    units:      'metric',
    application: 'surf_forecast_app',
    format:     'json',
  })

  const res = await fetch(`${NOAA_TIDES_BASE}?${params}`, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) return []

  const data: NOAATidesResponse = await res.json()
  if (!data.predictions || data.error) return []

  const raw = data.predictions.map((p) => ({
    // Keep time as local "YYYY-MM-DDTHH:MM" so date filters work correctly
    time:   p.t.replace(' ', 'T'),
    height: Math.round(parseFloat(p.v) * 100) / 100,
    type:   null as 'H' | 'L' | null,
  }))

  // Detect local maxima (High) and minima (Low) from the hourly series
  for (let i = 1; i < raw.length - 1; i++) {
    const prev = raw[i - 1].height
    const curr = raw[i].height
    const next = raw[i + 1].height
    if (curr > prev && curr > next) raw[i].type = 'H'
    else if (curr < prev && curr < next) raw[i].type = 'L'
  }

  return raw
}

// ── Observed coastal wind from NOAA CO-OPS (same station as tides) ───────────
// Not all tide stations have wind sensors — returns null gracefully when missing.
export async function fetchCoastalWind(stationId: string): Promise<CoastalWindReading | null> {
  const params = new URLSearchParams({
    station:     stationId,
    product:     'wind',
    date:        'latest',
    time_zone:   'lst_ldt',
    units:       'metric',
    application: 'surf_forecast_app',
    format:      'json',
  })
  try {
    const res = await fetch(`${NOAA_TIDES_BASE}?${params}`, {
      next: { revalidate: 600 },        // 10-min cache; CO-OPS updates every 6 min
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const json = await res.json()
    if (json?.error || !Array.isArray(json?.data) || json.data.length === 0) return null
    const row = json.data[0]
    const speed = parseFloat(row?.s)
    const dir   = parseFloat(row?.d)
    if (isNaN(speed) || isNaN(dir)) return null
    return {
      time:         row.t as string,
      speedMps:     speed,
      directionDeg: dir,
      gustMps:      row.g ? parseFloat(row.g) : null,
      stationId,
    }
  } catch {
    return null
  }
}
