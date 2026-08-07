import { describe, it, expect } from 'vitest'
import {
  deriveBreakArchetype,
  deriveBreakHand,
  isBreakAnimationRegion,
  periodToSetInterval,
  relativeSwellAngle,
} from '@/lib/forecast/break-animation'

describe('deriveBreakArchetype', () => {
  // Real seed descriptions (lib/spots-data.ts) — pins behaviour against the
  // actual prose the derivation has to survive, not hand-picked toy strings.
  it('classifies explicit point-break language as point, even over reef material', () => {
    expect(deriveBreakArchetype('reef', 'Legendary reef point below the Self-Realization Fellowship. Long peeling rights with multiple sections on NW swells.')).toBe('point') // Swamis
    expect(deriveBreakArchetype('rock', 'Right-hand point break south of Trestles, accessed through private property.')).toBe('point')
    expect(deriveBreakArchetype('rock', "The most famous point break in California. Long, perfect rights peel from First Point through Third Point.")).toBe('point') // Malibu
  })

  it('classifies reef language as reef even when "rocky" also appears', () => {
    expect(deriveBreakArchetype('mixed', 'Rocky reef breaks north of Pismo. Stairs and secret access points lead to quality rights and lefts.')).toBe('reef')
    expect(deriveBreakArchetype('reef', "Powerful reef break beneath 300-foot cliffs accessible only by steep trail. One of San Diego's premier big-wave spots with hollow A-frames on NW swells.")).toBe('reef') // Black's Beach
  })

  it('classifies beach-break language as beach', () => {
    expect(deriveBreakArchetype('sand', 'Fun beach break both sides of OB Pier. Consistent peaks work on small to moderate S and NW swells.')).toBe('beach')
    expect(deriveBreakArchetype('sand', "San Francisco's main surf break — a powerful, shifting beach break along 3 miles of coastline.")).toBe('beach') // Ocean Beach SF
  })

  it('falls back to the stored bottom material when prose gives no geometry hint', () => {
    // Mavericks: no point/reef/beach vocabulary in the description at all.
    expect(deriveBreakArchetype('mixed', 'Big wave spot near San Francisco known for massive, powerful waves reaching 60ft+. Cold water, heavy currents, only for expert surfers.')).toBe('beach')
    expect(deriveBreakArchetype('rock', 'A generic description with no geometry words.')).toBe('point')
    expect(deriveBreakArchetype('reef', 'A generic description with no geometry words.')).toBe('reef')
    expect(deriveBreakArchetype('coral', 'A generic description with no geometry words.')).toBe('reef')
    expect(deriveBreakArchetype('sand', 'A generic description with no geometry words.')).toBe('beach')
  })

  it('defaults missing/unknown bottom type and description to beach', () => {
    expect(deriveBreakArchetype(null, null)).toBe('beach')
    expect(deriveBreakArchetype(undefined, undefined)).toBe('beach')
    expect(deriveBreakArchetype('mixed', undefined)).toBe('beach')
  })

  it('prefers a "reef point" or "rocky point" reading over generic reef language', () => {
    expect(deriveBreakArchetype('reef', 'A hollow reef point that wraps around the headland on big NW swells.')).toBe('point')
    expect(deriveBreakArchetype('rock', 'A rocky point delivering long rides.')).toBe('point')
  })
})

describe('deriveBreakHand', () => {
  it('reads explicit left-hand language', () => {
    expect(deriveBreakHand("A left-breaking reef pass on Oahu's North Shore that produces perfect, hollow barrels.")).toBe('left') // Pipeline
    expect(deriveBreakHand('The breakwater creates unique swell refraction. Left-handers peel inside the harbor entrance.')).toBe('left')
    expect(deriveBreakHand('Classic longboard point break on the west side of Santa Barbara. Mellow, peeling lefts ideal for noseriders.')).toBe('left')
  })

  it('reads explicit right-hand language', () => {
    expect(deriveBreakHand('Right-hand point break at Latigo Canyon Road in Malibu.')).toBe('right')
    expect(deriveBreakHand('Famous Santa Cruz point break delivering long, peeling rights.')).toBe('right')
    expect(deriveBreakHand('Remote reef break on the rugged coast. Hazard Canyon delivers quality right-handers on NW swells.')).toBe('right')
  })

  it('treats "rights and lefts" (either order) as A-frame, not a single hand', () => {
    expect(deriveBreakHand('Big Rock delivers fun rights and lefts on moderate NW swells.')).toBe('a-frame')
    expect(deriveBreakHand('George\'s and Pillbox deliver quality lefts and rights on NW and WNW swells.')).toBe('a-frame')
  })

  it('recognizes explicit A-frame language', () => {
    expect(deriveBreakHand('One of San Diego\'s premier big-wave spots with hollow A-frames on NW swells.')).toBe('a-frame')
    expect(deriveBreakHand('A perfect peak that peaks both ways on a good swell.')).toBe('a-frame')
  })

  it('falls back to A-frame when the prose does not say', () => {
    expect(deriveBreakHand('Fun peaks for all levels, especially on NW swells. Often crowded but consistent.')).toBe('a-frame')
    expect(deriveBreakHand(null)).toBe('a-frame')
    expect(deriveBreakHand(undefined)).toBe('a-frame')
  })

  it('does not false-positive on unrelated uses of "right" (e.g. "right swell", "right conditions")', () => {
    expect(deriveBreakHand('Gets good on the right WNW swell and offshore wind.')).toBe('a-frame')
    expect(deriveBreakHand('Fun for intermediates on right swell.')).toBe('a-frame')
  })
})

