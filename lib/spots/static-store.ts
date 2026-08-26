import 'server-only'
import { SURF_SPOTS_SEED } from '@/lib/spots-data'
import { resolveSpotSlug } from './spot-aliases'
import { harmonicStationForSpot } from '@/lib/tides/stations'
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

const VALID_DIFFICULTIES = new Set(['beginner', 'intermediate', 'advanced', 'expert'])

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
    // Resolved from the generated table rather than stored in the seed files.
    // The mapping is a pure function of coordinates computed by a script, so
    // keeping it in one generated JSON avoids a 1,242-line diff across the 11
    // hand-authored spot files every time the station database is refreshed —
    // and keeps the estuary-guard result and the mapping in the same artifact.
    harmonicTideStationId: harmonicStationForSpot(s.slug),
    noaaBuoyId: s.noaaBuoyId ?? null,
    webcamUrl: s.webcamUrl ?? null,
    webcamType: s.webcamType ?? null,
    parkingOptions: ('parkingOptions' in s ? (s.parkingOptions as SurfSpot['parkingOptions']) : null) ?? null,
    // Read from the seed, not re-derived from prose on every request: the regex
    // ran against marketing copy, so an editorial tweak silently re-rated the
    // spot. scripts/backfill-bottom-type.ts writes the field.
    bottomType: s.bottomType,
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

// Retired duplicate slugs resolve to the record that replaced them, so a
// bookmark or a saved-spots entry pointing at a removed duplicate still lands
// on the right break instead of 404ing.
export function getSpotBySlug(slug: string): SurfSpot | null {
  return SPOT_BY_SLUG.get(slug) ?? SPOT_BY_SLUG.get(resolveSpotSlug(slug)) ?? null
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
  // Resolve retired duplicate slugs so a saved-spots list built before the
  // dedupe still returns its spots rather than silently shrinking.
  const ids = filter.ids && filter.ids.length
    ? new Set(filter.ids.map(resolveSpotSlug))
    : null

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
 * Californian swell — inside the best-spots feature. Multi-word
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

// ── Coarse overview cells for wide viewports ─────────────────────────────────
//
// A zoomed-out map asks for more 0.05° buckets than one request may fan out to
// (the whole world is ~1,192 — see MAX_CONDITION_BUCKETS in
// app/api/spots/route.ts). Refusing such a request greys every pin the moment
// a visitor zooms out, which is the first thing most visitors do. Instead the
// route samples: it groups the spots into coarser cells, fetches one
// representative per cell, and scores every spot in the cell against that
// reading — flagged `approx` so the popup says so.
//
// Cells are NESTED. Level L groups fine-bucket indices by `>> L`, so a level-L
// cell is exactly 2×2 level-(L-1) cells, and its representative is chosen from
// its children's representatives (the child holding the most spots wins). That
// makes every coarser level's sample a SUBSET of the finer one's: zooming out
// through four levels re-reads buckets the cache already holds rather than
// fanning out afresh at each level — which at ~400 calls a level would blow
// the 600/min allowance in a single scroll of the wheel.
//
// Representatives are computed from the FULL dataset, like the fine buckets,
// so a cell's query point does not move with the caller's bbox or filters.
//
// Spot counts at each level for the whole dataset, for sizing:
//   L1 0.1° 1,055 · L2 0.2° 890 · L3 0.4° 714 · L4 0.8° 527 · L5 1.6° 376 ·
//   L6 3.2° 260 · L7 6.4° 162 · L8 12.8° 87
export const OVERVIEW_MAX_LEVEL = 8

export function overviewCellKey(lat: number, lng: number, level: number): string {
  const i = Math.round(lat / CONDITIONS_BUCKET_DEG)
  const j = Math.round(lng / CONDITIONS_BUCKET_DEG)
  // Arithmetic shift floors toward -∞ for negatives, so cells tile the globe
  // without a doubled-up cell either side of the equator or the meridian.
  return `${i >> level},${j >> level}`
}

interface CellNode { rep: { lat: number; lng: number }; spots: number }

const OVERVIEW_REPRESENTATIVE: ReadonlyArray<ReadonlyMap<string, CellNode>> = (() => {
  const levels: Map<string, CellNode>[] = []
  const fine = new Map<string, CellNode>()
  for (const s of SPOTS) {
    const key = conditionsBucketKey(s.lat, s.lng)
    const node = fine.get(key)
    if (node) node.spots++
    else fine.set(key, { rep: BUCKET_REPRESENTATIVE.get(key) ?? { lat: s.lat, lng: s.lng }, spots: 1 })
  }
  levels.push(fine)
  for (let level = 1; level <= OVERVIEW_MAX_LEVEL; level++) {
    const prev = levels[level - 1]
    const next = new Map<string, CellNode>()
    // Children are visited in insertion (dataset) order, so a tie on spot count
    // resolves to the earlier child — deterministic across processes.
    for (const child of prev.values()) {
      const key = overviewCellKey(child.rep.lat, child.rep.lng, level)
      const node = next.get(key)
      if (!node) next.set(key, { rep: child.rep, spots: child.spots })
      else {
        if (child.spots > node.spots) node.rep = child.rep
        node.spots += child.spots
      }
    }
    levels.push(next)
  }
  return levels
})()

export interface OverviewPlan {
  level: number
  cellDeg: number
  /** Distinct representative points to fetch, one per occupied cell. */
  points: { lat: number; lng: number }[]
  /** The representative point for a spot at (lat, lng). */
  pointFor(lat: number, lng: number): { lat: number; lng: number }
}

/**
 * The finest nested level at which `spots` occupy at most `maxCells` cells,
 * or null if even the coarsest level is over (it cannot be for this dataset —
 * the whole world fits in 87 cells at level 8 — but the caller still gets a
 * definite answer rather than an assumption).
 */
export function planConditionsOverview(
  spots: ReadonlyArray<{ lat: number; lng: number }>,
  maxCells: number
): OverviewPlan | null {
  for (let level = 1; level <= OVERVIEW_MAX_LEVEL; level++) {
    const cells = new Set<string>()
    for (const s of spots) cells.add(overviewCellKey(s.lat, s.lng, level))
    if (cells.size > maxCells) continue
    const reps = OVERVIEW_REPRESENTATIVE[level]
    const points: { lat: number; lng: number }[] = []
    for (const key of cells) {
      const node = reps.get(key)
      if (node) points.push(node.rep)
    }
    return {
      level,
      cellDeg: CONDITIONS_BUCKET_DEG * 2 ** level,
      points,
      pointFor: (lat, lng) => {
        const node = reps.get(overviewCellKey(lat, lng, level))
        return node ? node.rep : conditionsBucketPoint(lat, lng)
      },
    }
  }
  return null
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
