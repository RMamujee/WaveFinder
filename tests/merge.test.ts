import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mergeForecastData, groupHoursByDay, findNearestFutureHour } from '@/lib/forecast/merge'
import type { ForecastHour, TidePoint } from '@/types/forecast'
import type { OpenMeteoMarineResponse, OpenMeteoWindResponse } from '@/lib/api/open-meteo'

function makeHour(time: string, rating: ForecastHour['rating']): ForecastHour {
  return {
    time,
    waveHeight: 1.2,
    faceHeight: 1.6,
    wavePeriod: 12,
    waveDirection: 270,
    swellHeight: 1.1,
    swellPeriod: 12,
    swellDirection: 270,
    windWaveHeight: 0.1,
    wind: { speed: 5, gust: 7, direction: 90, directionLabel: 'E' },
    rating,
    ratingScore: rating === 'good' ? 60 : 40,
    wavePower: 8,
    uvIndex: 5,
    waterTemp: 18,
    airTempC: 20,
    weatherCode: 0,
    precipProb: 0,
  }
}

const hh = (h: number) => `2026-08-04T${String(h).padStart(2, '0')}:00`

describe('groupHoursByDay — dominant rating', () => {
  it('ignores overnight hours when picking the dominant rating', () => {
    // 7 good daytime hours vs 6 fair daytime hours, plus 11 fair night hours.
    // Counting all 24 gives fair (17 v 7); counting only surfable hours gives
    // good (7 v 6). The old implementation counted all 24 despite a comment
    // claiming it preferred daytime.
    const hours: ForecastHour[] = []
    for (let h = 0; h < 24; h++) {
      const isDaylight = h >= 6 && h <= 18
      if (isDaylight && h <= 12) hours.push(makeHour(hh(h), 'good'))
      else hours.push(makeHour(hh(h), 'fair'))
    }

    const [day] = groupHoursByDay(hours)
    expect(day.dominantRating).toBe('good')
  })

  it('still returns all 24 hours in the day payload', () => {
    const hours = Array.from({ length: 24 }, (_, h) => makeHour(hh(h), 'fair'))
    const [day] = groupHoursByDay(hours)
    expect(day.hours).toHaveLength(24)
  })

  it('breaks ties toward the better rating', () => {
    // Six good, six fair, all in daylight — worth paddling out for.
    const hours = [
      ...Array.from({ length: 6 }, (_, i) => makeHour(hh(7 + i), 'good')),
      ...Array.from({ length: 6 }, (_, i) => makeHour(hh(13 + i), 'fair')),
    ]
    const [day] = groupHoursByDay(hours)
    expect(day.dominantRating).toBe('good')
  })

  it('falls back to all hours when a day has no daylight coverage', () => {
    // Partial first/last day of the forecast window can be night-only.
    const hours = [makeHour(hh(2), 'good'), makeHour(hh(3), 'good')]
    const [day] = groupHoursByDay(hours)
    expect(day.dominantRating).toBe('good')
  })

  it('reports the peak face height for the day', () => {
    const hours = [makeHour(hh(8), 'good'), makeHour(hh(9), 'good')]
    hours[1].faceHeight = 2.44
    const [day] = groupHoursByDay(hours)
    expect(day.maxFaceHeight).toBe(2.4)
  })
})

// ── mergeForecastData ────────────────────────────────────────────────────────

function marineFixture(times: string[], overrides: Partial<OpenMeteoMarineResponse['hourly']> = {}): OpenMeteoMarineResponse {
  const n = times.length
  const fill = (v: number) => Array(n).fill(v)
  return {
    utc_offset_seconds: 0,
    hourly: {
      time: times,
      wave_height: fill(1.5),
      wave_direction: fill(270),
      wave_period: fill(14),
      swell_wave_height: fill(1.4),
      swell_wave_direction: fill(270),
      swell_wave_period: fill(14),
      wind_wave_height: fill(0.1),
      wind_wave_direction: fill(270),
      wind_wave_period: fill(4),
      sea_surface_temperature: fill(18),
      ...overrides,
    } as OpenMeteoMarineResponse['hourly'],
  }
}

function windFixture(times: string[]): OpenMeteoWindResponse {
  const n = times.length
  const fill = (v: number) => Array(n).fill(v)
  return {
    hourly: {
      time: times,
      wind_speed_10m: fill(6),
      wind_direction_10m: fill(90),   // offshore for a 270-facing spot
      wind_gusts_10m: fill(9),
      temperature_2m: fill(20),
      weather_code: fill(0),
      precipitation_probability: fill(0),
    },
  }
}

