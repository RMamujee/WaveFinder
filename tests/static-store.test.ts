import { describe, it, expect } from 'vitest'
import {
  SPOTS,
  SPOT_BY_SLUG,
  SLUGS,
  getSpotBySlug,
  listSpots,
  spotsInRegion,
  regionMatchesKeyword,
  conditionsBucketKey,
  conditionsBucketPoint,
  COUNTRIES,
  regionsForCountry,
} from '@/lib/spots/static-store'
import { SURF_SPOTS_SEED } from '@/lib/spots-data'

// 'expert' was missing from the store's enum, so 44 spots — Nazaré,
// Mullaghmore, Dungeons — were silently coerced to 'intermediate' and were
// filterable as such.
const VALID_DIFFICULTIES = new Set(['beginner', 'intermediate', 'advanced', 'expert'])

// Reference filter that mirrors the Prisma AND/OR semantics in
// app/api/spots/route.ts against the seed data, independent of the store.
function referenceList(opts: {
  q?: string
  difficulty?: string
  country?: string
  ids?: string[]
}) {
  const q = (opts.q ?? '').toLowerCase()
  const difficulty = opts.difficulty ?? ''
  const country = opts.country ?? ''
  const ids = opts.ids && opts.ids.length ? new Set(opts.ids) : null
  return SURF_SPOTS_SEED
    .filter((s) => {
      // id is the slug in the store
      if (ids && !ids.has(s.slug)) return false
      if (q) {
        const ok =
          s.name.toLowerCase().includes(q) ||
          s.region.toLowerCase().includes(q) ||
          s.country.toLowerCase().includes(q)
        if (!ok) return false
      }
      const diff = VALID_DIFFICULTIES.has(s.difficulty) ? s.difficulty : 'intermediate'
      if (difficulty && diff !== difficulty) return false
      if (country && s.country !== country) return false
      return true
    })
    .map((s) => s.slug)
    .sort((a, b) => {
      const an = SURF_SPOTS_SEED.find((x) => x.slug === a)!.name
      const bn = SURF_SPOTS_SEED.find((x) => x.slug === b)!.name
      return an.localeCompare(bn)
    })
}

describe('static-store: map + resolution', () => {
  it('map size equals seed length and SPOTS covers every seed slug', () => {
    expect(SPOT_BY_SLUG.size).toBe(SURF_SPOTS_SEED.length)
    expect(SPOTS.length).toBe(SURF_SPOTS_SEED.length)
    for (const seed of SURF_SPOTS_SEED) {
      expect(SPOT_BY_SLUG.has(seed.slug)).toBe(true)
    }
  })

  it('every slug resolves via getSpotBySlug', () => {
    for (const slug of SLUGS) {
      expect(getSpotBySlug(slug)?.slug).toBe(slug)
    }
  })

  it('unknown slug resolves to null', () => {
    expect(getSpotBySlug('not-a-real-spot-xyz')).toBeNull()
    expect(getSpotBySlug('')).toBeNull()
  })
})

describe('static-store: id===slug and bottomType', () => {
  it('id equals slug and bottomType comes from the seed, not the prose', () => {
    // bottomType used to be re-derived from the description on every request,
    // so editing marketing copy silently re-rated the spot. It is now a stored
    // seed field (scripts/backfill-bottom-type.ts) and the store passes it
    // through untouched.
    const seedBottom = new Map(
      (SURF_SPOTS_SEED as unknown as Array<{ slug: string; bottomType: string }>)
        .map((s) => [s.slug, s.bottomType])
    )
    for (const spot of SPOTS) {
      expect(spot.id).toBe(spot.slug)
      expect(spot.bottomType).toBe(seedBottom.get(spot.slug))
      expect(VALID_DIFFICULTIES.has(spot.difficulty)).toBe(true)
    }
  })

  it('preserves the seed difficulty rather than coercing unknown values', () => {
    const seedDifficulty = new Map(
      (SURF_SPOTS_SEED as unknown as Array<{ slug: string; difficulty: string }>)
        .map((s) => [s.slug, s.difficulty])
    )
    for (const spot of SPOTS) expect(spot.difficulty).toBe(seedDifficulty.get(spot.slug))
    expect(SPOTS.filter((s) => s.difficulty === 'expert').length).toBeGreaterThan(0)
  })
})

describe('static-store: listSpots parity vs reference filter', () => {
  const cases: Array<{ q?: string; difficulty?: string; country?: string }> = [
    {},
    { q: 'beach' },
    { q: 'reef' },
    { q: 'point' },
    { q: 'USA' },
    { q: 'San' },
    { difficulty: 'beginner' },
    { difficulty: 'intermediate' },
    { difficulty: 'advanced' },
    { country: 'USA' },
    { country: 'Australia' },
    { country: 'Indonesia' },
    { q: 'beach', difficulty: 'beginner' },
    { q: 'reef', country: 'USA' },
    { q: 'San', difficulty: 'advanced', country: 'USA' },
  ]

  for (const c of cases) {
    it(`parity for ${JSON.stringify(c)} including ordering`, () => {
      const got = listSpots(c).map((s) => s.slug)
      const expected = referenceList(c)
      expect(got).toEqual(expected)
    })
  }
})

