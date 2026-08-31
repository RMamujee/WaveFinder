import { getCache } from '@vercel/functions'
import { distanceKm } from '@/lib/forecast/nearest-fallback'
import type { CurrentMarineConditions } from './open-meteo'

// ── PacIOOS ERDDAP `ww3_global` — the world map's conditions source ──────────
//
// WaveWatch III, hosted by PacIOOS (University of Hawaii), served as plain JSON
// over griddap. No key, no registration, and — the entire point — NO
// PER-LOCATION BILLING. Open-Meteo bills a multi-location request per location,
// so a zoomed-out map cost ~2,400 calls against a 5,000/hour allowance; that is
// what forced the 200-bucket ceiling and the sampled overview in
// app/api/spots/route.ts. One griddap request returns a whole ocean basin.
//
// Researched and measured in
// docs/research/2026-08-22-open-meteo-accounting-and-gridded-sources.md §4.1.
// Read that before changing any constant here.
//
// Attribution: PacIOOS / NOAA. The licence permits free redistribution
// ("not intended for legal use", no warranty) and asks for acknowledgement —
// see app/privacy/page.tsx.

// The 0-359.5 axis of the base `ww3_global` dataset puts a seam through the
// prime meridian: a Europe box asking for [(340):(360)] returns HTTP 404
// ("Stop is greater than the axis maximum"). The `_lon180` alias is the same
// grid on a -180..180 axis, so EVERY box below is expressed in -180..180 and
// none of them has to straddle a seam. Verified live: identical variables,
// identical row shape.
const WW3_BASE = 'https://pae-paha.pacioos.hawaii.edu/erddap/griddap/ww3_global_lon180.json'

/** Grid spacing of the dataset, degrees (311 lat × 720 lon, -77.5..77.5). */
export const WW3_GRID_DEG = 0.5

/**
 * Variables pulled in ONE combined query per box.
 *
 * Bundling variables is far cheaper than extra requests: the same global grid
 * measured 743 KB with one variable and 942 KB with three, because the
 * time/depth/lat/lon columns dominate a griddap row. `Thgt/Tper/Tdir` are the
 * combined sea, `shgt/sper/sdir` the swell partition and `whgt/wper/wdir` the
 * wind-wave partition — that partition split is the reason this source works
 * for WaveFinder at all, because the rating engine scores the swell partition
 * and derives cleanliness from the wind-wave share.
 */
export const WW3_VARIABLES = [
  'Thgt', 'Tper', 'Tdir', 'shgt', 'sper', 'sdir', 'whgt', 'wper', 'wdir',
] as const

export interface WW3Box {
  id: string
  latMin: number
  latMax: number
  lonMin: number
  lonMax: number
}

/**
 * Regional boxes covering every spot in the dataset at FULL resolution.
 *
 * NEVER replace these with one global request: the full-resolution global grid
 * is 11.3 MB and took over 120 s in testing — it does not fit in a function
 * invocation. These were derived from the 1,192 conditions buckets by buffering
 * each by 1.5° (three grid cells, above the 1.28° worst-case spot-to-ocean-cell
 * distance measured in the research doc) and greedily merging the buffered
 * tiles under a 10,000-cell-per-box cap. Total ~79,000 cells.
 *
 * `tests/ww3-overview.test.ts` fails if any spot falls outside them, which is
 * what makes adding a spot in a new part of the world safe.
 */
export const WW3_BOXES: readonly WW3Box[] = [
  { id: 'hawaii-w-north-america', latMin:  16.5, latMax:  63.5, lonMin: -161.5, lonMax: -110.5 },
  { id: 'middle-e-north-america', latMin:   8.5, latMax:  49.5, lonMin: -113.5, lonMax:  -56.5 },
  { id: 'e-pacific-tropics',      latMin: -15.5, latMax:  13.5, lonMin:  -93.5, lonMax:  -74.5 },
  { id: 's-america',              latMin: -43.5, latMax:  -0.5, lonMin:  -75.5, lonMax:  -30.5 },
  { id: 's-pacific-islands',      latMin: -29.5, latMax: -10.5, lonMin: -180.0, lonMax: -106.5 },
  { id: 'europe-w-africa',        latMin:   0.5, latMax:  61.5, lonMin:  -27.5, lonMax:   11.5 },
  { id: 'africa-south-indian',    latMin: -37.5, latMax:  -0.5, lonMin:   10.5, lonMax:   59.5 },
  { id: 'n-indian-ocean',         latMin:  -9.5, latMax:  27.5, lonMin:   50.5, lonMax:  113.5 },
  { id: 'indonesia-w-australia',  latMin: -35.5, latMax:  -6.5, lonMin:  108.5, lonMax:  125.5 },
  { id: 'e-asia',                 latMin:   4.5, latMax:  41.5, lonMin:  116.5, lonMax:  143.5 },
  { id: 'w-pacific-islands',      latMin: -11.5, latMax:  17.5, lonMin:  132.5, lonMax:  165.5 },
  { id: 'e-australia-nz',         latMin: -47.5, latMax: -12.5, lonMin:  130.5, lonMax:  180.0 },
]

