import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CurrentMarineConditions, GeoPoint } from '@/lib/api/open-meteo'

// The route imports Prisma at module scope for the legacy-cuid bridge, which
// constructs a client (and wants DATABASE_URL) on import. Nothing here goes
// down that path.
vi.mock('@/lib/prisma', () => ({
  prisma: { surfSpot: { findMany: async () => [] } },
}))

const batchCalls: GeoPoint[][] = []

// Flipped by the degraded-response tests: `null` is what a refused Open-Meteo
// chunk resolves to, and every spot behind it renders grey.
let batchFails = false

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
      return points.map(() => (batchFails ? null : CONDITIONS))
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

describe('GET /api/spots — CDN caching', () => {
  // The stale window is what keeps a visitor off the cold path. It only covers
  // the period after s-maxage lapses, so 180 s fresh + 60 s stale meant any
  // 4-minute gap in traffic evicted the entry and made the next visitor wait
  // out the whole Open-Meteo fan-out — 4.7 s of grey "No data" pins, measured
  // in production. These assertions exist because the defect was invisible for
  // months: the directive looked right in source.
  for (const query of ['country=USA', 'slim=true', 'withConditions=true&q=Malibu']) {
    it(`serves stale while revalidating for ?${query}`, async () => {
      const res = await GET(new Request(`http://localhost/api/spots?${query}`))
      for (const header of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control']) {
        const value = res.headers.get(header)
        expect(value, header).toBeTruthy()
        expect(value, header).toMatch(/stale-while-revalidate=\d+/)
        expect(value, header).toMatch(/s-maxage=\d+/)
      }
    })
  }

  it('gives the conditions payload a stale window longer than its fresh window', async () => {
    // The stale window is what absorbs a cold regeneration; a 60 s window
    // behind a 180 s TTL barely covered one.
    const res = await GET(new Request('http://localhost/api/spots?withConditions=true&q=Malibu'))
    const value = res.headers.get('Vercel-CDN-Cache-Control')!
    const maxAge = Number(/s-maxage=(\d+)/.exec(value)![1])
    const stale = Number(/stale-while-revalidate=(\d+)/.exec(value)![1])
    expect(stale).toBeGreaterThan(maxAge)
  })
})

