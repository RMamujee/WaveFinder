import type { TidePoint } from '@/types/forecast'

const NOAA_TIDES_BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter'

interface NOAATidePrediction {
  t: string   // time "YYYY-MM-DD HH:MM"
  v: string   // value in meters
  type: 'H' | 'L'
}

interface NOAATidesResponse {
  predictions?: NOAATidePrediction[]
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
  const twoDaysLater = new Date(today)
  twoDaysLater.setDate(today.getDate() + 2)

  const params = new URLSearchParams({
    begin_date: formatDate(today),
    end_date: formatDate(twoDaysLater),
    station: stationId,
    product: 'predictions',
    datum: 'MLLW',
    time_zone: 'lst_ldt',
    interval: 'hilo',
    units: 'metric',
    application: 'surf_forecast_app',
    format: 'json',
  })

  const res = await fetch(`${NOAA_TIDES_BASE}?${params}`, {
    next: { revalidate: 3600 },
  })

  if (!res.ok) return []

  const data: NOAATidesResponse = await res.json()

  if (!data.predictions || data.error) return []

  return data.predictions.map((p) => ({
    time: new Date(p.t).toISOString(),
    height: parseFloat(p.v),
    type: p.type,
  }))
}
