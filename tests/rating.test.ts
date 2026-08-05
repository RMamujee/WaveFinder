import { describe, it, expect } from 'vitest'
import {
  degreesToCompass,
  computeWavePower,
  breakingWaveHeight,
  directionalExposure,
  scoreCleanliness,
  scoreTide,
  rateSurfConditions,
} from '@/lib/forecast/rating'

// Baseline inputs for a clean, well-aligned, glassy day. Individual tests
// override just the field under test so the cause of a score change is obvious.
const CLEAN = {
  waveHeight: 2.2,
  swellHeight: 2.2,
  swellPeriod: 16,
  swellDirection: 270,
  windWaveHeight: 0,
  windSpeed: 2,
  windDirection: 0,
  spotFacing: 270,
} as const

describe('degreesToCompass', () => {
  it('maps the cardinal directions', () => {
    expect(degreesToCompass(0)).toBe('N')
    expect(degreesToCompass(90)).toBe('E')
    expect(degreesToCompass(180)).toBe('S')
    expect(degreesToCompass(270)).toBe('W')
  })

  it('maps the primary intercardinal directions', () => {
    expect(degreesToCompass(45)).toBe('NE')
    expect(degreesToCompass(135)).toBe('SE')
    expect(degreesToCompass(225)).toBe('SW')
    expect(degreesToCompass(315)).toBe('NW')
  })

  it('rounds to the nearest 22.5 degree sector and wraps at 360', () => {
    expect(degreesToCompass(350)).toBe('N')
    expect(degreesToCompass(360)).toBe('N')
    expect(degreesToCompass(22)).toBe('NNE')
  })
})

describe('computeWavePower', () => {
  it('uses P = 0.5 * Hs^2 * T rounded to one decimal', () => {
    expect(computeWavePower(2, 10)).toBe(20)
    expect(computeWavePower(1.5, 12)).toBe(13.5)
  })

  it('returns 0 for non-positive height or period', () => {
    expect(computeWavePower(0, 10)).toBe(0)
    expect(computeWavePower(2, 0)).toBe(0)
    expect(computeWavePower(-1, 10)).toBe(0)
  })
})

describe('breakingWaveHeight', () => {
  it('breaks long-period swell substantially bigger than short-period at equal height', () => {
    const groundswell = breakingWaveHeight(1.0, 16)
    const windswell = breakingWaveHeight(1.0, 7)
    expect(groundswell).toBeGreaterThan(windswell)
    // The whole point of the transform: the difference is large, not marginal.
    expect(groundswell / windswell).toBeGreaterThan(1.3)
  })

  it('amplifies a 1 m / 14 s groundswell to roughly head-high faces', () => {
    // Calibrated so this lands near 1.5 m (~5 ft) rather than the textbook
    // formula's more generous ~1.8 m. See SHOALING_CALIBRATION.
    const hb = breakingWaveHeight(1.0, 14)
    expect(hb).toBeGreaterThan(1.3)
    expect(hb).toBeLessThan(1.7)
  })

  it('grows monotonically with both height and period', () => {
    expect(breakingWaveHeight(2, 12)).toBeGreaterThan(breakingWaveHeight(1, 12))
    expect(breakingWaveHeight(1, 18)).toBeGreaterThan(breakingWaveHeight(1, 12))
  })

  it('returns 0 for non-positive inputs', () => {
    expect(breakingWaveHeight(0, 12)).toBe(0)
    expect(breakingWaveHeight(1, 0)).toBe(0)
    expect(breakingWaveHeight(-1, 12)).toBe(0)
  })
})

describe('directionalExposure', () => {
  it('gives full exposure to swell arriving square on the beach', () => {
    expect(directionalExposure(270, 270)).toBe(1)
  })

  it('falls off as the swell moves off-axis', () => {
    const square = directionalExposure(270, 270)
    const oblique = directionalExposure(315, 270)  // 45 degrees off
    const glancing = directionalExposure(340, 270) // 70 degrees off
    expect(square).toBeGreaterThan(oblique)
    expect(oblique).toBeGreaterThan(glancing)
  })

  it('drops to the wrap floor once the swell is blocked by the coastline', () => {
    // A north-facing spot gets essentially nothing from a due-south swell.
    expect(directionalExposure(180, 0)).toBeCloseTo(0.12, 5)
    expect(directionalExposure(90, 0)).toBeCloseTo(0.12, 5)
  })

  it('stays neutral when the swell direction is unknown', () => {
    // A dead buoy sensor must not be scored as though the spot were blocked.
    expect(directionalExposure(null, 270)).toBe(1)
  })
})

