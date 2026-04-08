import type { ForecastDay, ForecastHour } from '@/types/forecast'
import type { OpenMeteoMarineResponse, OpenMeteoWindResponse } from '@/lib/api/open-meteo'
import { degreesToCompass, rateSurfConditions, computeWavePower } from './rating'
import { computeUVIndex } from './solar-uv'

export function mergeForecastData(
  marine: OpenMeteoMarineResponse,
  wind: OpenMeteoWindResponse,
  spotFacing: number,
  lat: number
): ForecastHour[] {
  const { hourly: m } = marine
  const { hourly: w } = wind

  // Build lookup maps by time for all wind/weather fields.
  // Using time-keyed maps (not raw index) ensures correct alignment even when
  // the marine and weather API caches were last refreshed at different hours.
  const windMap = new Map<string, { speed: number; gust: number; dir: number }>()
  const tempMap = new Map<string, number>()
  const weatherCodeMap = new Map<string, number>()
  const precipProbMap = new Map<string, number>()

  w.time.forEach((t, i) => {
    windMap.set(t, {
      speed: w.wind_speed_10m[i] ?? 0,
      gust: w.wind_gusts_10m[i] ?? 0,
      dir: w.wind_direction_10m[i] ?? 0,
    })
    if (w.temperature_2m?.[i] != null) tempMap.set(t, w.temperature_2m[i])
    if (w.weather_code?.[i] != null) weatherCodeMap.set(t, w.weather_code[i])
    if (w.precipitation_probability?.[i] != null) precipProbMap.set(t, w.precipitation_probability[i])
  })

  return m.time.map((time, i) => {
    const rawWind = windMap.get(time) ?? { speed: 0, gust: 0, dir: 0 }
    const waveHeight = m.wave_height[i] ?? 0
    const swellHeight = m.swell_wave_height[i] ?? 0
    const swellPeriod = m.swell_wave_period[i] ?? 0
    const swellDirection = m.swell_wave_direction[i] ?? 0

    // When the weather API is unavailable (all zeros), estimate wind speed from
    // wind-wave height using empirical relationship: Hs_wind ≈ 0.0248 × U² (m/s)
    const windWaveH = m.wind_wave_height[i] ?? 0
    const windWaveDir = m.wind_wave_direction[i] ?? 0
    const hasRealWind = rawWind.speed > 0
    const estimatedSpeed = hasRealWind
      ? rawWind.speed
      : windWaveH > 0 ? Math.round(Math.sqrt(windWaveH / 0.0248) * 3.6) : 0
    const windData = {
      speed: estimatedSpeed,
      gust: rawWind.gust > 0 ? rawWind.gust : Math.round(estimatedSpeed * 1.25),
      dir: hasRealWind ? rawWind.dir : windWaveDir,
    }

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
      windWaveHeight: windWaveH,
      wind: {
        speed: windData.speed,
        gust: windData.gust,
        direction: windData.dir,
        directionLabel: degreesToCompass(windData.dir),
      },
      rating,
      ratingScore: score,
      wavePower: computeWavePower(waveHeight, swellPeriod),
      uvIndex: computeUVIndex(lat, time),
      waterTemp: m.sea_surface_temperature?.[i] ?? null,
      airTempC: tempMap.get(time) ?? null,
      weatherCode: weatherCodeMap.get(time) ?? null,
      precipProb: precipProbMap.get(time) ?? null,
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

    const tempsC = dayHours.map(h => h.airTempC).filter((t): t is number => t !== null)
    const minTempC = tempsC.length ? Math.round(Math.min(...tempsC)) : null
    const maxTempC = tempsC.length ? Math.round(Math.max(...tempsC)) : null

    // Use midday weather code as representative for the day
    const midday = dayHours.find(h => h.time.includes('T12:')) ?? dayHours[Math.floor(dayHours.length / 2)]

    const precipProbs = dayHours.map(h => h.precipProb).filter((p): p is number => p !== null)
    const maxPrecipProb = precipProbs.length ? Math.max(...precipProbs) : null

    return {
      date,
      hours: dayHours,
      maxWaveHeight: Math.round(maxWaveHeight * 10) / 10,
      avgPeriod: Math.round(avgPeriod * 10) / 10,
      dominantRating,
      minTempC,
      maxTempC,
      weatherCode: midday?.weatherCode ?? null,
      maxPrecipProb,
    }
  })
}

export function findNearestFutureHour(hours: ForecastHour[]): ForecastHour | null {
  const now = new Date()
  return (
    hours.find((h) => new Date(h.time) >= now) ?? hours[hours.length - 1] ?? null
  )
}