describe('GET /api/spots?withConditions=true', () => {
  beforeEach(() => {
    batchCalls.length = 0
  })

  it('resolves every coordinate bucket in a single batched call', async () => {
    // Portugal, not USA: USA alone spans 414 buckets, past the fan-out ceiling.
    await getSpots('country=Portugal&withConditions=true')

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
    await getSpots('country=Portugal&withConditions=true')
    const unfiltered = new Map(
      batchCalls[0].map((p) => [conditionsBucketKey(p.lat, p.lng), `${p.lat},${p.lng}`])
    )

    batchCalls.length = 0
    await getSpots('country=Portugal&difficulty=beginner&withConditions=true')
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

// Open-Meteo bills a multi-location request PER LOCATION, so an unscoped sweep
// is ~1,194 marine + 1,194 weather calls against a free tier of 5,000/hour.
// With the route's own s-maxage that is ~9.6x the hourly allowance: the fan-out
// gets refused wholesale and every pin on the map renders grey while individual
// spot pages — one location each — keep working. `bbox` is the control that
// keeps a sweep inside the budget, so these assertions are about cost, not
// cosmetics.
describe('GET /api/spots?withConditions=true&bbox=', () => {
  beforeEach(() => {
    batchCalls.length = 0
  })

  // An unscoped sweep is ~1,192 buckets, ~2,384 upstream calls — the ceiling
  // refuses it outright: every marker comes back `unknown`, nothing is fetched,
  // and the response is cached only briefly so pins colour in on zoom/filter.
  it('refuses to fan out for an unscoped sweep — zero upstream calls', async () => {
    const res = await GET(new Request('http://localhost/api/spots?withConditions=true'))
    const spots = await res.json() as Record<string, unknown>[]
    expect(batchCalls).toHaveLength(0)
    expect(spots.length).toBeGreaterThan(1000)
    expect(spots.every((s) => s.currentRating === 'unknown')).toBe(true)
    expect(res.headers.get('Vercel-CDN-Cache-Control')).toMatch(/s-maxage=20/)
  })

  it('still fans out for a scoped viewport', async () => {
    await getSpots('withConditions=true&bbox=32,-118,34,-117')
    expect(batchCalls).toHaveLength(1)
    expect(batchCalls[0].length).toBeGreaterThan(0)
    expect(batchCalls[0].length).toBeLessThanOrEqual(200)
  })

  it('returns only the spots inside the box', async () => {
    const spots = await getSpots('withConditions=true&bbox=32,-118,34,-117')
    expect(spots.length).toBeGreaterThan(0)
    for (const s of spots) {
      expect(s.lat as number).toBeGreaterThanOrEqual(32)
      expect(s.lat as number).toBeLessThanOrEqual(34)
      expect(s.lng as number).toBeGreaterThanOrEqual(-118)
      expect(s.lng as number).toBeLessThanOrEqual(-117)
    }
  })

  it('still rates the spots it does return', async () => {
    const spots = await getSpots('withConditions=true&bbox=32,-118,34,-117')
    expect(spots.every((s) => s.currentRating !== 'unknown')).toBe(true)
  })

  // Leaflet reports bounds off the edge of the world after a pan across the
  // dateline, so a box round the Pacific arrives as minLng > maxLng. Matching
  // that as a single span yields nothing and blanks the entire region.
  it('matches a box that crosses the antimeridian as two spans', async () => {
    const spots = await getSpots('withConditions=true&bbox=-25,170,-10,-170')
    expect(spots.length).toBeGreaterThan(0)
    expect(spots.some((s) => (s.lng as number) > 170)).toBe(true)
    expect(spots.some((s) => (s.lng as number) < -170)).toBe(true)
    for (const s of spots) {
      expect(Math.abs(s.lng as number)).toBeGreaterThan(170)
    }
  })

  it('normalises longitudes reported past the edge of the world', async () => {
    // Same California box, expressed as Leaflet would after wrapping east.
    const wrapped = await getSpots('withConditions=true&bbox=32,242,34,243')
    const plain = await getSpots('withConditions=true&bbox=32,-118,34,-117')
    expect(wrapped.map((s) => s.id)).toEqual(plain.map((s) => s.id))
  })

  // An unusable bbox must not become a global fan-out — that was the fail-open
  // hole: `bbox=garbage` skipped the filter entirely and cost ~2,384 upstream
  // calls, and the CDN keying on the full query string made every variant a
  // fresh cache miss. Unusable now degrades to the refused (all-unknown,
  // zero-fetch) response; the pins still render, just grey.
  for (const bad of ['nonsense', '1,2,3', '34,-117,32,-118', '10,20,30']) {
    it(`refuses the fan-out for an unusable bbox (${bad}) without dropping the markers`, async () => {
      const spots = await getSpots(`withConditions=true&bbox=${encodeURIComponent(bad)}`)
      expect(spots.length).toBeGreaterThan(100)
      expect(batchCalls).toHaveLength(0)
      expect(spots.every((s) => s.currentRating === 'unknown')).toBe(true)
    })
  }

  // Leaflet legitimately reports >360° of longitude at low zooms. That used to
  // return null from parseBbox — discarding the LATITUDE filter too and falling
  // back to the full global sweep, reachable by clicking zoom-out. Longitude is
  // now clamped to the whole world while the latitude band keeps filtering; the
  // bucket ceiling then decides whether the request is affordable.
  it('keeps the latitude filter for a bbox spanning a full turn of longitude', async () => {
    const spots = await getSpots('withConditions=true&bbox=30,-500,45,300')
    expect(spots.length).toBeGreaterThan(0)
    for (const s of spots) {
      expect(s.lat as number).toBeGreaterThanOrEqual(30)
      expect(s.lat as number).toBeLessThanOrEqual(45)
    }
  })

  it('refuses the whole-world box outright', async () => {
    const spots = await getSpots('withConditions=true&bbox=-90,-180,90,180')
    expect(batchCalls).toHaveLength(0)
    expect(spots.length).toBeGreaterThan(1000)
    expect(spots.every((s) => s.currentRating === 'unknown')).toBe(true)
  })
})

describe('GET /api/spots?withConditions=true — degraded sweeps', () => {
  beforeEach(() => {
    batchCalls.length = 0
    batchFails = false
  })

  // A refused fan-out used to be cached exactly like a good one, so a single
  // bad sweep was pinned at the edge and served to every visitor for up to 15
  // minutes — and the client refetching could not clear it, because the
  // response looked successful. That is what made the grey map look permanent.
  it('caches a mostly-empty sweep only briefly', async () => {
    batchFails = true
    const res = await GET(new Request('http://localhost/api/spots?withConditions=true&q=Malibu'))
    const spots = await res.json() as Record<string, unknown>[]
    expect(spots.every((s) => s.currentRating === 'unknown')).toBe(true)

    const degraded = Number(/s-maxage=(\d+)/.exec(res.headers.get('Vercel-CDN-Cache-Control')!)![1])

    batchFails = false
    const okRes = await GET(new Request('http://localhost/api/spots?withConditions=true&q=Malibu'))
    const healthy = Number(/s-maxage=(\d+)/.exec(okRes.headers.get('Vercel-CDN-Cache-Control')!)![1])

    expect(degraded).toBeLessThan(healthy)
  })

  it('keeps the full cache window when the sweep succeeded', async () => {
    const res = await GET(new Request('http://localhost/api/spots?withConditions=true&q=Malibu'))
    expect(res.headers.get('Vercel-CDN-Cache-Control')).toContain('s-maxage=180')
  })
})
