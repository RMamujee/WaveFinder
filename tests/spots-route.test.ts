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
  windGust: null,
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

// The home hero downloads this before it can draw a single pin, so every field
// in it is on the critical path to first paint. Measured over the full dataset:
// 297.6 KB (slim) -> 230.1 KB raw, 61.0 KB -> 53.3 KB gzipped.
describe('GET /api/spots?markers=true', () => {
  const MARKER_FIELDS = ['id', 'name', 'region', 'lat', 'lng', 'difficulty', 'facingDirection']

  it('emits exactly the fields SpotMap needs to place and label a pin', async () => {
    const [spot] = await getSpots('markers=true&q=Malibu')
    expect(Object.keys(spot).sort()).toEqual([...MARKER_FIELDS].sort())
  })

  it('keeps facingDirection — the pin is nudged offshore along it', async () => {
    // Without it SpotMap computes the marker position from `undefined` and
    // every pin lands at NaN, i.e. nowhere. It is the least obviously
    // "marker-essential" field in the projection and the easiest to trim.
    const [spot] = await getSpots('markers=true&q=Malibu')
    expect(typeof spot.facingDirection).toBe('number')
    expect(Number.isFinite(spot.facingDirection as number)).toBe(true)
  })

  it('drops country and slug', async () => {
    const [spot] = await getSpots('markers=true&q=Malibu')
    expect(spot).not.toHaveProperty('country')
    expect(spot).not.toHaveProperty('slug')
    expect(spot).not.toHaveProperty('description')
  })

  it('serves an id that IS the slug, so the caller can re-attach it', async () => {
    // LiveMapHero rebuilds `slug` from `id` to rescue those bytes, and
    // SpotMap's popup link (/spots/${slug}) breaks the moment that stops
    // holding. Pinned against the slim projection, which still sends both.
    const marker = await getSpots('markers=true&q=Malibu')
    const slim = await getSpots('slim=true&q=Malibu')
    expect(marker.length).toBe(slim.length)
    expect(marker.length).toBeGreaterThan(0)
    for (const [i, m] of marker.entries()) {
      expect(m.id).toBe(slim[i].slug)
    }
  })

  it('is strictly smaller than the slim payload it replaces', async () => {
    const res = await GET(new Request('http://localhost/api/spots?markers=true'))
    const slimRes = await GET(new Request('http://localhost/api/spots?slim=true'))
    const markerBytes = (await res.text()).length
    const slimBytes = (await slimRes.text()).length
    expect(markerBytes).toBeLessThan(slimBytes)
    // Guards against the projection quietly regrowing: the whole point is a
    // double-digit cut, not a rounding difference.
    expect(markerBytes / slimBytes).toBeLessThan(0.85)
  })

  it('carries the same CDN cache headers as slim', async () => {
    const res = await GET(new Request('http://localhost/api/spots?markers=true'))
    const slimRes = await GET(new Request('http://localhost/api/spots?slim=true'))
    for (const header of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control']) {
      expect(res.headers.get(header), header).toBe(slimRes.headers.get(header))
    }
  })

  it('does not fan out to Open-Meteo', async () => {
    batchCalls.length = 0
    await getSpots('markers=true')
    expect(batchCalls).toHaveLength(0)
  })

  it('leaves the slim projection alone — /compare still reads country', async () => {
    const [spot] = await getSpots('slim=true&q=Malibu')
    expect(Object.keys(spot).sort()).toEqual(
      ['id', 'slug', 'name', 'region', 'country', 'lat', 'lng', 'difficulty', 'facingDirection'].sort()
    )
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

  // An unscoped sweep is ~1,192 buckets, ~2,384 upstream calls. The ceiling
  // does not refuse it (that greyed the whole map the moment anyone zoomed
  // out); it SAMPLES: one representative per coarse cell, at most 200 of them,
  // and every spot is scored against its cell's reading and flagged `approx`.
  it('samples an unscoped sweep — at most 200 upstream points, every spot rated', async () => {
    const res = await GET(new Request('http://localhost/api/spots?withConditions=true'))
    const spots = await res.json() as Record<string, unknown>[]
    expect(batchCalls).toHaveLength(1)
    expect(batchCalls[0].length).toBeGreaterThan(50)
    expect(batchCalls[0].length).toBeLessThanOrEqual(200)
    expect(spots.length).toBeGreaterThan(1000)
    expect(spots.every((s) => s.currentRating !== 'unknown')).toBe(true)
    expect(spots.every((s) => s.approx === true)).toBe(true)
    expect(res.headers.get('Vercel-CDN-Cache-Control')).toMatch(/s-maxage=180/)
  })

  it('fans out exactly for a scoped viewport, with no approx flag', async () => {
    const spots = await getSpots('withConditions=true&bbox=32,-118,34,-117')
    expect(batchCalls).toHaveLength(1)
    expect(batchCalls[0].length).toBeGreaterThan(0)
    expect(batchCalls[0].length).toBeLessThanOrEqual(200)
    expect(spots.every((s) => !('approx' in s))).toBe(true)
  })

  // Zooming out must not cost a fresh fan-out per level: each coarser sample
  // is a subset of the finer one, so the batch cache already holds it. Four
  // zoom levels at ~400 fresh calls each would breach 600/min on one scroll.
  it('nests the samples: a coarser view fetches a subset of the finer view', async () => {
    const pointKey = (p: GeoPoint) => `${p.lat},${p.lng}`
    // North America (~480 fine buckets) → sampled; whole world → sampled coarser.
    await getSpots('withConditions=true&bbox=10,-150,60,-60')
    const regional = new Set(batchCalls[0].map(pointKey))
    batchCalls.length = 0
    await getSpots('withConditions=true&bbox=-90,-180,90,180')
    const world = batchCalls[0].map(pointKey)
    const worldInRegion = world.filter((k) => {
      const [lat, lng] = k.split(',').map(Number)
      return lat >= 10 && lat <= 60 && lng >= -150 && lng <= -60
    })
    expect(worldInRegion.length).toBeGreaterThan(0)
    expect(worldInRegion.every((k) => regional.has(k))).toBe(true)
  })

  // The sample point is the cell's representative, and a cell never straddles
  // the caller's bbox edge in a way that moves it: the same spot scores
  // against the same reading whether the box is wide or narrow at that level.
  it('keeps a cell’s representative stable when the bbox edge moves', async () => {
    const pointKey = (p: GeoPoint) => `${p.lat},${p.lng}`
    await getSpots('withConditions=true&bbox=10,-150,60,-60')
    const a = new Set(batchCalls[0].map(pointKey))
    batchCalls.length = 0
    await getSpots('withConditions=true&bbox=10,-150,60,-50')
    const b = new Set(batchCalls[0].map(pointKey))
    // Same level → the wider box adds cells but moves none; a coarser level →
    // its points are a subset of the finer ones. Either way one sample nests
    // inside the other. Representatives that shifted with the box would break
    // both containments.
    const aInB = [...a].every((k) => b.has(k))
    const bInA = [...b].every((k) => a.has(k))
    expect(aInB || bInA).toBe(true)
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
  // fresh cache miss. Unusable now degrades to the sampled overview: the same
  // ≤200 representatives every other oversized request reads, so a
  // cache-busting URL variant costs nothing new upstream.
  for (const bad of ['nonsense', '1,2,3', '34,-117,32,-118', '10,20,30']) {
    it(`samples an unusable bbox (${bad}) within the ceiling, keeping the markers`, async () => {
      const spots = await getSpots(`withConditions=true&bbox=${encodeURIComponent(bad)}`)
      expect(spots.length).toBeGreaterThan(100)
      expect(batchCalls).toHaveLength(1)
      expect(batchCalls[0].length).toBeLessThanOrEqual(200)
      expect(spots.every((s) => s.approx === true)).toBe(true)
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

  it('samples the whole-world box within the ceiling', async () => {
    const spots = await getSpots('withConditions=true&bbox=-90,-180,90,180')
    expect(batchCalls).toHaveLength(1)
    expect(batchCalls[0].length).toBeLessThanOrEqual(200)
    expect(spots.length).toBeGreaterThan(1000)
    expect(spots.every((s) => s.currentRating !== 'unknown')).toBe(true)
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
