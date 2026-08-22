import type { BuoyReading, ForecastDay, ForecastHour, TidePoint } from '@/types/forecast'
import type { OpenMeteoMarineResponse, OpenMeteoWindResponse } from '@/lib/api/open-meteo'
import { degreesToCompass, rateSurfConditions, computeWavePower } from './rating'
import type { SpotDifficulty, SwellPartition, TideContext } from './rating'
import { computeUVIndex } from './solar-uv'

export interface MergeContext {
  spotFacing: number
  lat: number
  /** Hourly tide predictions for the spot's NOAA station, if it has one.
   *  Absent tide simply drops the tide factor from the rating. */
  tides?: TidePoint[] | null
  bottomType?: string | null
  /** Rescales the height curve — a beginner break peaks far below Nazaré. */
  difficulty?: SpotDifficulty | null
  /** Latest NDBC observation for the spot's buoy. Used to nudge the model's
   *  near-term swell period/direction toward what is actually in the water. */
  buoy?: BuoyReading | null
  /** Clock reference, for tests. Defaults to Date.now(). */
  nowMs?: number
}

// ── Buoy correction ──────────────────────────────────────────────────────────
//
// NDBC observations were fetched and displayed but never reached the rating.
// Live at Huntington Beach the buoy read 13 s @ 156° while the rating consumed
// the model's 6.7 s @ 273° — a period score of 15 against an observation-
// supported 90. Mean |dominant-period gap| across sampled buoys was 4.0 s.
//
// The observation is a point measurement of *now*, so it is blended in (not
// substituted) and its weight decays to zero over the next few hours. It is
// never allowed to invent data: an offline sensor (MM → null) or an
// implausible reading is simply ignored.
const BUOY_MAX_AGE_HOURS = 3      // older than this and it is not "now" any more
const BUOY_BLEND_HOURS = 6        // weight fades linearly to 0 across this span
const BUOY_MAX_WEIGHT = 0.6       // observation vs model at the observed hour
const BUOY_MIN_PERIOD = 3
const BUOY_MAX_PERIOD = 25

/** Circular interpolation between two compass bearings (0 = a, 1 = b). */
function blendBearings(a: number, b: number, weight: number): number {
  const ar = (a * Math.PI) / 180
  const br = (b * Math.PI) / 180
  const x = (1 - weight) * Math.cos(ar) + weight * Math.cos(br)
  const y = (1 - weight) * Math.sin(ar) + weight * Math.sin(br)
  // Exactly opposing bearings at equal weight cancel — keep the model's.
  if (x === 0 && y === 0) return a
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360
}

interface BuoyCorrection {
  period: number | null
  direction: number | null
  /** Blend weight for a forecast hour's local-clock time string. */
  weightAt(time: string): number
}

function buildBuoyCorrection(
  buoy: BuoyReading | null | undefined,
  utcOffsetSeconds: number,
  nowMs: number
): BuoyCorrection | null {
  if (!buoy) return null

  const period = buoy.dominantPeriod != null
    && buoy.dominantPeriod >= BUOY_MIN_PERIOD
    && buoy.dominantPeriod <= BUOY_MAX_PERIOD
    ? buoy.dominantPeriod
    : null
  const direction = buoy.meanDirection != null
    && buoy.meanDirection >= 0
    && buoy.meanDirection <= 360
    ? buoy.meanDirection
    : null
  if (period == null && direction == null) return null

  const observedMs = Date.parse(buoy.time)
  if (!isFinite(observedMs)) return null
  const ageHours = (nowMs - observedMs) / 3_600_000
  // Negative age (clock skew) is tolerated by an hour; a stale reading is not a
  // description of the current sea state and must not be blended into it.
  if (ageHours < -1 || ageHours > BUOY_MAX_AGE_HOURS) return null

  // The observation's instant expressed in the spot's local clock, so it can be
  // compared against Open-Meteo's offset-less local time strings.
  const observedLocalMs = observedMs + utcOffsetSeconds * 1000

  return {
    period,
    direction,
    weightAt(time: string): number {
      const hourMs = Date.parse(`${time}:00Z`)
      if (!isFinite(hourMs)) return 0
      const deltaHours = (hourMs - observedLocalMs) / 3_600_000
      if (deltaHours < -1 || deltaHours > BUOY_BLEND_HOURS) return 0
      return BUOY_MAX_WEIGHT * (1 - Math.max(0, deltaHours) / BUOY_BLEND_HOURS)
    },
  }
}