/**
 * How far a conditions bucket may be snapped to a grid cell that carries data.
 *
 * The grid is 0.5° and land cells are null, so a coastal spot is typically
 * snapped ~27 km offshore (median measured over 99 real spots; p90 39 km, max
 * 143 km). That is a legitimate input here because the rating engine already
 * treats the swell partition as DEEP WATER and shoals it itself. Past this
 * bound it stops being the same sea, so the bucket gets no reading and the
 * route's nearest-neighbour fallback decides.
 */
export const WW3_MAX_SNAP_KM = 165

// ── griddap request ─────────────────────────────────────────────────────────

/**
 * The dataset hour to request. griddap resolves a `(value)` time constraint to
 * the nearest index, but it rejects anything it cannot parse — `[(now)]` is a
 * *tabledap* convenience and returns
 * `Start=NaN (invalid format?) isn't allowed` here (verified live), so the hour
 * has to be formatted explicitly.
 */
export function ww3TimeParam(at: Date = new Date()): string {
  const iso = new Date(Math.floor(at.getTime() / 3_600_000) * 3_600_000).toISOString()
  return `${iso.slice(0, 13)}:00:00Z`
}

/** One combined-variable griddap request for a box at a single hour. */
export function buildGriddapUrl(box: WW3Box, time: string): string {
  // depth has a single index (0). Brackets are percent-encoded because they are
  // not valid in a query string unescaped; ERDDAP accepts either form, and
  // encoding keeps the URL legal for `fetch` and for logs.
  const range = `[(${time})][0][(${box.latMin}):(${box.latMax})][(${box.lonMin}):(${box.lonMax})]`
  const query = WW3_VARIABLES.map((v) => `${v}${range}`).join(',')
  return `${WW3_BASE}?${encodeURI(query)}`
}

/** A grid cell that reported a combined wave height (i.e. not land). */
export interface WW3Cell {
  lat: number
  lng: number
  waveHeight: number
  wavePeriod: number | null
  swellHeight: number | null
  swellPeriod: number | null
  swellDirection: number | null
  windWaveHeight: number | null
  windWavePeriod: number | null
}

