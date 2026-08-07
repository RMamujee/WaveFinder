import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CurrentMarineConditions, GeoPoint } from '@/lib/api/open-meteo'

// The route imports Prisma at module scope for the legacy-cuid bridge, which
// constructs a client (and wants DATABASE_URL) on import. Nothing here goes
// down that path.
vi.mock('@/lib/prisma', () => ({
  prisma: { surfSpot: { findMany: async () => [] } },
}))

const batchCalls: GeoPoint[][] = []

const CONDITIONS: CurrentMarineConditions = {
  waveHeight: 1.6,
  wavePeriod: 11,
  swellHeight: 1.3,
  swellPeriod: 14,
  swellDirection: 270,
  secondarySwellHeight: null,
  secondarySwellPeriod: null,
  secondarySwellDirection: null,
  windWaveHeight: 0.3,
  windWavePeriod: 4,
  windSpeed: 9,
  windDirection: 45,
}

vi.mock('@/lib/api/open-meteo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/open-meteo')>()
  return {
    ...actual,
    fetchCurrentConditionsBatch: vi.fn(async (points: GeoPoint[]) => {
      batchCalls.push(points)
      return points.map(() => CONDITIONS)
    }),
  }
})

const { GET } = await import('@/app/api/spots/route')
const { conditionsBucketKey } = await import('@/lib/spots/static-store')

async function getSpots(query: string) {
  const res = await GET(new Request(`http://localhost/api/spots?${query}`))
  expect(res.status).toBe(200)
  return res.json() as Promise<Record<string, unknown>[]>
}

describe('GET /api/spots?withConditions=true', () => {
  beforeEach(() => {
    batchCalls.length = 0
  })

  it('resolves every coordinate bucket in a single batched call', async () => {
    await getSpots('country=USA&withConditions=true')

    expect(batchCalls).toHaveLength(1)
    // One entry per unique 0.05° bucket, deduplicated before the fetch.
    const keys = batchCalls[0].map((p) => conditionsBucketKey(p.lat, p.lng))
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.length).toBeGreaterThan(0)
  })

  // The bucket's representative used to be the first spot of the FILTERED
  // list, so a difficulty filter changed which coordinate was queried — and
  // therefore the conditions and the cache key — for 229 spots. The
  // representative now comes from the full dataset.
  it('queries the same coordinate for a bucket regardless of the caller filters', async () => {
    await getSpots('country=USA&withConditions=true')
    const unfiltered = new Map(
      batchCalls[0].map((p) => [conditionsBucketKey(p.lat, p.lng), `${p.lat},${p.lng}`])
    )

    batchCalls.length = 0
    await getSpots('country=USA&difficulty=beginner&withConditions=true')
    const filtered = batchCalls[0]

    expect(filtered.length).toBeGreaterThan(0)
    for (const p of filtered) {
      const key = conditionsBucketKey(p.lat, p.lng)
      expect(unfiltered.get(key)).toBe(`${p.lat},${p.lng}`)
    }
  })

  // Both map surfaces render straight from this payload, so a field dropped
  // here is a blank popup, not a type error.
  const MAP_FIELDS = [
    'id', 'slug', 'name', 'region', 'country', 'lat', 'lng',
    'difficulty', 'facingDirection', 'bottomType', 'parkingOptions',
    'currentRating', 'currentWaveHeight', 'currentFaceHeight',
    'currentPeriod', 'currentWindSpeed', 'currentWindDir', 'wavePower',
  ]

  it('emits every field the map and its popups read', async () => {
    const spots = await getSpots('q=Malibu&withConditions=true')
    expect(spots.length).toBeGreaterThan(0)
    for (const field of MAP_FIELDS) {
      expect(Object.keys(spots[0])).toContain(field)
    }
  })

  it('omits the spot-page fields no map surface reads', async () => {
    const [spot] = await getSpots('q=Malibu&withConditions=true')
    for (const field of ['description', 'webcamUrl', 'webcamType', 'noaaBuoyId', 'noaaTideStationId']) {
      expect(spot).not.toHaveProperty(field)
    }
  })

  it('does not leak the internal fallback marker', async () => {
    const [spot] = await getSpots('q=Malibu&withConditions=true')
    expect(spot).not.toHaveProperty('_needsFallback')
  })

  it('sends wind direction as the compass label the popup renders', async () => {
    const [spot] = await getSpots('q=Malibu&withConditions=true')
    // 45° → NE. The route used to send only numeric `currentWindDirection`,
    // which the popup never read.
    expect(spot.currentWindDir).toBe('NE')
  })

  it('rates from the swell partition, not the combined sea', async () => {
    const [spot] = await getSpots('q=Malibu&withConditions=true')
    expect(spot.currentWaveHeight).toBe(1.6)
    // 1.3 m at 14 s shoals to a face taller than the deep-water reading.
    expect(spot.currentFaceHeight).toBeGreaterThan(1.6)
    expect(['poor', 'fair', 'good', 'epic']).toContain(spot.currentRating)
  })

  it('leaves the non-conditions payload untouched', async () => {
    const [spot] = await getSpots('q=Malibu')
    // The plain list still returns full spot records for the spot pages.
    expect(spot).toHaveProperty('description')
    expect(spot).not.toHaveProperty('currentRating')
    expect(batchCalls).toHaveLength(0)
  })
})
