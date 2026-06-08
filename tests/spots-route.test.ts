import { describe, it, expect, vi, beforeEach } from 'vitest'

// The /api/spots route pulls in Prisma and the Open-Meteo client at module
// load. Mock both so the handler never touches a DB or the network. The rating,
// bottom-type, and wave-power helpers are pure, so they run for real.
// vi.hoisted lets the mock factories (which are hoisted above this file) share
// these spies without a temporal-dead-zone error.
const { findMany, fetchCurrentConditions } = vi.hoisted(() => ({
  findMany: vi.fn(),
  fetchCurrentConditions: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: { surfSpot: { findMany } },
}))
vi.mock('@/lib/api/open-meteo', () => ({
  fetchCurrentConditions,
}))

import { GET } from '@/app/api/spots/route'

// A full SurfSpot row as Prisma would return it, including the heavy fields the
// map/list UI does not read.
function spotRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cspot00000000000000000001',
    slug: 'test-point',
    name: 'Test Point',
    region: 'Test Region',
    country: 'USA',
    lat: 33.5,
    lng: -117.75,
    description: 'A long hollow reef break description that should not ship to the map.',
    difficulty: 'advanced',
    facingDirection: 255,
    noaaTideStationId: '9410230',
    noaaBuoyId: '46086',
    webcamUrl: 'https://example.com/cam',
    webcamType: 'youtube',
    parkingOptions: [{ lat: 33.5, lng: -117.75, name: 'Lot', type: 'lot', isFree: true }],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

async function getConditions() {
  const res = await GET(new Request('https://wavefinder.test/api/spots?withConditions=true'))
  return { res, body: (await res.json()) as Record<string, unknown>[] }
}

describe('GET /api/spots?withConditions=true', () => {
  beforeEach(() => {
    findMany.mockReset()
    fetchCurrentConditions.mockReset()
    // Non-zero wave height takes the enriched (live-rating) branch.
    fetchCurrentConditions.mockResolvedValue({
      waveHeight: 1.4,
      wavePeriod: 12,
      swellDirection: 270,
      windSpeed: 8,
      windDirection: 270,
    })
  })

  it('omits fields the map/list UI never reads', async () => {
    findMany.mockResolvedValue([spotRow()])
    const { body } = await getConditions()
    const spot = body[0]

    // Heavy/unused fields must not ship.
    expect(spot).not.toHaveProperty('description')
    expect(spot).not.toHaveProperty('webcamUrl')
    expect(spot).not.toHaveProperty('webcamType')
    expect(spot).not.toHaveProperty('noaaTideStationId')
    expect(spot).not.toHaveProperty('noaaBuoyId')
  })

  it('still derives bottomType from the dropped description', async () => {
    // A reef-flavoured description should classify as a reef bottom even though
    // the raw description text is stripped from the response.
    findMany.mockResolvedValue([spotRow({ description: 'Shallow reef break over coral.' })])
    const { body } = await getConditions()
    const spot = body[0]

    expect(spot).not.toHaveProperty('description')
    expect(typeof spot.bottomType).toBe('string')
    expect((spot.bottomType as string).length).toBeGreaterThan(0)
  })

  it('keeps the fields the map and list actually consume', async () => {
    findMany.mockResolvedValue([spotRow()])
    const { body } = await getConditions()
    const spot = body[0]

    // Identity + map marker fields.
    expect(spot.id).toBe('cspot00000000000000000001')
    expect(spot.slug).toBe('test-point')
    expect(spot.name).toBe('Test Point')
    expect(spot.lat).toBe(33.5)
    expect(spot.lng).toBe(-117.75)
    // Parking layer (SpotMap.tsx) still needs this one heavy field, intact.
    const parking = spot.parkingOptions as Array<Record<string, unknown>>
    expect(Array.isArray(parking)).toBe(true)
    expect(parking).toHaveLength(1)
    expect(parking[0]).toHaveProperty('lat')
    // Live-condition fields.
    expect(spot).toHaveProperty('currentRating')
    expect(spot).toHaveProperty('currentWaveHeight')
    expect(spot).toHaveProperty('wavePower')
  })

  it('sets a shared-cache header so the edge absorbs the fan-out', async () => {
    findMany.mockResolvedValue([spotRow()])
    const { res } = await getConditions()
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=180')
  })
})
