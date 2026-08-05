import type { ForecastDay, ForecastHour, TidePoint } from '@/types/forecast'
import type { OpenMeteoMarineResponse, OpenMeteoWindResponse } from '@/lib/api/open-meteo'
import { degreesToCompass, rateSurfConditions, computeWavePower } from './rating'
import type { TideContext } from './rating'
import { computeUVIndex } from './solar-uv'

export interface MergeContext {
  spotFacing: number
  lat: number
  /** Hourly tide predictions for the spot's NOAA station, if it has one.
   *  Absent tide simply drops the tide factor from the rating. */
  tides?: TidePoint[] | null
  bottomType?: string | null
}

export function mergeForecastData(
  marine: OpenMeteoMarineResponse,
  wind: OpenMeteoWindResponse,
  ctx: MergeContext
): ForecastHour[] {
  const { spotFacing, lat } = ctx
  const { hourly: m } = marine
  const { hourly: w } = wind

  // Tide index keyed by local "YYYY-MM-DDTHH:MM" — the same local-clock format
  // Open-Meteo returns, so hours line up without timezone conversion.
  const tideByTime = new Map<string, number>()
  let tideMin = Infinity
  let tideMax = -Infinity
  for (const p of ctx.tides ?? []) {
    tideByTime.set(p.time, p.height)
    if (p.height < tideMin) tideMin = p.height
    if (p.height > tideMax) tideMax = p.height
  }
  const hasTides = tideByTime.size > 0 && isFinite(tideMin) && isFinite(tideMax)

  // Build lookup maps by time for all wind/weather fields.
  // Using time-keyed maps (not raw index) ensures correct alignment even when
  // the marine and weather API caches were last refreshed at different hours.
  // An entry exists only when the API reported a speed for that hour — a
  // genuine 0 km/h (dead glassy, the best possible wind) gets an entry, while
  // a missing hour does not. `speed > 0` used to stand in for "has data",
  // which replaced real calms with an invented onshore wind estimate.
  const windMap = new Map<string, { speed: number; gust: number; dir: number | null }>()
  const tempMap = new Map<string, number>()
  const weatherCodeMap = new Map<string, number>()
  const precipProbMap = new Map<string, number>()

  w.time.forEach((t, i) => {
    if (w.wind_speed_10m[i] != null) {
      windMap.set(t, {
        speed: w.wind_speed_10m[i],
        gust: w.wind_gusts_10m[i] ?? 0,
        dir: w.wind_direction_10m[i] ?? null,
      })
    }
    if (w.temperature_2m?.[i] != null) tempMap.set(t, w.temperature_2m[i])
    if (w.weather_code?.[i] != null) weatherCodeMap.set(t, w.weather_code[i])
    if (w.precipitation_probability?.[i] != null) precipProbMap.set(t, w.precipitation_probability[i])
  })

  const hours: ForecastHour[] = []
  m.time.forEach((time, i) => {
    const rawWaveHeight = m.wave_height[i] as number | null
    const rawSwellHeight = m.swell_wave_height[i] as number | null
    // No sea state from the primary model OR the long-range fill: drop the
    // hour instead of fabricating a fully-formed 0 m / 0 s reading rated
    // "poor". Live example: day 15 with 19 of 24 hours at zero dragged the
    // day's average period to 2.9 s while displaying as a real calm.
    if (rawWaveHeight == null && rawSwellHeight == null) return

    const rawWind = windMap.get(time)
    const waveHeight = rawWaveHeight ?? 0
    const swellHeight = rawSwellHeight ?? 0
    const swellPeriod = m.swell_wave_period[i] ?? 0
    const wavePeriod = m.wave_period[i] ?? 0
    // Preserve null for the rating input: the engine scores an unknown swell
    // direction neutrally (exposure 1), but a `?? 0` here scored missing data
    // as a real due-north swell and collapsed exposure to the wrap floor.
    const ratingSwellDirection = m.swell_wave_direction[i] ?? null

    // When the weather API had no entry for this hour, estimate wind speed from
    // wind-wave height using empirical relationship: Hs_wind ≈ 0.0248 × U² (m/s)
    const windWaveH = m.wind_wave_height[i] as number | null
    const windWaveDir = m.wind_wave_direction[i] ?? 0
    const estimatedSpeed = rawWind
      ? rawWind.speed
      : windWaveH != null && windWaveH > 0 ? Math.round(Math.sqrt(windWaveH / 0.0248) * 3.6) : 0
    const windData = {
      speed: estimatedSpeed,
      gust: rawWind && rawWind.gust > 0 ? rawWind.gust : Math.round(estimatedSpeed * 1.25),
      // Rating direction: null unless the weather API reported one. An
      // estimated speed paired with wind_wave_direction used to convert a
      // glassy-calm hour into a rated onshore blow; the engine's speed-only
      // branch exists precisely for this case.
      ratingDir: rawWind ? rawWind.dir : null,
      // Display direction keeps the wind-wave stand-in so compasses/labels
      // still render something plausible.
      displayDir: (rawWind ? rawWind.dir : null) ?? windWaveDir,
    }

    const tideHeight = tideByTime.get(time)
    const tide: TideContext | null = hasTides && tideHeight != null
      ? { height: tideHeight, min: tideMin, max: tideMax }
      : null

    const { score, rating, faceHeight } = rateSurfConditions({
      waveHeight,
      // The engine falls back to total sea height when the swell partition is
      // missing — mirror that for period or the fallback computes a 0 m face.
      swellPeriod: swellPeriod > 0 ? swellPeriod : wavePeriod,
      swellHeight,
      // Null (not 0) when the model omitted the partition, so the cleanliness
      // factor renormalises away instead of scoring "perfectly clean".
      windWaveHeight: windWaveH,
      windSpeed: windData.speed,
      windDirection: windData.ratingDir,
      swellDirection: ratingSwellDirection,
      spotFacing,
      tide,
      bottomType: ctx.bottomType,
    })

    hours.push({
      time,
      waveHeight,
      faceHeight,
      wavePeriod,
      waveDirection: m.wave_direction[i] ?? 0,
      swellHeight,
      swellPeriod,
      swellDirection: ratingSwellDirection ?? 0,
      windWaveHeight: windWaveH ?? 0,
      wind: {
        speed: windData.speed,
        gust: windData.gust,
        direction: windData.displayDir,
        directionLabel: degreesToCompass(windData.displayDir),
      },
      rating,
      ratingScore: score,
      wavePower: computeWavePower(waveHeight, swellPeriod),
      uvIndex: computeUVIndex(lat, time),
      waterTemp: m.sea_surface_temperature?.[i] ?? null,
      airTempC: tempMap.get(time) ?? null,
      weatherCode: weatherCodeMap.get(time) ?? null,
      precipProb: precipProbMap.get(time) ?? null,
      isLongRange: m.is_long_range?.[i] ?? false,
    })
  })
  return hours
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
    const maxFaceHeight = Math.max(...dayHours.map((h) => h.faceHeight))
    // Hours with no swell decomposition carry swellPeriod 0 — averaging those
    // in reported a 15 s day as 8 s. Average over the hours that have one.
    const periods = dayHours.map((h) => h.swellPeriod).filter((p) => p > 0)
    const avgPeriod = periods.length
      ? periods.reduce((sum, p) => sum + p, 0) / periods.length
      : 0

    // Dominant rating over *surfable* hours only. This previously counted all 24
    // hours despite the comment claiming otherwise, so a day that was good from
    // dawn to dusk got outvoted by 12 hours of darkness nobody surfs.
    const daylight = dayHours.filter((h) => {
      const hour = Number(h.time.slice(11, 13))
      return hour >= 6 && hour <= 18
    })
    const ratedHours = daylight.length ? daylight : dayHours

    const ratingCounts: Record<string, number> = {}
    for (const h of ratedHours) {
      ratingCounts[h.rating] = (ratingCounts[h.rating] ?? 0) + 1
    }
    // Ties break toward the better rating — a day split evenly between "good"
    // and "fair" is worth paddling out for.
    const RATING_ORDER: ForecastDay['dominantRating'][] = ['poor', 'fair', 'good', 'epic']
    const dominantRating = (Object.entries(ratingCounts).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return RATING_ORDER.indexOf(b[0] as ForecastDay['dominantRating'])
        - RATING_ORDER.indexOf(a[0] as ForecastDay['dominantRating'])
    })[0]?.[0] ?? 'poor') as ForecastDay['dominantRating']

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
      maxFaceHeight: Math.round(maxFaceHeight * 10) / 10,
      avgPeriod: Math.round(avgPeriod * 10) / 10,
      dominantRating,
      minTempC,
      maxTempC,
      weatherCode: midday?.weatherCode ?? null,
      maxPrecipProb,
    }
  })
}

// Open-Meteo returns time strings as the spot's local clock, with no offset
// suffix. `new Date(h.time)` would parse these as the server's local time
// (UTC on Vercel), which produces a wrong "now" hour for any non-UTC spot —
// e.g. a Hawaii forecast hour read at 12:00 UTC compares as if it were
// 12:00 PT, picking the wrong hour. Pass utcOffsetSeconds (from Open-Meteo
// response) so we can compute the spot's local "now".
export function findNearestFutureHour(
  hours: ForecastHour[],
  utcOffsetSeconds = 0,
): ForecastHour | null {
  const nowAtSpot = new Date(Date.now() + utcOffsetSeconds * 1000)
  // Strip Z to compare as local-clock against spot-local time strings.
  // Truncated to the HOUR: comparing with minutes included excluded the
  // in-progress hour for 59 of every 60 minutes, so "current conditions" were
  // systematically the NEXT hour (~30 min ahead on average).
  const nowIso = nowAtSpot.toISOString().slice(0, 13)
  return (
    hours.find((h) => h.time.slice(0, 13) >= nowIso) ?? hours[hours.length - 1] ?? null
  )
}
