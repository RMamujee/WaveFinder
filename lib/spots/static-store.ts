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

function isWordChar(ch: string | undefined): boolean {
  return ch != null && /[a-z0-9]/.test(ch)
}

/**
 * Case-insensitive region match on WORD boundaries.
 *
 * A raw substring `contains` made "Ventura" match "Fuerteventura", so Canary
 * Islands spots were returned for the California region and scored against
 * Californian swell — inside the Pro-gated best-spots feature. Multi-word
 * keywords ("Orange" → "Orange County", "North Shore") still match; the only
 * thing rejected is a match that starts or ends mid-word.
 */
export function regionMatchesKeyword(region: string, keyword: string): boolean {
  const haystack = region.toLowerCase()
  const needle = keyword.toLowerCase().trim()
  if (!needle) return false

  for (let from = 0; from <= haystack.length - needle.length; ) {
    const at = haystack.indexOf(needle, from)
    if (at === -1) return false
    const before = at > 0 ? haystack[at - 1] : undefined
    const after = haystack[at + needle.length]
    if (!isWordChar(before) && !isWordChar(after)) return true
    from = at + 1
  }
  return false
}

// Region lookups for app/api/best-spots/route.ts and the nearby-spots list on
// the spot page.
export function spotsInRegion(keyword: string): SurfSpot[] {
  return SPOTS.filter((s) => regionMatchesKeyword(s.region, keyword))
}

// ── Current-conditions coordinate buckets ────────────────────────────────────
//
// The map resolves conditions per coordinate bucket, not per spot. The bucket
// was 0.1° (~11 km), which served 29% of spots another spot's swell — while
// Open-Meteo's marine grid is ~0.04°, so the resolution was being discarded
// rather than unavailable. 0.05° (~5.5 km) keeps the round-trip count sane and
// stops the worst borrows.
export const CONDITIONS_BUCKET_DEG = 0.05

export function conditionsBucketKey(lat: number, lng: number): string {
  return `${Math.round(lat / CONDITIONS_BUCKET_DEG)},${Math.round(lng / CONDITIONS_BUCKET_DEG)}`
}

// The coordinate actually sent upstream for a bucket, resolved against the FULL
// dataset. Picking the first spot of the *filtered* list made the query point —
// and therefore the cache key and the conditions themselves — depend on the
// caller's filters: 229 spots changed source coordinates under a difficulty
// filter alone. Using the bucket's geometric centre instead would be filter-
// stable too, but it can land on land and return no marine data; a real spot's
// coordinates cannot.
const BUCKET_REPRESENTATIVE: ReadonlyMap<string, { lat: number; lng: number }> = (() => {
  const map = new Map<string, { lat: number; lng: number }>()
  for (const s of SPOTS) {
    const key = conditionsBucketKey(s.lat, s.lng)
    if (!map.has(key)) map.set(key, { lat: s.lat, lng: s.lng })
  }
  return map
})()

export function conditionsBucketPoint(lat: number, lng: number): { lat: number; lng: number } {
  return BUCKET_REPRESENTATIVE.get(conditionsBucketKey(lat, lng)) ?? { lat, lng }
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
