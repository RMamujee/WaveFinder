import { describe, it, expect } from 'vitest'
import {
  deriveBreakArchetype,
  deriveBreakHand,
  hasBreakAnimationData,
  periodToSetInterval,
  crestCountForPeriod,
  MIN_CRESTS,
  MAX_CRESTS,
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

describe('hasBreakAnimationData', () => {
  // Widened 2026-08-31 from a California-only ANIMATED_REGIONS allowlist to a
  // field-presence gate: the audit found every derivation below reads plain
  // compass bearings and free-text prose, none of which are region- or
  // hemisphere-specific (see the comment above the function). Every one of
  // the 1,482 seed spots — US and international alike — has a numeric
  // facingDirection today, so the gate is universal in practice; it exists to
  // protect a future/legacy row that doesn't.
  it('is true for any spot with a finite facingDirection, regardless of country', () => {
    expect(hasBreakAnimationData({ facingDirection: 270 })).toBe(true) // USA
    expect(hasBreakAnimationData({ facingDirection: 215 })).toBe(true) // Indonesia
    expect(hasBreakAnimationData({ facingDirection: 210 })).toBe(true) // Australia
    expect(hasBreakAnimationData({ facingDirection: 145 })).toBe(true) // South Africa
    expect(hasBreakAnimationData({ facingDirection: 0 })).toBe(true) // due-north facing is a real bearing, not "missing"
  })

  it('is false when facingDirection is missing or non-finite', () => {
    expect(hasBreakAnimationData({ facingDirection: undefined as unknown as number })).toBe(false)
    expect(hasBreakAnimationData({ facingDirection: NaN })).toBe(false)
    expect(hasBreakAnimationData({ facingDirection: Infinity })).toBe(false)
  })
})

// ── Famous-wave fixtures across regions and hemispheres ─────────────────────
// Real seed descriptions (lib/spots-data.ts, via the per-region files under
// lib/spots/) for spots outside the old California-only gate. Peel direction
// and archetype are checked against how each wave is actually known to break,
// not just against the regex — this is what would have caught a
// hemisphere-flipped derivation. All pass unmodified, which is the audit's
// conclusion: `deriveBreakHand` never reads facingDirection/swellDirection (it
// is pure prose), and `deriveBreakArchetype` never reads geography at all.
describe('famous waves outside California (2026-08-31 gate-widening fixtures)', () => {
  it('Backdoor Pipeline, Oahu, Hawaii, USA — reef, right (northern hemisphere)', () => {
    const description =
      'The right-hand barrel that breaks off the same peak as Pipeline, offering a thick, grinding tube over a razor-sharp reef. Considered one of the most dangerous waves in Hawaii.'
    expect(deriveBreakArchetype('reef', description)).toBe('reef')
    expect(deriveBreakHand(description)).toBe('right')
  })

  it('Supertubos, Peniche, Portugal — beach break (Atlantic, northern hemisphere)', () => {
    const description =
      'Portugal\'s most powerful beach break, nicknamed the "European Pipeline." Fast, hollow barrels on NW swells at mid to low tide. Hosts the WSL Championship Tour annually.'
    expect(deriveBreakArchetype('sand', description)).toBe('beach')
    // The prose names no side — A-frame is the honest default, not a guess.
    expect(deriveBreakHand(description)).toBe('a-frame')
  })

  it('Padang Padang, Bukit Peninsula, Bali, Indonesia — reef, left (southern hemisphere)', () => {
    const description =
      'A world-famous left-hand barrel through a cave entrance and down a steep cliff path. Heavy, shallow tubes over a coral reef. Featured in Eat Pray Love. Hosts the Rip Curl Cup on invitation only.'
    expect(deriveBreakArchetype('coral', description)).toBe('reef')
    expect(deriveBreakHand(description)).toBe('left')
  })

  it('Bells Beach, Torquay, Victoria, Australia — reef, right (Southern Ocean, southern hemisphere)', () => {
    const description =
      "Australia's most iconic surf break and home of the world's longest-running professional surfing event. A powerful right-hand reef that handles massive Southern Ocean swells. Easter hosts the Rip Curl Pro."
    expect(deriveBreakArchetype('reef', description)).toBe('reef')
    expect(deriveBreakHand(description)).toBe('right')
  })

  it('Supertubes, Jeffreys Bay, South Africa — point, right (southern hemisphere)', () => {
    const description =
      "Arguably the world's best right-hand point break. Supertubes at J-Bay is a flawless, long, hollow right that peels perfectly for hundreds of metres on S-SW swells. Home of the WSL J-Bay Open."
    expect(deriveBreakArchetype('rock', description)).toBe('point')
    expect(deriveBreakHand(description)).toBe('right')
  })

  it('Gravière, Hossegor, France — beach break (Atlantic, northern hemisphere)', () => {
    const description =
      'The most powerful beach break peak in Hossegor. The deepwater Hossegor channel delivers unfiltered SW Atlantic groundswell creating intense, barreling peaks. Hosts the WSL France event annually.'
    expect(deriveBreakArchetype('sand', description)).toBe('beach')
    expect(deriveBreakHand(description)).toBe('a-frame')
  })

  // relativeSwellAngle takes no latitude/hemisphere input — it is `swellDirection
  // - facingDirection` on plain 0-360 compass bearings, the same convention
  // lib/forecast/rating.ts's directionalExposure/angleDiff use. Pin real
  // southern-hemisphere facingDirection values through it to confirm the sign
  // convention holds without a hemisphere-specific branch: swell arriving
  // exactly on a spot's facing bearing is always 0 off, and a swell a fixed
  // number of degrees to one side is always signed the same way, wherever the
  // spot sits on Earth.
  it('relativeSwellAngle is hemisphere-blind for real southern-hemisphere facing directions', () => {
    expect(relativeSwellAngle(210, 210)).toBe(0) // Bells, facingDirection 210, swell square on
    expect(relativeSwellAngle(220, 210)).toBe(10) // Bells, swell 10° round from facing
    expect(relativeSwellAngle(200, 210)).toBe(-10)
    expect(relativeSwellAngle(145, 145)).toBe(0) // Supertubes J-Bay, facingDirection 145
    expect(relativeSwellAngle(215, 215)).toBe(0) // Padang Padang, facingDirection 215
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
    expect(periodToSetInterval(1)).toBeGreaterThanOrEqual(1.2)
    expect(periodToSetInterval(40)).toBeLessThanOrEqual(3.6)
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

// ── Crest spacing (2026-08-07 redesign) ─────────────────────────────────────
// Period is encoded twice in the diagram: as cadence, and as how many crests
// occupy the same stretch of water. The second channel is what makes period
// legible in a still frame — which matters because that still frame is exactly
// what prefers-reduced-motion users and swell-less forecasts get.
describe('crestCountForPeriod', () => {
  it('puts fewer crests on screen for a longer period', () => {
    expect(crestCountForPeriod(16)).toBeLessThan(crestCountForPeriod(7))
  })

  it('never falls outside the drawable range', () => {
    for (const p of [0, -3, 0.5, 2, 7, 12, 16, 25, 200, NaN, Infinity]) {
      const n = crestCountForPeriod(p)
      expect(n, `period ${p}`).toBeGreaterThanOrEqual(MIN_CRESTS)
      expect(n, `period ${p}`).toBeLessThanOrEqual(MAX_CRESTS)
      expect(Number.isInteger(n), `period ${p}`).toBe(true)
    }
  })

  it('is monotonic — a longer period never adds crests', () => {
    let previous = crestCountForPeriod(4)
    for (let p = 4; p <= 24; p += 0.5) {
      const n = crestCountForPeriod(p)
      expect(n, `period ${p}`).toBeLessThanOrEqual(previous)
      previous = n
    }
  })

  it('degrades to the sparsest frame when there is no swell', () => {
    // Shares the no-swell path with the static frame, so a dead forecast reads
    // as calm rather than as busy short-period chop.
    expect(crestCountForPeriod(0)).toBe(MIN_CRESTS)
  })
})