describe('mergeForecastData', () => {
  const times = [hh(8), hh(9), hh(10)]

  it('attaches a face height to every hour', () => {
    const hours = mergeForecastData(marineFixture(times), windFixture(times), {
      spotFacing: 270,
      lat: 33.8,
    })
    expect(hours).toHaveLength(3)
    for (const h of hours) {
      expect(h.faceHeight).toBeGreaterThan(0)
      // 1.4 m of 14 s groundswell stands up bigger than its offshore height.
      expect(h.faceHeight).toBeGreaterThan(h.swellHeight)
    }
  })

  it('feeds tide height into the rating when the spot has a station', () => {
    // Same swell and wind; only the tide differs. A reef at the very bottom of
    // the tidal range should score below the same reef at a workable tide.
    const lowTide: TidePoint[] = times.map((t) => ({ time: t, height: 0.02, type: null }))
    const midTide: TidePoint[] = times.map((t) => ({ time: t, height: 1.25, type: null }))
    // Both series need the same min/max range to isolate the tide-height effect.
    const range: TidePoint[] = [
      { time: hh(3), height: 0.0, type: 'L' },
      { time: hh(15), height: 2.0, type: 'H' },
    ]

    const low = mergeForecastData(marineFixture(times), windFixture(times), {
      spotFacing: 270, lat: 33.8, tides: [...lowTide, ...range], bottomType: 'reef',
    })
    const mid = mergeForecastData(marineFixture(times), windFixture(times), {
      spotFacing: 270, lat: 33.8, tides: [...midTide, ...range], bottomType: 'reef',
    })

    expect(mid[0].ratingScore).toBeGreaterThan(low[0].ratingScore)
  })

  it('does not fail or penalise a spot with no tide station', () => {
    const withoutTides = mergeForecastData(marineFixture(times), windFixture(times), {
      spotFacing: 270, lat: 33.8,
    })
    expect(withoutTides[0].ratingScore).toBeGreaterThan(0)
  })

  it('ignores a tide series with no usable range', () => {
    const flat: TidePoint[] = times.map((t) => ({ time: t, height: 0.3, type: null }))
    const hours = mergeForecastData(marineFixture(times), windFixture(times), {
      spotFacing: 270, lat: 33.8, tides: flat, bottomType: 'reef',
    })
    expect(hours[0].ratingScore).toBeGreaterThan(0)
  })

  it('scores clean groundswell above an identical height of wind chop', () => {
    const clean = marineFixture(times)
    const chop = marineFixture(times, {
      swell_wave_height: Array(times.length).fill(0.2),
      swell_wave_period: Array(times.length).fill(5),
      wind_wave_height: Array(times.length).fill(1.3),
    })
    const cleanHours = mergeForecastData(clean, windFixture(times), { spotFacing: 270, lat: 33.8 })
    const chopHours = mergeForecastData(chop, windFixture(times), { spotFacing: 270, lat: 33.8 })

    // Same total wave_height of 1.5 m in both — only the partition differs.
    expect(cleanHours[0].waveHeight).toBe(chopHours[0].waveHeight)
    expect(cleanHours[0].ratingScore).toBeGreaterThan(chopHours[0].ratingScore)
  })

  it('aligns wind to marine hours by timestamp, not array index', () => {
    // Wind cache refreshed an hour later than marine: offset arrays must still
    // line up by time rather than silently shifting every reading.
    const windTimes = [hh(9), hh(10), hh(11)]
    const wind = windFixture(windTimes)
    wind.hourly.wind_speed_10m = [40, 6, 6]  // 40 km/h belongs to 09:00

    const hours = mergeForecastData(marineFixture(times), wind, { spotFacing: 270, lat: 33.8 })
    expect(hours[1].time).toBe(hh(9))
    expect(hours[1].wind.speed).toBe(40)
  })

  // ── Null preservation (2026-08-05 audit) ───────────────────────────────────

  it('drops hours where neither model produced a sea state', () => {
    // Days 11-16 with a failed long-range fill used to emit fully-formed
    // 0 m / 0 s hours rated "poor" — one live day showed 19 of 24 hours at
    // zero and an average period of 2.9 s.
    const marine = marineFixture(times, {
      wave_height: [1.5, null, null] as unknown as number[],
      swell_wave_height: [1.4, null, null] as unknown as number[],
    })
    const hours = mergeForecastData(marine, windFixture(times), { spotFacing: 270, lat: 33.8 })
    expect(hours).toHaveLength(1)
    expect(hours[0].time).toBe(times[0])
  })

  it('scores an unknown swell direction neutrally instead of as due north', () => {
    // `?? 0` scored a missing direction as a real 0° swell, collapsing the
    // exposure multiplier to the wrap floor: epic 92 → poor 29.
    const aligned = mergeForecastData(marineFixture(times), windFixture(times), {
      spotFacing: 270, lat: 33.8,
    })
    const unknown = mergeForecastData(
      marineFixture(times, {
        swell_wave_direction: [null, null, null] as unknown as number[],
      }),
      windFixture(times),
      { spotFacing: 270, lat: 33.8 }
    )
    expect(unknown[0].ratingScore).toBe(aligned[0].ratingScore)
  })

  it('keeps a genuine 0 km/h calm instead of inventing an onshore wind', () => {
    // `speed > 0` used to stand in for "has wind data", so a dead-glassy hour
    // fell into the wind-wave estimator and adopted an onshore bearing:
    // the single best condition scored 29 "poor" instead of ~92.
    const wind = windFixture(times)
    wind.hourly.wind_speed_10m = [0, 0, 0]
    wind.hourly.wind_direction_10m = [90, 90, 90]

    const hours = mergeForecastData(marineFixture(times), wind, { spotFacing: 270, lat: 33.8 })
    expect(hours[0].wind.speed).toBe(0)
    expect(hours[0].ratingScore).toBeGreaterThanOrEqual(80)
  })

  it('rates a missing wind hour on estimated speed alone, not an invented direction', () => {
    // No weather data at all: speed is estimated from the wind-wave partition,
    // but direction is unknown — the hour must not be vetoed as onshore.
    const emptyWind = { hourly: { time: [], wind_speed_10m: [], wind_direction_10m: [], wind_gusts_10m: [], temperature_2m: [], weather_code: [], precipitation_probability: [] } }
    const hours = mergeForecastData(marineFixture(times), emptyWind, { spotFacing: 270, lat: 33.8 })
    expect(hours[0].wind.speed).toBeGreaterThan(0)   // estimate still displayed
    expect(hours[0].ratingScore).toBeGreaterThan(45) // not slammed by fake onshore
  })

  it('falls back to wave period when the swell partition has no period', () => {
    // The engine falls back to total sea HEIGHT when the partition is missing,
    // but a `?? 0` period defeated it: breakingWaveHeight(h, 0) = 0 m face.
    const marine = marineFixture(times, {
      swell_wave_height: [0, 0, 0],
      swell_wave_period: [null, null, null] as unknown as number[],
    })
    const hours = mergeForecastData(marine, windFixture(times), { spotFacing: 270, lat: 33.8 })
    expect(hours[0].faceHeight).toBeGreaterThan(0)
    expect(hours[0].ratingScore).toBeGreaterThan(50)
  })

  it('drops the cleanliness factor when the wind-wave partition is missing, rather than scoring it perfectly clean', () => {
    const noChopData = mergeForecastData(
      marineFixture(times, { wind_wave_height: [null, null, null] as unknown as number[] }),
      windFixture(times),
      { spotFacing: 270, lat: 33.8 }
    )
    const trulyClean = mergeForecastData(
      marineFixture(times, { wind_wave_height: [0, 0, 0] }),
      windFixture(times),
      { spotFacing: 270, lat: 33.8 }
    )
    // Missing data must never score better than a genuinely clean reading —
    // strictly less: with the fix the cleanliness factor DROPS (renormalised
    // weights) while a real 0-chop reading adds a 100-scored factor. A `?? 0`
    // revert makes the two identical, which `<=` could not catch.
    expect(noChopData[0].ratingScore).toBeLessThan(trulyClean[0].ratingScore)
  })
})

