// Spatial index for the map's nearest-neighbour conditions fallback.
//
// When Open-Meteo times out for a spot, the map borrows conditions from the
// closest spot that has data. A naive scan is O(spotsNeedingData × spotsWithData)
// — up to ~2M distance computations on the request thread when the upstream API
// degrades. Bucketing spots into 1° cells (~111 km) and searching expanding
// rings bounds the work to nearby cells, and spots with no acceptable neighbour
// inside the search window stay "unknown" instead of copying conditions from a
// coastline hundreds of kilometres away.

interface LatLng {
  lat: number
  lng: number
}

const MAX_RINGS = 3

function cellKey(latCell: number, lngCell: number): string {
  return `${latCell}:${lngCell}`
}

// Wrap a longitude cell index across the antimeridian (lng cells span -180..179).
function wrapLngCell(cell: number): number {
  return ((cell + 540) % 360) - 180
}

const KM_PER_DEGREE_LAT = 111.32

/**
 * Approximate surface distance in kilometres (equirectangular projection).
 *
 * Raw `hypot(dLat, dLng)` in degrees was wrong in two ways that mattered: a
 * degree of longitude is not a degree of latitude away from the equator (2×
 * distortion in Alaska), and an unwrapped dLng ranked Fiji and Futuna 75× too
 * far apart across the antimeridian.
 */
export function distanceKm(
  aLat: number, aLng: number,
  bLat: number, bLng: number
): number {
  const dLatKm = (bLat - aLat) * KM_PER_DEGREE_LAT
  let dLng = bLng - aLng
  if (dLng > 180) dLng -= 360
  else if (dLng < -180) dLng += 360
  const dLngKm = dLng * KM_PER_DEGREE_LAT * Math.cos(((aLat + bLat) / 2 * Math.PI) / 180)
  return Math.hypot(dLatKm, dLngKm)
}

export interface SpatialIndex<T extends LatLng> {
  cells: Map<string, T[]>
}

export function buildSpatialIndex<T extends LatLng>(spots: T[]): SpatialIndex<T> {
  const cells = new Map<string, T[]>()
  for (const spot of spots) {
    const key = cellKey(Math.floor(spot.lat), Math.floor(spot.lng))
    const bucket = cells.get(key)
    if (bucket) bucket.push(spot)
    else cells.set(key, [spot])
  }
  return { cells }
}

function collectRing<T extends LatLng>(
  index: SpatialIndex<T>,
  latCell: number,
  lngCell: number,
  ring: number,
  out: T[]
): void {
  for (let dLat = -ring; dLat <= ring; dLat++) {
    for (let dLng = -ring; dLng <= ring; dLng++) {
      // Only the perimeter of the ring — inner cells were checked already.
      if (ring > 0 && Math.abs(dLat) !== ring && Math.abs(dLng) !== ring) continue
      const bucket = index.cells.get(cellKey(latCell + dLat, wrapLngCell(lngCell + dLng)))
      if (bucket) out.push(...bucket)
    }
  }
}

export interface NearestOptions<T> {
  /** Reject a neighbour further than this. Borrowing across 100+ km (or across
   *  a basin: Gulf of Thailand ← Andaman Sea) invents conditions rather than
   *  approximating them; "unknown" is the honest answer. */
  maxDistanceKm?: number
  /** Reject a neighbour that isn't a plausible stand-in — e.g. one whose
   *  coastline faces a different way, which is the cheap proxy for "is exposed
   *  to the same swell". */
  accept?: (candidate: T) => boolean
}

export function findNearestInIndex<T extends LatLng>(
  index: SpatialIndex<T>,
  lat: number,
  lng: number,
  options: NearestOptions<T> = {}
): T | null {
  const { maxDistanceKm = Infinity, accept } = options
  const latCell = Math.floor(lat)
  const lngCell = Math.floor(lng)

  // Scan the whole (2·MAX_RINGS+1)² cell block and take the global minimum
  // rather than returning from the first populated ring: a query point near a
  // cell edge can have its true nearest neighbour a ring further out, and with
  // an `accept` filter the first populated ring may contain no usable
  // candidate at all.
  const candidates: T[] = []
  for (let ring = 0; ring <= MAX_RINGS; ring++) {
    collectRing(index, latCell, lngCell, ring, candidates)
  }

  let closest: T | null = null
  let minDist = Infinity
  for (const c of candidates) {
    if (accept && !accept(c)) continue
    const d = distanceKm(lat, lng, c.lat, c.lng)
    if (d <= maxDistanceKm && d < minDist) {
      minDist = d
      closest = c
    }
  }
  return closest
}