export function mergeForecastData(
  marine: OpenMeteoMarineResponse,
  /** Null/undefined, or a payload with no usable `hourly`, means "no wind data
   *  for any hour" — every hour then falls back to the windsea estimate, or to
   *  an honest null. `fetchWindForecast` REJECTS on an upstream failure rather
   *  than resolving an empty structure (which withCache would have written over
   *  the last-known-good copy), so a caller handing us nothing is the normal
   *  degraded path and must never throw here. */
  wind: OpenMeteoWindResponse | null | undefined,
  ctx: MergeContext
): ForecastHour[] {
  const { spotFacing, lat } = ctx
  const { hourly: m } = marine
  const w = wind?.hourly

  // Tide index keyed by local "YYYY-MM-DDTHH:MM" — the same local-clock format
  // Open-Meteo returns, so hours line up without timezone conversion.
  // One canonical series, sorted and de-duplicated, feeding both the height
  // lookup and the rise/fall trend.
  //
  // On the autumn DST fall-back the local clock repeats an hour, so NOAA emits
  // two rows for e.g. 01:00. Keeping the first is deterministic and matches the
  // hour a forecast timestamp of 01:00 refers to first; more importantly, both
  // derived structures now agree. Deduplicating only the height map left the
  // trend differencing against a phantom step, which flipped the following
  // hour from rising to falling.
  const orderedTides: TidePoint[] = []
  const seenTideTimes = new Set<string>()
  for (const p of [...(ctx.tides ?? [])].sort((a, b) => a.time.localeCompare(b.time))) {
    if (seenTideTimes.has(p.time)) continue
    seenTideTimes.add(p.time)
    orderedTides.push(p)
  }

  const tideByTime = new Map<string, number>()
  let tideMin = Infinity
  let tideMax = -Infinity
  for (const p of orderedTides) {
    tideByTime.set(p.time, p.height)
    if (p.height < tideMin) tideMin = p.height
    if (p.height > tideMax) tideMax = p.height
  }
  const hasTides = tideByTime.size > 0 && isFinite(tideMin) && isFinite(tideMax)

  // Rising vs falling, read off the series itself. Equal consecutive heights
  // leave the hour unmarked (neither push nor drain).
  const tideRising = new Map<string, boolean>()
  for (let i = 1; i < orderedTides.length; i++) {
    const prev = orderedTides[i - 1]
    const curr = orderedTides[i]
    if (curr.height > prev.height) tideRising.set(curr.time, true)
    else if (curr.height < prev.height) tideRising.set(curr.time, false)
  }

  const buoyCorrection = buildBuoyCorrection(
    ctx.buoy,
    marine.utc_offset_seconds ?? 0,
    ctx.nowMs ?? Date.now()
  )

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
  const cloudCoverMap = new Map<string, number>()

  // Every array is read through optional chaining: a truncated payload (or one
  // cached before a field was requested) must leave the affected hours without
  // an entry, not throw partway through the merge.
  const windTimes = Array.isArray(w?.time) ? w.time : []
  windTimes.forEach((t, i) => {
    const speed = w?.wind_speed_10m?.[i] ?? null
    if (speed != null) {
      windMap.set(t, {
        speed,
        gust: w?.wind_gusts_10m?.[i] ?? 0,
        dir: w?.wind_direction_10m?.[i] ?? null,
      })
    }
    const temp = w?.temperature_2m?.[i] ?? null
    if (temp != null) tempMap.set(t, temp)
    const code = w?.weather_code?.[i] ?? null
    if (code != null) weatherCodeMap.set(t, code)
    const precip = w?.precipitation_probability?.[i] ?? null
    if (precip != null) precipProbMap.set(t, precip)
    const cloud = w?.cloud_cover?.[i] ?? null
    if (cloud != null) cloudCoverMap.set(t, cloud)
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
    const rawSwellPeriod = m.swell_wave_period[i] ?? 0
    const wavePeriod = m.wave_period[i] ?? 0
    // Preserve null for the rating input: the engine scores an unknown swell
    // direction neutrally (exposure 1), but a `?? 0` here scored missing data
    // as a real due-north swell and collapsed exposure to the wrap floor.
    const rawSwellDirection = m.swell_wave_direction[i] ?? null

    // The engine falls back to total sea height when the swell partition is
    // missing — mirror that for period or the fallback computes a 0 m face.
    let swellPeriod = rawSwellPeriod > 0 ? rawSwellPeriod : wavePeriod
    let swellDirection = rawSwellDirection

    // Nudge the primary train toward the buoy for the hours the observation
    // actually describes. DPD/MWD report the dominant sea, which is what the
    // primary partition is meant to be.
    if (buoyCorrection) {
      const weight = buoyCorrection.weightAt(time)
      if (weight > 0) {
        if (buoyCorrection.period != null && swellPeriod > 0) {
          swellPeriod = Math.round(
            ((1 - weight) * swellPeriod + weight * buoyCorrection.period) * 10
          ) / 10
        }
        if (buoyCorrection.direction != null) {
          swellDirection = swellDirection == null
            // An observed bearing beats "unknown" outright — the neutral
            // exposure branch exists for the absence of any reading, not for
            // the case where a buoy is sitting in the swell measuring it.
            ? buoyCorrection.direction
            : Math.round(blendBearings(swellDirection, buoyCorrection.direction, weight))
        }
      }
    }

    // Second swell train. Open-Meteo ranks partitions by height, so this is
    // frequently the longer-period one: live, Santa Monica's primary read
    // 0.54 m @ 6.0 s while the ignored secondary was 0.34 m @ 11.15 s — a face
    // 34% larger than reported and a period score of 15 instead of 55-75.
    const secondaryHeight = m.secondary_swell_wave_height?.[i] ?? null
    const secondaryPeriod = m.secondary_swell_wave_period?.[i] ?? null
    const secondarySwell: SwellPartition | null =
      secondaryHeight != null && secondaryHeight > 0 && secondaryPeriod != null && secondaryPeriod > 0
        ? {
            height: secondaryHeight,
            period: secondaryPeriod,
            direction: m.secondary_swell_wave_direction?.[i] ?? null,
          }
        : null

    // When the weather API had no entry for this hour, estimate wind speed from
    // wind-wave height using empirical relationship: Hs_wind ≈ 0.0248 × U² (m/s)
    //
    // With no windsea partition either — days 11-16, where the long-range model
    // has no decomposition to fill it from — there is no basis for an estimate
    // and the speed is NULL, not 0. A literal 0 is a real dead-glassy calm, the
    // best wind there is, so the old fallback rated the far end of every
    // forecast as permanently glassy. The engine drops the wind factor and
    // renormalises instead, exactly as it does for tide and cleanliness.
    const windWaveH = m.wind_wave_height[i] as number | null
    const windWaveDir = m.wind_wave_direction[i] ?? 0
    const estimatedSpeed: number | null = rawWind
      ? rawWind.speed
      : windWaveH != null && windWaveH > 0 ? Math.round(Math.sqrt(windWaveH / 0.0248) * 3.6) : null
    const windData = {
      speed: estimatedSpeed,
      gust: rawWind && rawWind.gust > 0
        ? rawWind.gust
        : estimatedSpeed != null ? Math.round(estimatedSpeed * 1.25) : null,
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
      ? { height: tideHeight, min: tideMin, max: tideMax, rising: tideRising.get(time) ?? null }
      : null

    const { score, rating, faceHeight, combinedSwell } = rateSurfConditions({
      waveHeight,
      swellPeriod,
      swellHeight,
      swellDirection,
      secondarySwell,
      // Null (not 0) when the model omitted the partition, so the cleanliness
      // factor renormalises away instead of scoring "perfectly clean".
      windWaveHeight: windWaveH,
      // Null (not 0) when nothing measured or estimated it — see above. The
      // wind factor then renormalises away and the wind veto cannot fire on a
      // reading that does not exist.
      windSpeed: windData.speed,
      // Gusts were fetched and displayed but never scored: 12 km/h gusting 35
      // rated exactly like 12 km/h steady. Only a measured gust counts — the
      // estimated stand-in below is derived from the speed itself.
      windGust: rawWind && rawWind.gust > 0 ? rawWind.gust : null,
      windDirection: windData.ratingDir,
      spotFacing,
      tide,
      bottomType: ctx.bottomType,
      difficulty: ctx.difficulty,
    })

    // Display the swell that was actually rated. Showing the model's primary
    // partition next to a score computed from both trains is exactly the
    // cross-surface disagreement the accuracy audit flagged elsewhere. With a
    // single train these are the model's own numbers, unchanged.
    const shownHeight = combinedSwell?.height ?? swellHeight
    const shownPeriod = combinedSwell?.period ?? swellPeriod
    const shownDirection = combinedSwell?.direction ?? swellDirection ?? 0

    hours.push({
      time,
      waveHeight,
      faceHeight,
      wavePeriod,
      waveDirection: m.wave_direction[i] ?? 0,
      swellHeight: shownHeight,
      swellPeriod: shownPeriod,
      swellDirection: shownDirection,
      windWaveHeight: windWaveH ?? 0,
      wind: {
        speed: windData.speed,
        gust: windData.gust,
        direction: windData.displayDir,
        directionLabel: degreesToCompass(windData.displayDir),
      },
      rating,
      ratingScore: score,
      // Summed per partition: charging the whole sea at the swell's period
      // overstated mixed seas by 1.79-2.0x. The gear panel renders the day's
      // average of this, so the error was visible.
      //
      // With no swell partition the fallback charges the TOTAL sea — which
      // already contains the windsea — so adding the windsea partition beside
      // it billed the same energy twice. Pure-windsea spots (the Great Lakes,
      // any short-fetch lake or bay) have no swell partition at all, so they
      // read exactly 2x. One partition or three; never the total plus a slice
      // of itself.
      wavePower: swellHeight > 0
        ? computeWavePower([
            { height: swellHeight, period: swellPeriod },
            secondarySwell ?? { height: null, period: null },
            { height: windWaveH, period: m.wind_wave_period?.[i] ?? null },
          ])
        : computeWavePower([{ height: waveHeight, period: wavePeriod }]),
      uvIndex: computeUVIndex(lat, time, cloudCoverMap.get(time) ?? null),
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
    // Every surf-facing aggregate is taken over *surfable* hours. The dominant
    // rating already was; the rest were not, so a day's headline size could be
    // reported from 03:00 and its average period dragged by hours nobody
    // paddles out in. Falls back to all hours when a partial first/last day of
    // the window has no daylight coverage at all.
    const daylight = dayHours.filter((h) => {
      const hour = Number(h.time.slice(11, 13))
      return hour >= 6 && hour <= 18
    })
    const ratedHours = daylight.length ? daylight : dayHours

    const maxWaveHeight = Math.max(...ratedHours.map((h) => h.waveHeight))
    const maxFaceHeight = Math.max(...ratedHours.map((h) => h.faceHeight))
    // Hours with no swell decomposition carry swellPeriod 0 — averaging those
    // in reported a 15 s day as 8 s. Average over the hours that have one.
    const periods = ratedHours.map((h) => h.swellPeriod).filter((p) => p > 0)
    const avgPeriod = periods.length
      ? periods.reduce((sum, p) => sum + p, 0) / periods.length
      : 0

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
