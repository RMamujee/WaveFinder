import { describe, it, expect } from 'vitest'
import { predictTidesFromStation, predictTides } from '@/lib/api/harmonic-tides'
import { HARMONIC_STATIONS, HARMONIC_GUARD_RAN, harmonicStationForSpot } from '@/lib/tides/stations'
import type { HarmonicStation } from '@/lib/tides/stations'
import FIXTURE from './fixtures/santa-monica-station.json'

// A real @neaps/tide-database record (NOAA 9410840, Santa Monica Municipal
// Pier), checked in so these tests exercise the clock and datum handling even
// in a checkout where lib/tides/data/harmonic-stations.json has not been
// generated yet. A suite that passes only because there is no data to check is
// worse than no suite.
const STATION = FIXTURE as unknown as HarmonicStation

describe('harmonic tide prediction', () => {
  it('returns 17 days of hourly points', () => {
    expect(predictTidesFromStation(STATION, 0).length).toBe(17 * 24)
  })

  it('emits the spot LOCAL clock, not UTC', () => {
    const tides = predictTidesFromStation(STATION, -8 * 3600)
    // Starts at local midnight yesterday, so the first label is exactly T00:00.
    expect(tides[0].time).toMatch(/T00:00$/)
    expect(tides[0].time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)

    // One local hour apart, no gaps or repeats — the chart's per-day filter and
    // best-time.ts both index this series by its own strings.
    const hours = tides.slice(0, 24).map((t) => t.time.slice(11, 13))
    expect(hours).toEqual(Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')))
  })

  it('shifts the whole series when the offset changes', () => {
    // Same station, two offsets, must not yield the same wall clock. This is
    // the bug class CLAUDE.md documents for Open-Meteo strings: getting it
    // wrong misaligns tide against swell by the spot's entire UTC offset, and
    // it is invisible in local dev because dev runs in the same zone.
    const utc = predictTidesFromStation(STATION, 0)
    const plusTen = predictTidesFromStation(STATION, 10 * 3600)
    expect(utc[0].time).not.toBe(plusTen[0].time)

    // 10 h apart in real time means the same instant carries labels 10 h apart.
    const a = Date.parse(utc[0].time + 'Z')
    const b = Date.parse(plusTen[0].time + 'Z')
    expect(Math.abs(b - a)).toBe(24 * 3_600_000)
  })

  it('keeps whole local hours in :30 and :45 zones', () => {
    // India is UTC+5:30, Chatham +12:45. Anchoring the predictor grid on a
    // whole UTC hour would label readings taken at :30 as ":00".
    for (const offset of [5.5 * 3600, 12.75 * 3600]) {
      const tides = predictTidesFromStation(STATION, offset)
      expect(tides[0].time).toMatch(/T00:00$/)
      expect(tides.every((t) => t.time.endsWith(':00'))).toBe(true)
    }
  })

  it('marks highs and lows on local extrema only', () => {
    const tides = predictTidesFromStation(STATION, 0)
    for (let i = 1; i < tides.length - 1; i++) {
      const [prev, curr, next] = [tides[i - 1].height, tides[i].height, tides[i + 1].height]
      if (tides[i].type === 'H') expect(curr > prev && curr > next).toBe(true)
      if (tides[i].type === 'L') expect(curr < prev && curr < next).toBe(true)
    }
    // Santa Monica is mixed semidiurnal: ~2 highs and 2 lows a day over 17 days.
    // A flat series would mean the constituents or datum failed silently, and
    // scoreTide would read it as a real, unchanging tide.
    expect(tides.filter((t) => t.type != null).length).toBeGreaterThan(40)
  })

  it('returns metres above MLLW, not MSL', () => {
    const tides = predictTidesFromStation(STATION, 0)
    const min = Math.min(...tides.map((t) => t.height))
    const max = Math.max(...tides.map((t) => t.height))
    // An MSL series is centred on zero and negative half the time, which scores
    // every reef as dry for half of every day. MLLW sits almost entirely above
    // zero, dipping slightly below only on a minus tide.
    expect(min).toBeGreaterThan(-1)
    expect(min).toBeLessThan(0.6)
    expect(max).toBeGreaterThan(1.5)
    // Santa Monica's great diurnal range is ~1.65 m; springs exceed it. Well
    // clear of scoreTide's 0.5 m neutrality floor.
    expect(max - min).toBeGreaterThan(1.5)
  })

  it('rounds to 2 dp like the NOAA path', () => {
    for (const t of predictTidesFromStation(STATION, 0).slice(0, 50)) {
      expect(Math.round(t.height * 100) / 100).toBe(t.height)
    }
  })

  it('returns empty for an unknown station rather than zeros', () => {
    // Zeros would be scored as a real dead-low tide; empty makes the rating
    // weights renormalise, which is the documented contract.
    expect(predictTides('does/not-exist', 0)).toEqual([])
  })
})

describe('generated station table', () => {
  it('serves nothing until the estuary guard has run', () => {
    // Distance-only assignment is ~31% wrong against CO-OPS ground truth — a
    // gauge in a bay, river or slough. If the guard did not run, every lookup
    // must return null so the app keeps its previous behaviour rather than
    // shipping confidently wrong tides.
    if (!HARMONIC_GUARD_RAN) {
      expect(harmonicStationForSpot('malibu')).toBeNull()
      expect(harmonicStationForSpot('uluwatu-bali')).toBeNull()
    }
  })

  it('only maps spots to stations the table actually contains', () => {
    if (!HARMONIC_GUARD_RAN) return
    for (const slug of ['malibu', 'uluwatu-bali', 'hossegor-la-graviere', 'bells-beach-victoria']) {
      const id = harmonicStationForSpot(slug)
      if (id) expect(HARMONIC_STATIONS[id]).toBeDefined()
    }
  })

  it('every shipped station is a reference station with MLLW and constituents', () => {
    for (const [id, st] of Object.entries(HARMONIC_STATIONS)) {
      expect(st.datums?.MLLW, `${id} missing MLLW`).toBeTypeOf('number')
      expect(st.harmonic_constituents.length, `${id} has no constituents`).toBeGreaterThan(0)
      expect(st.type, `${id} is not a reference station`).toBe('reference')
    }
  })

  it('produces a usable series for every shipped station', () => {
    // Catches a station that survived generation but cannot actually predict —
    // the failure mode that gave yakutat-surf-ak a permanently blank chart.
    for (const [id, st] of Object.entries(HARMONIC_STATIONS)) {
      const tides = predictTidesFromStation(st, 0)
      expect(tides.length, `${id} predicted nothing`).toBe(17 * 24)
    }
  })
})