describe('static-store: ids filter', () => {
  it('filters by ids (slugs) and preserves name ordering', () => {
    const sample = [SLUGS[5], SLUGS[1], SLUGS[20], 'definitely-not-a-slug']
    const got = listSpots({ ids: sample }).map((s) => s.slug)
    const expected = referenceList({ ids: sample })
    expect(got).toEqual(expected)
    expect(got).not.toContain('definitely-not-a-slug')
  })

  it('empty ids array is treated as no ids filter', () => {
    expect(listSpots({ ids: [] }).length).toBe(SPOTS.length)
  })
})

describe('static-store: spotsInRegion', () => {
  it('matches case-insensitively on whole words within the region', () => {
    const sample = SPOTS[0]
    const keyword = sample.region.split(',').pop()!.trim()
    const got = spotsInRegion(keyword)
    expect(got.length).toBeGreaterThan(0)
    expect(spotsInRegion(keyword.toUpperCase()).length).toBe(got.length)
    expect(got.every((s) => s.region.toLowerCase().includes(keyword.toLowerCase()))).toBe(true)
  })

  it('does not match a keyword that lands mid-word', () => {
    // "Ventura" matched "Fuerteventura", so Canary Islands spots were returned
    // for the California region and scored against Californian swell — inside
    // the Pro-gated best-spots feature.
    expect(regionMatchesKeyword('Fuerteventura, Canary Islands', 'Ventura')).toBe(false)
    expect(regionMatchesKeyword('Ventura County', 'Ventura')).toBe(true)
    expect(regionMatchesKeyword('Ventura', 'Ventura')).toBe(true)
    // Multi-word and punctuation-adjacent keywords still match.
    expect(regionMatchesKeyword('Orange County', 'Orange')).toBe(true)
    expect(regionMatchesKeyword("Jeffrey's Bay, Eastern Cape", "Jeffrey's Bay")).toBe(true)
    expect(regionMatchesKeyword('Malibu, California', 'California')).toBe(true)
  })

  it('every region a spot lives in resolves to at least that spot', () => {
    // The word-boundary rule must not orphan a spot from its own region — the
    // spot page and best-spots both look regions up by keyword.
    for (const spot of SPOTS) {
      const broad = spot.region.split(',').pop()!.trim()
      expect(regionMatchesKeyword(spot.region, broad), spot.region).toBe(true)
    }
  })
})

describe('static-store: COUNTRIES / regionsForCountry', () => {
  it('COUNTRIES equals distinct-over-seed sorted ascending', () => {
    const expected = [...new Set(SURF_SPOTS_SEED.map((s) => s.country))].sort((a, b) =>
      a.localeCompare(b)
    )
    expect([...COUNTRIES]).toEqual(expected)
  })

  it('regionsForCountry equals distinct regions for that country sorted ascending', () => {
    for (const country of COUNTRIES.slice(0, 8)) {
      const expected = [
        ...new Set(
          SURF_SPOTS_SEED.filter((s) => s.country === country).map((s) => s.region)
        ),
      ].sort((a, b) => a.localeCompare(b))
      expect(regionsForCountry(country)).toEqual(expected)
    }
  })

  it('regionsForCountry returns empty for unknown country', () => {
    expect(regionsForCountry('Atlantis')).toEqual([])
  })
})

describe('static-store: conditions buckets', () => {
  it('resolves a bucket to the same representative from any member coordinate', () => {
    // The representative must not depend on which spot asked — it used to be
    // the first spot of the caller's FILTERED list, so a difficulty filter
    // changed the queried coordinate (and the cache key) for 229 spots.
    const byBucket = new Map<string, string>()
    for (const spot of SPOTS) {
      const key = conditionsBucketKey(spot.lat, spot.lng)
      const point = conditionsBucketPoint(spot.lat, spot.lng)
      const seen = byBucket.get(key)
      if (seen) expect(`${point.lat},${point.lng}`).toBe(seen)
      else byBucket.set(key, `${point.lat},${point.lng}`)
    }
    expect(byBucket.size).toBeGreaterThan(1000)
  })

  it('keeps every spot within half a bucket of its representative', () => {
    for (const spot of SPOTS) {
      const point = conditionsBucketPoint(spot.lat, spot.lng)
      expect(Math.abs(point.lat - spot.lat)).toBeLessThanOrEqual(0.05)
      expect(Math.abs(point.lng - spot.lng)).toBeLessThanOrEqual(0.05)
    }
  })

  it('falls back to the caller coordinate for a point in no bucket', () => {
    const point = conditionsBucketPoint(0.0001, 0.0001)   // open Atlantic
    expect(point).toEqual({ lat: 0.0001, lng: 0.0001 })
  })
})

describe('static-store: no duplicate slugs', () => {
  it('all slugs are unique', () => {
    expect(new Set(SLUGS).size).toBe(SLUGS.length)
  })
})
