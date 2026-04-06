import type { ForecastDay, ForecastHour } from '@/types/forecast'
import type { OpenMeteoMarineResponse, OpenMeteoWindResponse } from '@/lib/api/open-meteo'
import { degreesToCompass, rateSurfConditions, computeWavePower } from './rating'

export function mergeForecastData(
  marine: OpenMeteoMarineResponse,
  wind: OpenMeteoWindResponse,
  spotFacing: number
): ForecastHour[] {
  const { hourly: m } = marine
  const { hourly: w } = wind

  // Build wind map by time for fast lookup
  const windMap = new Map<string, { speed: number; gust: number; dir: number }>()
  w.time.forEach((t, i) => {
    windMap.set(t, {
      speed: w.wind_speed_10m[i] ?? 0,
      gust: w.wind_gusts_10m[i] ?? 0,
      dir: w.wind_direction_10m[i] ?? 0,
    })
  })

  // Build UV index map by time
  const uvMap = new Map<string, number>()
  w.time.forEach((t, i) => { uvMap.set(t, w.uv_index?.[i] ?? 0) })

  return m.time.map((time, i) => {
    const windData = windMap.get(time) ?? { speed: 0, gust: 0, dir: 0 }
    const waveHeight = m.wave_height[i] ?? 0
    const swellHeight = m.swell_wave_height[i] ?? 0
    const swellPeriod = m.swell_wave_period[i] ?? 0
    const swellDirection = m.swell_wave_direction[i] ?? 0

    const { score, rating } = rateSurfConditions({
      waveHeight,
      swellPeriod,
      swellHeight,
      windSpeed: windData.speed,
      windDirection: windData.dir,
      swellDirection,
      spotFacing,
    })

    return {
      time,
      waveHeight,
      wavePeriod: m.wave_period[i] ?? 0,
      waveDirection: m.wave_direction[i] ?? 0,
      swellHeight,
      swellPeriod,
      swellDirection,
      windWaveHeight: m.wind_wave_height[i] ?? 0,
      wind: {
        speed: windData.speed,
        gust: windData.gust,
        direction: windData.dir,
        directionLabel: degreesToCompass(windData.dir),
      },
      rating,
      ratingScore: score,
      wavePower: computeWavePower(waveHeight, swellPeriod),
      uvIndex: uvMap.get(time) ?? 0,
      waterTemp: m.sea_surface_temperature?.[i] ?? null,
    }
  })
}

export function groupHoursByDay(hours: ForecastHour[]): ForecastDay[] {
  const dayMap = new Map<string, ForecastHour[]>()

  for (const h of hours) {
    const date = h.time.split('T')[0]
    if (!dayMap.has(date)) dayMap.set(date, [])
    dayMap.get(date)!.push(h)
  }

  return Array.from(dayMap.entries()).map(([date, dayHours]) => {
    const maxWaveHeight = Math.max(...dayHours.map((h) => h.waveHeight))
    const avgPeriod =
      dayHours.reduce((sum, h) => sum + h.swellPeriod, 0) / dayHours.length

    // Find dominant rating: prefer best rating that appears most in daytime hours (6am-6pm)
    const ratingCounts: Record<string, number> = {}
    for (const h of dayHours) {
      ratingCounts[h.rating] = (ratingCounts[h.rating] ?? 0) + 1
    }
    const dominantRating = (Object.entries(ratingCounts).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] ?? 'poor') as ForecastDay['dominantRating']

    return {
      date,
      hours: dayHours,
      maxWaveHeight: Math.round(maxWaveHeight * 10) / 10,
      avgPeriod: Math.round(avgPeriod * 10) / 10,
      dominantRating,
    }
  })
}

export function findNearestFutureHour(hours: ForecastHour[]): ForecastHour | null {
  const now = new Date()
  return (
    hours.find((h) => new Date(h.time) >= now) ?? hours[hours.length - 1] ?? null
  )
}