export interface WW3Grid {
  /** The dataset hour every row carries, ISO 8601 UTC. */
  time: string | null
  cells: WW3Cell[]
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/**
 * Parse a griddap `.json` response into ocean cells.
 *
 * Kept pure and column-name driven rather than positional: PacIOOS is
 * unreachable from some networks (the same reason `parseCurrentConditions`
 * exists), so the logic has to be testable against a fixture, and a griddap
 * response carries `columnTypes`/`columnUnits` that the research doc's
 * abbreviated example omits.
 *
 * Land cells arrive as `null` IN PLACE — correctly indexed — and are dropped.
 * A row may also be partially null: an ocean cell with no wind-wave partition
 * reports `whgt/wper/wdir` as null while the swell columns are populated. Those
 * nulls are PRESERVED (never coerced to 0), because the rating engine drops the
 * cleanliness factor and renormalises when the wind-wave partition is missing,
 * whereas a 0 reads as a measured, perfectly clean sea.
 */
export function parseGriddapGrid(payload: unknown): WW3Grid {
  const table = (payload as { table?: { columnNames?: unknown; rows?: unknown } } | null)?.table
  const names = Array.isArray(table?.columnNames) ? (table.columnNames as unknown[]) : []
  const rows = Array.isArray(table?.rows) ? (table.rows as unknown[]) : []
  if (names.length === 0 || rows.length === 0) return { time: null, cells: [] }

  const col = (name: string) => names.indexOf(name)
  const iTime = col('time')
  const iLat = col('latitude')
  const iLon = col('longitude')
  const iThgt = col('Thgt')
  if (iLat < 0 || iLon < 0 || iThgt < 0) return { time: null, cells: [] }
  const iTper = col('Tper')
  const iShgt = col('shgt')
  const iSper = col('sper')
  const iSdir = col('sdir')
  const iWhgt = col('whgt')
  const iWper = col('wper')

  const at = (row: unknown[], i: number) => (i >= 0 ? numOrNull(row[i]) : null)

  let time: string | null = null
  const cells: WW3Cell[] = []
  for (const raw of rows) {
    if (!Array.isArray(raw)) continue
    const row = raw as unknown[]
    const waveHeight = at(row, iThgt)
    const lat = at(row, iLat)
    const lng = at(row, iLon)
    // No combined wave height is the land/no-data signal for the whole cell.
    if (waveHeight == null || lat == null || lng == null) continue
    if (time == null && iTime >= 0 && typeof row[iTime] === 'string') time = row[iTime] as string
    cells.push({
      lat,
      lng,
      waveHeight,
      wavePeriod: at(row, iTper),
      swellHeight: at(row, iShgt),
      swellPeriod: at(row, iSper),
      swellDirection: at(row, iSdir),
      windWaveHeight: at(row, iWhgt),
      windWavePeriod: at(row, iWper),
    })
  }
  return { time, cells }
}

// ── nearest valid cell ──────────────────────────────────────────────────────

export type WW3Index = Map<string, WW3Cell>

function indexKey(lat: number, lng: number): string {
  return `${Math.round(lat / WW3_GRID_DEG)},${Math.round(lng / WW3_GRID_DEG)}`
}

export function buildGridIndex(cells: Iterable<WW3Cell>): WW3Index {
  const index: WW3Index = new Map()
  for (const cell of cells) index.set(indexKey(cell.lat, cell.lng), cell)
  return index
}

export interface WW3Snap {
  cell: WW3Cell
  distanceKm: number
}

/**
 * The closest cell WITH DATA to a coordinate, or null past `maxKm`.
 *
 * Searched as expanding rings on the grid lattice rather than by scanning every
 * cell: the snap runs once per conditions bucket (~1,192) against ~50,000
 * ocean cells, and the naive form is 60M distance computations inside a cron
 * invocation that is already spending most of its budget on the network.
 */
export function snapToNearestCell(
  index: WW3Index,
  lat: number,
  lng: number,
  maxKm: number = WW3_MAX_SNAP_KM
): WW3Snap | null {
  const centreLat = Math.round(lat / WW3_GRID_DEG)
  const centreLon = Math.round(lng / WW3_GRID_DEG)
  const stepKm = WW3_GRID_DEG * 111.32
  // The window is wider in cells than in degrees near the poles, because a
  // degree of longitude shrinks with the cosine of the latitude — a fixed
  // ±4-cell window would search only 100 km east-west in Alaska while claiming
  // to search 165.
  const latCells = Math.ceil(maxKm / stepKm)
  const lonCells = Math.ceil(maxKm / (stepKm * Math.max(Math.cos((lat * Math.PI) / 180), 0.15)))

  let best: WW3Snap | null = null
  for (let di = -latCells; di <= latCells; di++) {
    for (let dj = -lonCells; dj <= lonCells; dj++) {
      // Longitude wraps: a spot at 179.4°E must see cells at 179.5°W.
      const j = (((centreLon + dj + 360) % 720) + 720) % 720 - 360
      const cell = index.get(`${centreLat + di},${j}`)
      if (!cell) continue
      const d = distanceKm(lat, lng, cell.lat, cell.lng)
      if (d > maxKm) continue
      if (!best || d < best.distanceKm) best = { cell, distanceKm: d }
    }
  }
  return best
}

// ── stored overview blob ────────────────────────────────────────────────────

/**
 * One bucket's snapped reading, short-keyed.
 *
 * The blob holds an entry per 0.05° conditions bucket (~1,192), so the field
 * names are paid for 1,192 times over. Nulls are kept as nulls for the reason
 * spelled out on `parseGriddapGrid`.
 */
export interface WaveOverviewEntry {
  /** Combined significant wave height, m (never null — its absence is no cell). */
  h: number
  /** Combined sea mean period, s. */
  p: number | null
  /** Swell partition height (m), period (s), direction (deg). */
  sh: number | null
  sp: number | null
  sd: number | null
  /** Wind-wave partition height (m) and period (s). */
  wh: number | null
  wp: number | null
}

export interface WaveOverviewBlob {
  version: 1
  /** Cron run time, ms since epoch — what staleness is measured against. */
  generatedAt: number
  /** The WW3 forecast hour the readings describe, ISO 8601 UTC. */
  dataTime: string | null
  /** Boxes that answered, for diagnosing a partial run. */
  boxes: string[]
  /** Conditions-bucket key -> reading. */
  entries: Record<string, WaveOverviewEntry>
}

export const WAVE_OVERVIEW_CACHE_KEY = 'ww3:overview:v1'

/**
 * Runtime Cache TTL, deliberately far longer than the 6-hour cron interval:
 * a missed run must serve stale readings rather than nothing, because "nothing"
 * greys every pin on the map. `WW3_MAX_AGE_MS` is the shorter limit that
 * decides when a stale blob stops being trusted and the request falls back to
 * Open-Meteo sampling.
 */
export const WAVE_OVERVIEW_TTL_SECONDS = 24 * 3600

/** Two missed cron runs. Past this the blob is ignored, not served. */
export const WW3_MAX_AGE_MS = 12 * 3600 * 1000

/**
 * Below this share of the requested buckets the blob is treated as not usable
 * and the request falls back to Open-Meteo sampling wholesale. A partial cron
 * run (one box timed out) must not paint a third of the world grey.
 */
export const WW3_MIN_COVERAGE = 0.6

function runtimeCache(): ReturnType<typeof getCache> | null {
  try { return getCache() } catch { return null }
}

export async function readWaveOverview(): Promise<WaveOverviewBlob | null> {
  const cache = runtimeCache()
  if (!cache) return null
  try {
    const hit = await cache.get(WAVE_OVERVIEW_CACHE_KEY) as WaveOverviewBlob | null | undefined
    if (!hit || hit.version !== 1 || typeof hit.generatedAt !== 'number') return null
    if (!hit.entries || typeof hit.entries !== 'object') return null
    return hit
  } catch {
    return null
  }
}

export async function writeWaveOverview(blob: WaveOverviewBlob): Promise<boolean> {
  const cache = runtimeCache()
  if (!cache) return false
  try {
    await cache.set(WAVE_OVERVIEW_CACHE_KEY, blob, {
      ttl: WAVE_OVERVIEW_TTL_SECONDS,
      tags: ['ww3', 'conditions'],
    })
    return true
  } catch {
    return false
  }
}

const round = (v: number | null, dp: number): number | null =>
  v == null ? null : Math.round(v * 10 ** dp) / 10 ** dp

export function cellToOverviewEntry(cell: WW3Cell): WaveOverviewEntry {
  return {
    h: round(cell.waveHeight, 2)!,
    p: round(cell.wavePeriod, 1),
    sh: round(cell.swellHeight, 2),
    sp: round(cell.swellPeriod, 1),
    sd: cell.swellDirection == null ? null : Math.round(cell.swellDirection),
    wh: round(cell.windWaveHeight, 2),
    wp: round(cell.windWavePeriod, 1),
  }
}

/**
 * Map a WW3 partition set onto the shape the map's rating path already reads.
 *
 * WW3 CARRIES NO WIND, so `windSpeed`, `windDirection` and `windGust` are null
 * — not zero, and not the wind-wave direction dressed up as a wind. The rating
 * engine drops the wind factor and renormalises the remaining weights when the
 * speed is null (CLAUDE.md, "Preserve nulls end-to-end"); a 0 would be scored
 * as a real dead-glassy calm, i.e. the best wind there is, which is the exact
 * opposite of "we don't know".
 *
 * `waveHeight`/`swellHeight`/`swellPeriod` are non-nullable in
 * `CurrentMarineConditions` and 0 is that shape's own "absent partition"
 * sentinel — `powerOf` and `rateSurfConditions` in app/api/spots/route.ts both
 * branch on `> 0`, exactly as they already do for an Open-Meteo cell with no
 * swell partition (the Great Lakes). Only the genuinely nullable fields stay
 * null.
 *
 * There is no second swell train: WW3 partitions the sea into one swell and one
 * wind-wave component, so `secondarySwell*` is null and the engine scores the
 * single train.
 */
export function overviewEntryToConditions(entry: WaveOverviewEntry): CurrentMarineConditions {
  return {
    waveHeight: entry.h,
    wavePeriod: entry.p ?? 0,
    swellHeight: entry.sh ?? 0,
    swellPeriod: entry.sp ?? 0,
    swellDirection: entry.sd,
    secondarySwellHeight: null,
    secondarySwellPeriod: null,
    secondarySwellDirection: null,
    windWaveHeight: entry.wh,
    windWavePeriod: entry.wp,
    windSpeed: null,
    windDirection: null,
    windGust: null,
  }
}

export interface WaveOverviewLookup {
  /** Readings in the order of the keys passed in; null where the blob has none. */
  readings: (CurrentMarineConditions | null)[]
  /** Share of the requested keys the blob answered, 0..1. */
  coverage: number
}

/**
 * Resolve conditions-bucket keys against a blob, or null when the blob is
 * missing, too old, or too sparse to colour the map with.
 */
export function lookupWaveOverview(
  blob: WaveOverviewBlob | null,
  keys: string[],
  now: number = Date.now()
): WaveOverviewLookup | null {
  if (!blob || keys.length === 0) return null
  if (now - blob.generatedAt > WW3_MAX_AGE_MS) return null
  let hits = 0
  const readings = keys.map((key) => {
    const entry = blob.entries[key]
    if (!entry) return null
    hits++
    return overviewEntryToConditions(entry)
  })
  const coverage = hits / keys.length
  if (coverage < WW3_MIN_COVERAGE) return null
  return { readings, coverage }
}
