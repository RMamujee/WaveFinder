import { describe, it, expect } from 'vitest'
import {
  SPOTS,
  SPOT_BY_SLUG,
  SLUGS,
  getSpotBySlug,
  listSpots,
  spotsInRegion,
  COUNTRIES,
  regionsForCountry,
} from '@/lib/spots/static-store'
import { SURF_SPOTS_SEED } from '@/lib/spots-data'
import { inferBottomType } from '@/lib/bottom-type'

const VALID_DIFFICULTIES = new Set(['beginner', 'intermediate', 'advanced'])

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
  it('id equals slug and bottomType matches inferBottomType for all spots', () => {
    for (const spot of SPOTS) {
      expect(spot.id).toBe(spot.slug)
      expect(spot.bottomType).toBe(inferBottomType(spot.description ?? null, spot.name))
      expect(VALID_DIFFICULTIES.has(spot.difficulty)).toBe(true)
    }
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
  it('matches case-insensitive contains on region', () => {
    const sample = SPOTS[0]
    const keyword = sample.region.split(',').pop()!.trim()
    const got = spotsInRegion(keyword)
    const expected = SURF_SPOTS_SEED.filter((s) =>
      s.region.toLowerCase().includes(keyword.toLowerCase())
    )
    expect(got.length).toBe(expected.length)
    // case-insensitive
    expect(spotsInRegion(keyword.toUpperCase()).length).toBe(got.length)
    expect(got.every((s) => s.region.toLowerCase().includes(keyword.toLowerCase()))).toBe(true)
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

describe('static-store: no duplicate slugs', () => {
  it('all slugs are unique', () => {
    expect(new Set(SLUGS).size).toBe(SLUGS.length)
  })
})
