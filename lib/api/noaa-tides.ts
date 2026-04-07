import type { TidePoint } from '@/types/forecast'

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
  const today = new Date()
  const end = new Date(today)
  end.setDate(today.getDate() + 7)

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
