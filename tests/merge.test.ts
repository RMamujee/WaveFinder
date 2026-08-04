import { describe, it, expect } from 'vitest'
import { mergeForecastData, groupHoursByDay } from '@/lib/forecast/merge'
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
})
