import { describe, it, expect } from 'vitest'
import { buildSpatialIndex, findNearestInIndex } from '@/lib/forecast/nearest-fallback'

const spot = (lat: number, lng: number, name: string) => ({ lat, lng, name })

describe('buildSpatialIndex / findNearestInIndex', () => {
  it('finds the closest spot within the same 1° cell', () => {
    const index = buildSpatialIndex([
      spot(33.1, -117.3, 'near'),
      spot(33.9, -117.9, 'far'),
    ])
    expect(findNearestInIndex(index, 33.2, -117.4)?.name).toBe('near')
  })

  it('finds a spot in a neighbouring cell when the home cell is empty', () => {
    const index = buildSpatialIndex([spot(34.4, -119.7, 'santa-barbara')])
    expect(findNearestInIndex(index, 33.6, -118.0)?.name).toBe('santa-barbara')
  })

  it('returns null when nothing has data within the search radius', () => {
    // Hawaii is far outside the 3-ring (~300 km) search around California.
    const index = buildSpatialIndex([spot(21.3, -157.8, 'oahu')])
    expect(findNearestInIndex(index, 33.6, -118.0)).toBeNull()
  })

  it('returns the true closest among multiple candidates', () => {
    const index = buildSpatialIndex([
      spot(33.0, -117.0, 'a'),
      spot(33.5, -117.5, 'b'),
      spot(34.0, -118.0, 'c'),
    ])
    expect(findNearestInIndex(index, 33.6, -117.6)?.name).toBe('b')
  })

  it('prefers a closer spot just across a cell boundary over a far same-cell spot', () => {
    const index = buildSpatialIndex([
      spot(33.0, -117.5, 'far-same-cell'),   // ~110 km away, same 1° cell
      spot(34.01, -117.5, 'near-next-cell'), // ~2 km away, adjacent cell
    ])
    expect(findNearestInIndex(index, 33.99, -117.5)?.name).toBe('near-next-cell')
  })

  it('searches across the antimeridian', () => {
    const index = buildSpatialIndex([spot(-17.8, 179.9, 'fiji-east')])
    expect(findNearestInIndex(index, -17.9, -179.8)?.name).toBe('fiji-east')
  })

  it('returns null for an empty index', () => {
    const index = buildSpatialIndex([])
    expect(findNearestInIndex(index, 0, 0)).toBeNull()
  })
})
