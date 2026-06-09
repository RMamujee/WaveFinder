import 'server-only'
import { SURF_SPOTS_SEED } from '@/lib/spots-data'
import { inferBottomType } from '@/lib/bottom-type'
import type { SurfSpot } from '@/types/spot'

// In-memory store for the ~1,490 immutable surf spots.
//
// The spot dataset (name, region, coordinates, NOAA station IDs, …) is static
// — it only changes when the seed data in lib/spots-data.ts changes — so we
// build an in-memory index once at module load and serve spot/list/forecast
// reads from it instead of hitting Postgres. Postgres still backs auth/billing
// and the transitional saved-spots bridge.
//
// CRITICAL: SurfSpot.id in Postgres is @default(cuid()) — minted at seed time
// and different per environment, so it is NOT reproducible in memory. Here the
// stable, environment-independent `slug` IS the id: every StaticSpot sets
// `id := slug`. API responses that carry an `id` keep the field; its value is
// now the slug.

const VALID_DIFFICULTIES = new Set(['beginner', 'intermediate', 'advanced'])

type SeedSpot = (typeof SURF_SPOTS_SEED)[number]

function toStaticSpot(s: SeedSpot): SurfSpot {
  const description = ('description' in s ? s.description : null) ?? null
  return {
    // id IS the slug — see module header.
    id: s.slug,
    slug: s.slug,
    name: s.name,
    region: s.region,
    country: s.country,
    lat: s.lat,
    lng: s.lng,
    description,
    difficulty: VALID_DIFFICULTIES.has(s.difficulty)
      ? (s.difficulty as SurfSpot['difficulty'])
      : 'intermediate',
    facingDirection: s.facingDirection,
    noaaTideStationId: s.noaaTideStationId ?? null,
    noaaBuoyId: s.noaaBuoyId ?? null,
    webcamUrl: s.webcamUrl ?? null,
    webcamType: s.webcamType ?? null,
    parkingOptions: ('parkingOptions' in s ? (s.parkingOptions as SurfSpot['parkingOptions']) : null) ?? null,
    bottomType: inferBottomType(description, s.name),
  }
}

// Name-sorted, ascending — mirrors `orderBy: { name: 'asc' }` used by the
// Prisma queries this store replaces.
export const SPOTS: readonly SurfSpot[] = SURF_SPOTS_SEED
  .map(toStaticSpot)
  .sort((a, b) => a.name.localeCompare(b.name))

export const SPOT_BY_SLUG: ReadonlyMap<string, SurfSpot> = new Map(
  SPOTS.map((s) => [s.slug, s] as const)
)

export const SLUGS: readonly string[] = SPOTS.map((s) => s.slug)

export function getSpotBySlug(slug: string): SurfSpot | null {
  return SPOT_BY_SLUG.get(slug) ?? null
}

export interface ListSpotsFilter {
  q?: string
  difficulty?: string
  country?: string
  ids?: string[]
}

// Mirrors the Prisma AND/OR semantics in app/api/spots/route.ts exactly:
//   AND([
//     ids.length ? { id: { in: ids } } : {},
//     q ? OR(name|region|country contains q, insensitive) : {},
//     difficulty ? { difficulty } : {},
//     country ? { country } : {},
//   ]) orderBy name asc
// `id` here is the slug, so the ids filter matches on slug.
export function listSpots(filter: ListSpotsFilter = {}): SurfSpot[] {
  const q = filter.q ? filter.q.toLowerCase() : ''
  const difficulty = filter.difficulty ?? ''
  const country = filter.country ?? ''
  const ids = filter.ids && filter.ids.length ? new Set(filter.ids) : null

  const result = SPOTS.filter((s) => {
    if (ids && !ids.has(s.id)) return false
    if (q) {
      const matches =
        s.name.toLowerCase().includes(q) ||
        s.region.toLowerCase().includes(q) ||
        s.country.toLowerCase().includes(q)
      if (!matches) return false
    }
    if (difficulty && s.difficulty !== difficulty) return false
    if (country && s.country !== country) return false
    return true
  })
  // SPOTS is already name-sorted; filtering preserves that order.
  return result
}

// Case-insensitive `contains` on region — matches the `mode: 'insensitive'`
// region lookups in app/api/best-spots/route.ts and the nearby-spots query on
// the spot page.
export function spotsInRegion(keyword: string): SurfSpot[] {
  const needle = keyword.toLowerCase()
  return SPOTS.filter((s) => s.region.toLowerCase().includes(needle))
}

// Distinct countries, sorted ascending — byte-matches the Prisma
// `distinct: ['country'], orderBy: { country: 'asc' }` output in
// app/api/spots/meta/route.ts.
export const COUNTRIES: readonly string[] = [
  ...new Set(SPOTS.map((s) => s.country)),
].sort((a, b) => a.localeCompare(b))

// Distinct regions for a country, sorted ascending — byte-matches the Prisma
// `where: { country }, distinct: ['region'], orderBy: { region: 'asc' }` output.
export function regionsForCountry(country: string): string[] {
  const regions = new Set<string>()
  for (const s of SPOTS) {
    if (s.country === country) regions.add(s.region)
  }
  return [...regions].sort((a, b) => a.localeCompare(b))
}
