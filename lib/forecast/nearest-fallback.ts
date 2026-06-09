// Spatial index for the map's nearest-neighbour conditions fallback.
//
// When Open-Meteo times out for a spot, the map borrows conditions from the
// closest spot that has data. A naive scan is O(spotsNeedingData × spotsWithData)
// — up to ~2M distance computations on the request thread when the upstream API
// degrades. Bucketing spots into 1° cells (~111 km) and searching expanding
// rings bounds the work to nearby cells, and spots with no data within
// MAX_RINGS cells stay "unknown" instead of copying conditions from a coastline
// hundreds of kilometres away.

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

export function findNearestInIndex<T extends LatLng>(
  index: SpatialIndex<T>,
  lat: number,
  lng: number
): T | null {
  const latCell = Math.floor(lat)
  const lngCell = Math.floor(lng)

  for (let ring = 0; ring <= MAX_RINGS; ring++) {
    const candidates: T[] = []
    collectRing(index, latCell, lngCell, ring, candidates)
    if (candidates.length === 0) continue

    // A query point near a cell edge can have its true nearest neighbour one
    // ring further out than the first populated ring (e.g. lat 33.99 vs a spot
    // at 34.01), so widen by one ring before picking the minimum.
    collectRing(index, latCell, lngCell, ring + 1, candidates)

    let closest = candidates[0]
    let minDist = Infinity
    for (const c of candidates) {
      const d = Math.hypot(c.lat - lat, c.lng - lng)
      if (d < minDist) {
        minDist = d
        closest = c
      }
    }
    return closest
  }
  return null
}
