import { describe, it, expect } from 'vitest'
import type { WaveGridCellTuple } from '@/lib/api/ww3-overview'
import {
  FLOW_GRID_STEP_DEG,
  buildFlowIndex,
  intensityFactorForHeight,
  particleCountForViewport,
  metersPerPixel,
  sampleFlow,
  speedFactorForPeriod,
} from '@/lib/forecast/swell-flow'

// A 2x2 lattice of cells at the native FLOW_GRID_STEP_DEG spacing, all
// pointing due north (sdir 180 = FROM the south), so the interpolated
// heading is unambiguous everywhere inside the square: due north (0°).
const NORTH_SQUARE: WaveGridCellTuple[] = [
  [30, -120, 1, 10, 180],
  [30, -118, 1, 10, 180],
  [32, -120, 1, 10, 180],
  [32, -118, 1, 10, 180],
]

describe('buildFlowIndex / sampleFlow', () => {
  it('flips the stored FROM bearing to a TOWARD heading', () => {
    const index = buildFlowIndex(NORTH_SQUARE)
    const sample = sampleFlow(index, 31, -119)!
    // sdir 180 (from the south) -> particles travel toward the north (0/360).
    expect(sample.headingDeg).toBeCloseTo(0, 5)
  })

  it('bilinearly interpolates height and period at the centre of four cells', () => {
    const cells: WaveGridCellTuple[] = [
      [30, -120, 1.0, 8, 180],
      [30, -118, 3.0, 8, 180],
      [32, -120, 1.0, 8, 180],
      [32, -118, 3.0, 8, 180],
    ]
    const index = buildFlowIndex(cells)
    const centre = sampleFlow(index, 31, -119)!
    expect(centre.heightM).toBeCloseTo(2.0, 5)

    // Nearer the tall-height edge should read higher than the centre.
    const nearTall = sampleFlow(index, 31, -118.1)!
    expect(nearTall.heightM).toBeGreaterThan(centre.heightM)
  })

  it('interpolates direction as a vector, not as raw degrees, across a 0/360 wrap', () => {
    // West corners point toward 350°, east corners toward 10°. Averaging the
    // raw numbers would give 180 — the exact opposite of both. The vector
    // average must land near 0/360.
    const cells: WaveGridCellTuple[] = [
      [30, -120, 1, 10, 170], // heading = (170+180)%360 = 350
      [30, -118, 1, 10, 190], // heading = (190+180)%360 = 10
      [32, -120, 1, 10, 170],
      [32, -118, 1, 10, 190],
    ]
    const index = buildFlowIndex(cells)
    const mid = sampleFlow(index, 31, -119)!
    const wrapped = mid.headingDeg > 180 ? mid.headingDeg - 360 : mid.headingDeg
    expect(Math.abs(wrapped)).toBeLessThan(5)
  })

  it('returns null when any of the four surrounding cells has no data', () => {
    // Only three of the four corners present — the fourth (32,-118) is land.
    const cells: WaveGridCellTuple[] = [
      [30, -120, 1, 10, 180],
      [30, -118, 1, 10, 180],
      [32, -120, 1, 10, 180],
    ]
    const index = buildFlowIndex(cells)
    expect(sampleFlow(index, 31, -119)).toBeNull()
  })

  it('returns null entirely outside the indexed lattice', () => {
    const index = buildFlowIndex(NORTH_SQUARE)
    expect(sampleFlow(index, 60, 60)).toBeNull()
  })

  it('uses the same grid step the server subsamples to', () => {
    // WW3_GRID_DEG (0.5) * WW3_SPATIAL_STRIDE (4) on the server — duplicated
    // here rather than imported (see the module comment), so this pins the
    // two from drifting apart silently.
    expect(FLOW_GRID_STEP_DEG).toBe(2)
  })
})

describe('speedFactorForPeriod', () => {
  it('is 0 at and below the short-period floor', () => {
    expect(speedFactorForPeriod(6)).toBe(0)
    expect(speedFactorForPeriod(2)).toBe(0)
  })

  it('is 1 at and above the long-period ceiling', () => {
    expect(speedFactorForPeriod(20)).toBe(1)
    expect(speedFactorForPeriod(30)).toBe(1)
  })

  it('is monotonically increasing in between', () => {
    expect(speedFactorForPeriod(13)).toBeGreaterThan(speedFactorForPeriod(9))
  })
})

describe('intensityFactorForHeight', () => {
  it('clamps at both ends', () => {
    expect(intensityFactorForHeight(0)).toBe(0)
    expect(intensityFactorForHeight(10)).toBe(1)
  })

  it('is monotonically increasing in between', () => {
    expect(intensityFactorForHeight(2)).toBeGreaterThan(intensityFactorForHeight(1))
  })
})

describe('particleCountForViewport', () => {
  it('grows with viewport area', () => {
    const small = particleCountForViewport(320, 400, 1)
    const large = particleCountForViewport(1600, 900, 1)
    expect(large).toBeGreaterThan(small)
  })

  it('caps the DPR multiplier so a 3x phone is not 9x the particles of 1x', () => {
    const at1x = particleCountForViewport(390, 700, 1)
    const at2x = particleCountForViewport(390, 700, 2)
    const at3x = particleCountForViewport(390, 700, 3)
    expect(at2x).toBeGreaterThan(at1x)
    // 2x and 3x are both clamped to the same effective 2x multiplier.
    expect(at3x).toBe(at2x)
  })

  it('never goes below the floor or above the ceiling', () => {
    expect(particleCountForViewport(10, 10, 1)).toBeGreaterThanOrEqual(40)
    expect(particleCountForViewport(4000, 4000, 3)).toBeLessThanOrEqual(900)
  })

  it('degrades to the floor rather than throwing on a zero-size viewport', () => {
    expect(particleCountForViewport(0, 0, 1)).toBe(40)
  })
})

describe('metersPerPixel', () => {
  it('halves for every zoom level increase, at a fixed latitude', () => {
    const z5 = metersPerPixel(0, 5)
    const z6 = metersPerPixel(0, 6)
    expect(z5 / z6).toBeCloseTo(2, 5)
  })

  it('shrinks toward the poles at a fixed zoom — Mercator stretches high latitudes', () => {
    const atEquator = metersPerPixel(0, 8)
    const at60 = metersPerPixel(60, 8)
    expect(at60).toBeLessThan(atEquator)
    expect(at60 / atEquator).toBeCloseTo(Math.cos((60 * Math.PI) / 180), 5)
  })
})