describe('scoreCleanliness', () => {
  it('rewards a groundswell-dominated sea', () => {
    expect(scoreCleanliness(2.0, 0.1)).toBe(100)
  })

  it('punishes a windsea-dominated sea', () => {
    expect(scoreCleanliness(0.3, 1.5)).toBe(10)
  })

  it('decreases monotonically as chop takes over', () => {
    const scores = [0.1, 0.5, 1.0, 2.0, 4.0].map((chop) => scoreCleanliness(1.0, chop))
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1])
    }
  })

  it('returns neutral for a flat sea rather than dividing by zero', () => {
    expect(scoreCleanliness(0, 0)).toBe(50)
  })
})

describe('scoreTide', () => {
  it('prefers more water over a reef than over a sandbar', () => {
    const high = { height: 1.7, min: 0, max: 2 }
    expect(scoreTide(high, 'reef')).toBeGreaterThan(scoreTide(high, 'sand'))
  })

  it('penalises the bottom of the range on a reef', () => {
    const range = { min: 0, max: 2 }
    const dryReef = scoreTide({ height: 0.05, ...range }, 'reef')
    const midReef = scoreTide({ height: 1.24, ...range }, 'reef')
    expect(midReef).toBeGreaterThan(dryReef)
  })

  it('stays neutral where there is no meaningful tidal range', () => {
    // Mediterranean / Gulf stations: a 5 cm range tells us nothing.
    expect(scoreTide({ height: 0.3, min: 0.28, max: 0.33 }, 'reef')).toBe(50)
  })

  it('never returns a score outside 15-100', () => {
    for (const h of [0, 0.5, 1, 1.5, 2]) {
      for (const bottom of ['reef', 'sand', 'rock', 'coral', 'mixed', null]) {
        const s = scoreTide({ height: h, min: 0, max: 2 }, bottom)
        expect(s).toBeGreaterThanOrEqual(15)
        expect(s).toBeLessThanOrEqual(100)
      }
    }
  })
})