describe('isBreakAnimationRegion', () => {
  it('matches real California sub-region strings from the seed', () => {
    expect(isBreakAnimationRegion({ country: 'USA', region: 'La Jolla, San Diego' })).toBe(true)
    expect(isBreakAnimationRegion({ country: 'USA', region: 'Half Moon Bay, California' })).toBe(true) // Mavericks
    expect(isBreakAnimationRegion({ country: 'USA', region: 'Malibu, Los Angeles' })).toBe(true)
    expect(isBreakAnimationRegion({ country: 'USA', region: 'Arcata, NorCal' })).toBe(true)
    expect(isBreakAnimationRegion({ country: 'USA', region: 'Santa Cruz, Monterey Bay' })).toBe(true)
  })

  it('excludes the non-CA reference spots embedded in the CALIFORNIA_SPOTS array', () => {
    expect(isBreakAnimationRegion({ country: 'USA', region: 'North Shore, Oahu' })).toBe(false) // Pipeline
    expect(isBreakAnimationRegion({ country: 'USA', region: 'Brevard County, Florida' })).toBe(false) // Cocoa Beach
    expect(isBreakAnimationRegion({ country: 'USA', region: 'Outer Banks, North Carolina' })).toBe(false)
    expect(isBreakAnimationRegion({ country: 'France', region: 'Landes, Nouvelle-Aquitaine' })).toBe(false) // Hossegor
    expect(isBreakAnimationRegion({ country: 'Indonesia', region: 'Bukit Peninsula, Bali' })).toBe(false) // Uluwatu
  })

  it('excludes Baja California (Mexico) despite the literal substring "California"', () => {
    expect(isBreakAnimationRegion({ country: 'Mexico', region: 'Ensenada, Baja California' })).toBe(false)
    expect(isBreakAnimationRegion({ country: 'Mexico', region: 'La Paz, Baja California Sur' })).toBe(false)
  })

  it('excludes other US states whose region strings do not carry a CA marker', () => {
    expect(isBreakAnimationRegion({ country: 'USA', region: 'Cannon Beach, OR' })).toBe(false)
    expect(isBreakAnimationRegion({ country: 'USA', region: 'La Push, WA' })).toBe(false)
    expect(isBreakAnimationRegion({ country: 'USA', region: 'North Shore, Oahu' })).toBe(false)
  })
})

describe('periodToSetInterval', () => {
  it('gives a longer, slower cadence to a groundswell than a windswell', () => {
    const windswell = periodToSetInterval(7)
    const groundswell = periodToSetInterval(16)
    expect(groundswell).toBeGreaterThan(windswell)
    // "Unmistakable", not marginal — pin a real ratio, not just a > comparison.
    expect(groundswell / windswell).toBeGreaterThan(1.8)
  })

  it('scales monotonically with period', () => {
    const periods = [4, 7, 10, 13, 16, 20]
    const intervals = periods.map(periodToSetInterval)
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1])
    }
  })

  it('clamps rather than producing unwatchably fast or frozen-looking motion', () => {
    expect(periodToSetInterval(1)).toBeGreaterThanOrEqual(2.6)
    expect(periodToSetInterval(40)).toBeLessThanOrEqual(10.5)
  })

  it('treats missing/invalid swell data the same as the slowest real cadence, not a crash', () => {
    expect(periodToSetInterval(0)).toBe(periodToSetInterval(40))
    expect(periodToSetInterval(-5)).toBe(periodToSetInterval(40))
    expect(periodToSetInterval(NaN)).toBe(periodToSetInterval(40))
  })
})

describe('relativeSwellAngle', () => {
  it('is zero when swell direction matches facing direction exactly', () => {
    expect(relativeSwellAngle(270, 270)).toBe(0)
  })

  it('is signed, not just magnitude', () => {
    expect(relativeSwellAngle(280, 270)).toBe(10)
    expect(relativeSwellAngle(260, 270)).toBe(-10)
  })

  it('wraps correctly across the 0/360 boundary', () => {
    expect(relativeSwellAngle(10, 350)).toBe(20)
    expect(relativeSwellAngle(350, 10)).toBe(-20)
  })

  it('stays within (-180, 180]', () => {
    expect(relativeSwellAngle(0, 180)).toBe(180)
    expect(relativeSwellAngle(180, 0)).toBe(180)
    for (let s = 0; s < 360; s += 15) {
      for (let f = 0; f < 360; f += 15) {
        const diff = relativeSwellAngle(s, f)
        expect(diff).toBeGreaterThan(-180)
        expect(diff).toBeLessThanOrEqual(180)
      }
    }
  })
})