describe('findNearestFutureHour', () => {
  // Fixed clock: 20:30 UTC. Real Date.now() would let the old slice(0,16)
  // logic pass during minute :00 of any hour — the test could then miss the
  // exact regression it names.
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T20:30:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('returns the in-progress hour, not the next one', () => {
    // Comparing with minutes included excluded the current hour for 59 of
    // every 60 minutes, so "Now" was systematically ~30 min in the future.
    const hours = [
      makeHour('2026-08-05T19:00', 'fair'),
      makeHour('2026-08-05T20:00', 'good'),
      makeHour('2026-08-05T21:00', 'fair'),
    ]
    expect(findNearestFutureHour(hours, 0)?.time).toBe('2026-08-05T20:00')
  })

  it('applies the spot UTC offset to pick the spot-local hour', () => {
    // 20:30 UTC at a UTC-8 spot is 12:30 spot-local. Parsing the local-clock
    // strings in the runtime zone (the audited bug) would pick 21:00 — nine
    // hours of surf conditions away from the truth.
    const hours = [
      makeHour('2026-08-05T11:00', 'fair'),
      makeHour('2026-08-05T12:00', 'good'),
      makeHour('2026-08-05T13:00', 'fair'),
      makeHour('2026-08-05T21:00', 'poor'),
    ]
    expect(findNearestFutureHour(hours, -28800)?.time).toBe('2026-08-05T12:00')
  })

  it('falls back to the last hour when all hours are past', () => {
    const hours = [makeHour('2026-08-05T17:00', 'fair'), makeHour('2026-08-05T18:00', 'good')]
    expect(findNearestFutureHour(hours, 0)?.time).toBe('2026-08-05T18:00')
  })
})

describe('groupHoursByDay — aggregates', () => {
  it('ignores zero-period hours in the day average period', () => {
    // Hours with no swell decomposition carry period 0; averaging them in
    // reported a 15 s day as ~8 s.
    const hours = [makeHour(hh(8), 'good'), makeHour(hh(9), 'good'), makeHour(hh(10), 'good')]
    hours[0].swellPeriod = 15
    hours[1].swellPeriod = 15
    hours[2].swellPeriod = 0
    const [day] = groupHoursByDay(hours)
    expect(day.avgPeriod).toBe(15)
  })
})