describe('rateSurfConditions', () => {
  it('rates big, clean, well-aligned long-period surf as epic', () => {
    const { score, rating } = rateSurfConditions({ ...CLEAN })
    expect(rating).toBe('epic')
    expect(score).toBeGreaterThanOrEqual(80)
  })

  it('rates tiny knee-high waves as poor regardless of other factors', () => {
    const { rating, score } = rateSurfConditions({
      ...CLEAN,
      waveHeight: 0.2,
      swellHeight: 0.2,
      swellPeriod: 18,
    })
    expect(rating).toBe('poor')
    expect(score).toBeLessThanOrEqual(29)
  })

  // ── The headline fix ───────────────────────────────────────────────────────
  // The old engine scored the combined sea height and ignored the wind-wave
  // partition entirely, so these two hours were indistinguishable.
  it('separates clean groundswell from an identical height of wind chop', () => {
    const groundswell = rateSurfConditions({
      waveHeight: 1.5,
      swellHeight: 1.4,      // nearly all of it is organised swell
      swellPeriod: 15,
      swellDirection: 270,
      windWaveHeight: 0.1,
      windSpeed: 4,
      windDirection: 90,     // offshore
      spotFacing: 270,
    })
    const blownOut = rateSurfConditions({
      waveHeight: 1.5,       // same total sea height
      swellHeight: 0.3,      // almost no groundswell
      swellPeriod: 6,
      swellDirection: 270,
      windWaveHeight: 1.2,   // it is nearly all chop
      windSpeed: 32,
      windDirection: 270,    // straight onshore
      spotFacing: 270,
    })
    expect(groundswell.rating).toBe('epic')
    expect(blownOut.rating).toBe('poor')
    expect(groundswell.score - blownOut.score).toBeGreaterThan(40)
  })

  it('treats an off-axis swell as smaller than the same swell arriving square on', () => {
    const square = rateSurfConditions({ ...CLEAN, swellDirection: 270 })
    const oblique = rateSurfConditions({ ...CLEAN, swellDirection: 200 })
    expect(square.faceHeight).toBeGreaterThan(oblique.faceHeight)
    expect(square.score).toBeGreaterThan(oblique.score)
  })

  it('gives a spot facing away from the swell almost nothing', () => {
    // A 2.2 m NW swell at a spot facing due south.
    const blocked = rateSurfConditions({ ...CLEAN, swellDirection: 315, spotFacing: 180 })
    expect(blocked.factors.exposure).toBeCloseTo(0.12, 2)
    expect(blocked.rating).toBe('poor')
  })

  it('reports face height, not raw model height, as the surfable size', () => {
    const { faceHeight } = rateSurfConditions({
      ...CLEAN,
      waveHeight: 1.0,
      swellHeight: 1.0,
      swellPeriod: 16,
    })
    // 1 m of 16 s groundswell stands up well overhead of its offshore height.
    expect(faceHeight).toBeGreaterThan(1.5)
  })

  it('uses a neutral exposure when swellDirection is null', () => {
    const withNull = rateSurfConditions({ ...CLEAN, swellDirection: null })
    const withAligned = rateSurfConditions({ ...CLEAN, swellDirection: 270 })
    // Unknown direction must not be punished — it scores like a square hit.
    expect(withNull.score).toBe(withAligned.score)
  })

  it('penalises strong onshore wind', () => {
    const offshore = rateSurfConditions({ ...CLEAN, windSpeed: 25, windDirection: 90 })
    const onshore = rateSurfConditions({ ...CLEAN, windSpeed: 25, windDirection: 270 })
    expect(offshore.score).toBeGreaterThan(onshore.score)
  })

  it('does not award a free perfect wind score when wind direction is unknown', () => {
    // Regression: the nearest-neighbour fallback used to pass a hardcoded 270,
    // and passing windSpeed 0 instead would score a perfect 100 for "calm".
    const unknown = rateSurfConditions({ ...CLEAN, windSpeed: 25, windDirection: null })
    const glassy = rateSurfConditions({ ...CLEAN, windSpeed: 0, windDirection: null })
    expect(unknown.factors.wind).toBeLessThan(glassy.factors.wind)
    expect(unknown.factors.wind).toBeLessThan(60)
  })

  it('vetoes a big swell that is being destroyed by onshore wind', () => {
    // Regression: the weighted mean rated this "good" because 4.5 m at 13 s
    // scored highly on size and period, averaging away a zero wind score. A
    // 40 km/h onshore is disqualifying no matter how big the swell is.
    const stormy = rateSurfConditions({
      waveHeight: 4.8,
      swellHeight: 4.5,
      swellPeriod: 13,
      swellDirection: 270,
      windWaveHeight: 1.4,
      windSpeed: 40,
      windDirection: 270,  // straight onshore
      spotFacing: 270,
    })
    expect(stormy.factors.height).toBeGreaterThan(70)  // it really is big
    expect(stormy.rating).toBe('poor')                 // and still unsurfable
  })

  it('vetoes a sea state that is almost entirely wind chop', () => {
    const mush = rateSurfConditions({
      ...CLEAN,
      swellHeight: 0.4,
      windWaveHeight: 2.0,
      windSpeed: 4,        // light wind, so the veto must come from the chop
      windDirection: 90,
    })
    expect(mush.factors.cleanliness).toBeLessThanOrEqual(10)
    expect(mush.score).toBeLessThanOrEqual(29)
  })

  it('folds tide into the score when a station is available', () => {
    const range = { min: 0, max: 2 }
    const goodTide = rateSurfConditions({
      ...CLEAN, tide: { height: 1.24, ...range }, bottomType: 'reef',
    })
    const badTide = rateSurfConditions({
      ...CLEAN, tide: { height: 0.02, ...range }, bottomType: 'reef',
    })
    expect(goodTide.score).toBeGreaterThan(badTide.score)
    expect(goodTide.factors.tide).not.toBeNull()
  })

  it('does not penalise a spot that has no tide station', () => {
    // Weights renormalise over present factors, so a missing tide reading must
    // not drag the score down the way a zero-scored factor would.
    const noTide = rateSurfConditions({ ...CLEAN })
    const perfectTide = rateSurfConditions({
      ...CLEAN, tide: { height: 1.0, min: 0, max: 2 }, bottomType: 'sand',
    })
    expect(noTide.factors.tide).toBeNull()
    expect(noTide.score).toBeGreaterThanOrEqual(perfectTide.score - 2)
  })

  it('falls back to total sea height when the swell partition is missing', () => {
    // Long-range model hours past day ~10 carry no swell decomposition.
    const { faceHeight, score } = rateSurfConditions({
      ...CLEAN, swellHeight: 0, waveHeight: 2.0,
    })
    expect(faceHeight).toBeGreaterThan(0)
    expect(score).toBeGreaterThan(0)
  })

  it('returns one of the four valid rating labels', () => {
    const { rating } = rateSurfConditions({
      waveHeight: 0.9,
      swellHeight: 0.8,
      swellPeriod: 10,
      swellDirection: 240,
      windWaveHeight: 0.1,
      windSpeed: 12,
      windDirection: 200,
      spotFacing: 270,
    })
    expect(['poor', 'fair', 'good', 'epic']).toContain(rating)
  })

  // ── Wind shape regressions (2026-08-05 audit) ──────────────────────────────
  it('treats light onshore drift as near-glassy, not a gale', () => {
    // A 6 km/h breeze is glassy from the sand whatever its direction. The old
    // shape applied the direction buckets at full strength from 5 km/h, so this
    // exact case vetoed a clean head-high day to "poor" — and a once-a-year
    // 15 ft/18 s day scored 29 under the same breeze.
    const light = rateSurfConditions({
      ...CLEAN,
      waveHeight: 1.5,
      swellHeight: 1.4,
      swellPeriod: 15,
      windSpeed: 6,
      windDirection: 270,  // straight onshore
    })
    expect(light.factors.wind).toBeGreaterThan(85)
    expect(light.rating).not.toBe('poor')
  })

  it('does not cliff at the 5 km/h glassy threshold', () => {
    // 4.9 → 5.0 km/h used to move the score three rating bands.
    const under = rateSurfConditions({ ...CLEAN, windSpeed: 4.9, windDirection: 270 })
    const over = rateSurfConditions({ ...CLEAN, windSpeed: 5.1, windDirection: 270 })
    expect(Math.abs(under.score - over.score)).toBeLessThanOrEqual(3)
  })

  it('still penalises onshore wind at speeds where it matters', () => {
    // The speed gate must not make the engine blind to real onshore wind.
    const light = rateSurfConditions({ ...CLEAN, windSpeed: 6, windDirection: 270 })
    const moderate = rateSurfConditions({ ...CLEAN, windSpeed: 15, windDirection: 270 })
    const strong = rateSurfConditions({ ...CLEAN, windSpeed: 25, windDirection: 270 })
    expect(light.factors.wind).toBeGreaterThan(moderate.factors.wind)
    expect(moderate.factors.wind).toBeGreaterThan(strong.factors.wind)
    expect(strong.rating).toBe('poor')
  })

  it('never scores an unknown wind direction below the worst known direction', () => {
    // Regression: the speed gate was first applied only to the known-direction
    // path, so at light winds an UNKNOWN direction scored worse than a known
    // straight-onshore blow — punishing exactly the honest-null inputs the
    // 2026-08-05 fixes introduce. The mean-direction branch must sit between
    // the best and worst known directions at every speed.
    for (const speed of [6, 8, 12, 18, 25]) {
      const unknown = rateSurfConditions({ ...CLEAN, windSpeed: speed, windDirection: null })
      const worstKnown = rateSurfConditions({ ...CLEAN, windSpeed: speed, windDirection: 270 })
      const bestKnown = rateSurfConditions({ ...CLEAN, windSpeed: speed, windDirection: 90 })
      expect(unknown.factors.wind).toBeGreaterThanOrEqual(worstKnown.factors.wind)
      expect(unknown.factors.wind).toBeLessThanOrEqual(bestKnown.factors.wind)
    }
  })

  it('caps a gale even when it blows straight offshore', () => {
    // 90 km/h dead offshore used to keep windScore 60 and rate "epic";
    // it is unpaddleable regardless of direction.
    const gale = rateSurfConditions({ ...CLEAN, windSpeed: 90, windDirection: 90 })
    expect(gale.factors.wind).toBeLessThanOrEqual(40)
    expect(gale.rating).not.toBe('epic')
  })

  it('holds the gale cap through the 45-55 km/h offshore window', () => {
    // Regression: smoothing the 45 km/h penalty cliff once shifted the ramp so
    // 45-54 km/h offshore cleared every veto — a 50 km/h (~27 kt) offshore
    // gale rated "epic". From 45 km/h up, windScore must stay at or below the
    // <=40 veto threshold for EVERY direction.
    for (const speed of [45, 46, 50, 55]) {
      for (const dir of [90, 270, null]) {
        const r = rateSurfConditions({ ...CLEAN, windSpeed: speed, windDirection: dir })
        expect(r.factors.wind, `speed ${speed}, dir ${dir}`).toBeLessThanOrEqual(40)
        expect(r.rating, `speed ${speed}, dir ${dir}`).not.toBe('epic')
      }
    }
  })
})
