import { describe, it, expect } from 'vitest'
import {
  SPOTS,
  CONDITIONS_BUCKET_DEG,
  OVERVIEW_MAX_LEVEL,
  conditionsBucketKey,
  conditionsBucketPoint,
  overviewCellKey,
  planConditionsOverview,
} from '@/lib/spots/static-store'

const pointKey = (p: { lat: number; lng: number }) => `${p.lat},${p.lng}`

describe('planConditionsOverview', () => {
  it('fits the whole world under a 200-point ceiling', () => {
    const plan = planConditionsOverview(SPOTS, 200)
    expect(plan).not.toBeNull()
    expect(plan!.points.length).toBeLessThanOrEqual(200)
    expect(plan!.points.length).toBeGreaterThan(50)
    expect(plan!.cellDeg).toBe(CONDITIONS_BUCKET_DEG * 2 ** plan!.level)
  })

  it('picks the finest level that fits', () => {
    const loose = planConditionsOverview(SPOTS, 2000)!
    const tight = planConditionsOverview(SPOTS, 200)!
    expect(loose.level).toBe(1)
    expect(tight.level).toBeGreaterThan(loose.level)
  })

  // The whole point of nesting: zooming out must re-read cached buckets, not
  // fan out afresh. Every level's representatives are a subset of the level
  // below, all the way down to the exact 0.05° bucket points.
  it('nests representatives level by level down to the fine buckets', () => {
    const fine = new Set(SPOTS.map((s) => pointKey(conditionsBucketPoint(s.lat, s.lng))))
    let prev = fine
    for (let level = 1; level <= OVERVIEW_MAX_LEVEL; level++) {
      const cells = new Set(SPOTS.map((s) => overviewCellKey(s.lat, s.lng, level)))
      const plan = planConditionsOverview(SPOTS, cells.size)!
      expect(plan.level).toBe(level)
      const reps = new Set(plan.points.map(pointKey))
      expect(reps.size).toBe(cells.size)
      for (const r of reps) expect(prev.has(r)).toBe(true)
      prev = reps
    }
  })

  it('maps every spot to a representative inside its own cell', () => {
    const plan = planConditionsOverview(SPOTS, 200)!
    const fetched = new Set(plan.points.map(pointKey))
    for (const s of SPOTS) {
      const rep = plan.pointFor(s.lat, s.lng)
      expect(overviewCellKey(rep.lat, rep.lng, plan.level)).toBe(overviewCellKey(s.lat, s.lng, plan.level))
      expect(fetched.has(pointKey(rep))).toBe(true)
      // The representative is a real spot's coordinate, so its fine bucket is
      // exactly the cache key the batch fetch writes.
      expect(conditionsBucketKey(rep.lat, rep.lng)).toBe(conditionsBucketKey(rep.lat, rep.lng))
    }
  })

  it('does not move a representative when the caller filters the spot list', () => {
    const all = planConditionsOverview(SPOTS, 200)!
    const subset = SPOTS.filter((_, i) => i % 3 === 0)
    const some = planConditionsOverview(subset, 200)!
    for (const s of subset) {
      if (some.level !== all.level) break
      expect(pointKey(some.pointFor(s.lat, s.lng))).toBe(pointKey(all.pointFor(s.lat, s.lng)))
    }
  })

  it('floors cells consistently across the equator and the meridian', () => {
    // Fine bucket index -1 (lat ≈ -0.05) and +1 (lat ≈ +0.05) sit either side
    // of the equator. Arithmetic shift floors toward -∞, so -1 >> 1 === -1 and
    // 1 >> 1 === 0: distinct cells, and no cell is doubled up at zero the way a
    // truncating division would produce.
    expect(overviewCellKey(-0.04, 0.04, 1)).toBe('-1,0')
    expect(overviewCellKey(0.04, 0.04, 1)).toBe('0,0')
    expect(overviewCellKey(0.04, -0.04, 1)).toBe('0,-1')
    expect(overviewCellKey(-0.04, -0.04, 1)).toBe('-1,-1')
  })
})
