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

/** Native grid spacing of the dataset, degrees (311 lat × 720 lon, -77.5..77.5). */
export const WW3_GRID_DEG = 0.5

/**
 * Variables pulled in ONE combined query per box — exactly the seven the map's
 * rating path consumes, and no more.
 *
 * `Thgt/Tper` are the combined sea (the height the popup shows and the period
 * used when a cell has no swell partition at all), `shgt/sper/sdir` the swell
 * partition and `whgt/wper` the wind-wave partition. That partition split is
 * the reason this source works for WaveFinder at all: the rating engine scores
 * the swell partition and derives cleanliness from the wind-wave share.
 *
 * `Tdir` and `wdir` are deliberately NOT requested. Nothing downstream reads
 * them — swell direction comes from `sdir`, and `wdir` is a wind-*wave*
 * direction that must never be passed off as a wind direction. At ~7 B per
 * variable per row they were 13% of a payload that now carries eight forecast
 * hours, so dropping them is worth roughly 18 s of the fetch budget.
 */
export const WW3_VARIABLES = [
  'Thgt', 'Tper', 'shgt', 'sper', 'sdir', 'whgt', 'wper',
] as const

/**
 * Subsampling of the native 0.5° grid, in grid indices.
 *
 * FOUR (2° cells) IS A BUDGET DECISION, NOT A PREFERENCE, and it is the single
 * biggest quality trade in this file. Hobby crons run at most once a day, so
 * the blob has to carry a day's worth of forecast hours rather than one
 * snapshot — and cost is (cells × timesteps). At the measured ~51 KB/s and
 * ~4 s fixed cost per griddap request, the twelve boxes cost, for eight
 * timesteps: 0.5° = 1,230 s, 1° = 350 s, 1.5° = 183 s, 2° = 124 s. Only the
 * last fits the budget with headroom under `maxDuration`.
 *
 * What it costs: distance from a conditions bucket to the nearest lattice
 * point goes from a median of 20.2 km (p90 29.0) at 0.5° to 80.0 km (p90
 * 114.6) at 2°, and the nearest point that actually carries data is further
 * still. These pins are already labelled "Regional estimate" and the overview
 * groups them into cells 0.1°-12.8° wide, so a ~100 km sample is inside the
 * error the sampling already admits to — but it is NOT good enough for a spot
 * page, which is why this source is confined to the overview path.
 */
export const WW3_SPATIAL_STRIDE = 4

/**
 * Forecast hours per box request: eight steps four hours apart, covering
 * now .. now+28 h.
 *
 * A single snapshot was wrong the moment the cron went daily: an evening
 * visitor would be shown the morning's sea as "current". The window has to
 * outlast the gap between runs, and Hobby cron timing is imprecise — it fires
 * within about an hour of the schedule — so two consecutive runs can be ~25 h
 * apart. 28 h covers that with margin.
 *
 * Four-hourly rather than six: the read path refuses a blob whose nearest
 * timestep is more than `WW3_MAX_TIMESTEP_GAP_MS` (3 h) away, and 6 h spacing
 * puts the worst case exactly on that line. 4 h spacing keeps it at 2 h.
 */
export const WW3_TIME_STRIDE_HOURS = 4
export const WW3_TIME_STEPS = 8

export interface WW3Box {
  id: string
  latMin: number
  latMax: number
  lonMin: number
  lonMax: number
}

/**
 * Regional boxes covering every spot in the dataset.
 *
 * NEVER replace these with one global request: the full-resolution global grid
 * is 11.3 MB and took over 120 s in testing. These were derived from the 1,192
 * conditions buckets by buffering each by 1.5° and greedily merging the
 * buffered tiles under a 10,000-cell cap; at `WW3_SPATIAL_STRIDE` they come to
 * ~5,068 cells. Twelve is close to the cost optimum — fewer, larger boxes save
 * the ~4 s fixed cost per request but pay for it in empty ocean multiplied by
 * eight timesteps.
 *
 * EVERY `latMin`/`lonMin` MUST BE CONGRUENT TO 0.5 MODULO 2, and a test pins
 * it. griddap counts a stride from the box's own start index, so two boxes
 * whose origins sit on different parities sample two interleaved lattices —
 * `s-pacific-islands` originally started at -180.0 and sampled -180, -178, …
 * while its neighbours sampled -177.5, -175.5, …, and `gridCellKey` rounds
 * both -178 and -177.5 to the same key. That silently overwrites one cell's
 * readings with another cell's, 0.5° away, with nothing to show for it.
 *
 * `tests/ww3-overview.test.ts` fails if any spot falls outside them, which is
 * what makes adding a spot in a new part of the world safe.
 */
export const WW3_BOXES: readonly WW3Box[] = [
  { id: 'hawaii-w-north-america', latMin:  16.5, latMax:  63.5, lonMin: -161.5, lonMax: -110.5 },
  { id: 'middle-e-north-america', latMin:   8.5, latMax:  49.5, lonMin: -113.5, lonMax:  -56.5 },
  { id: 'e-pacific-tropics',      latMin: -15.5, latMax:  13.5, lonMin:  -93.5, lonMax:  -74.5 },
  { id: 's-america',              latMin: -43.5, latMax:  -0.5, lonMin:  -75.5, lonMax:  -30.5 },
  { id: 's-pacific-islands',      latMin: -29.5, latMax: -10.5, lonMin: -179.5, lonMax: -106.5 },
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
 * Scaled to the SUBSAMPLED grid, not the native one. At 0.5° a coastal spot
 * snapped ~27 km offshore (median over 99 measured spots, max 143 km) and
 * 165 km was a generous ceiling; at `WW3_SPATIAL_STRIDE` = 4 the lattice alone
 * is a median of 80 km away (p90 115 km, max 147 km) before land is taken into
 * account, so the same ceiling would silently drop the buckets furthest from
 * open water. 250 km is roughly one and a half subsampled cells.
 *
 * It is still a ceiling and not a suggestion: past it the bucket gets no
 * reading and the route's nearest-neighbour fallback decides, because a borrow
 * from further than that stops being the same sea.
 */
export const WW3_MAX_SNAP_KM = 250

// ── griddap request ─────────────────────────────────────────────────────────

export interface WW3TimeRange {
  /** First forecast hour, ISO 8601 UTC. */
  start: string
  /** Last forecast hour, ISO 8601 UTC. */
  end: string
}

/**
 * The forecast window to request, floored to the hour.
 *
 * griddap resolves a `(value)` time constraint to the nearest index, but it
 * rejects anything it cannot parse — `[(now)]` is a *tabledap* convenience and
 * returns `Start=NaN (invalid format?) isn't allowed` here (verified live), so
 * the hours have to be formatted explicitly.
 */
export function ww3TimeRange(at: Date = new Date()): WW3TimeRange {
  const hour = Math.floor(at.getTime() / 3_600_000) * 3_600_000
  const fmt = (ms: number) => `${new Date(ms).toISOString().slice(0, 13)}:00:00Z`
  return {
    start: fmt(hour),
    end: fmt(hour + (WW3_TIME_STEPS - 1) * WW3_TIME_STRIDE_HOURS * 3_600_000),
  }
}

/**
 * One combined-variable griddap request for a box across the forecast window.
 *
 * Strides are in GRID INDICES on each axis. The time axis is hourly, so a time
 * stride of 4 is four hours; the space axes are 0.5°, so a spatial stride of 4
 * is 2°.
 */
export function buildGriddapUrl(box: WW3Box, range: WW3TimeRange): string {
  // depth has a single index (0).
  const s = WW3_SPATIAL_STRIDE
  const dims =
    `[(${range.start}):${WW3_TIME_STRIDE_HOURS}:(${range.end})]` +
    `[0]` +
    `[(${box.latMin}):${s}:(${box.latMax})]` +
    `[(${box.lonMin}):${s}:(${box.lonMax})]`
  const query = WW3_VARIABLES.map((v) => `${v}${dims}`).join(',')
  // Brackets are not legal unescaped in a query string; ERDDAP accepts either
  // form, and encoding keeps the URL valid for `fetch` and readable in logs.
  return `${WW3_BASE}?${encodeURI(query)}`
}

/** A grid cell, at one forecast hour, that reported a wave height (not land). */
export interface WW3Cell {
  /** The forecast hour this reading describes, ISO 8601 UTC. */
  time: string
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
  /** Distinct forecast hours present, in the order the response listed them. */
  times: string[]
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
 * Rows arrive fully flattened — every row repeats time, depth, latitude and
 * longitude — so a multi-hour request returns one row per cell per hour.
 *
 * Land cells arrive as `null` IN PLACE, correctly indexed, and are dropped. A
 * row may also be partially null: an ocean cell with no wind-wave partition
 * reports `whgt/wper` as null while the swell columns are populated. Those
 * nulls are PRESERVED (never coerced to 0), because the rating engine drops the
 * cleanliness factor and renormalises when the wind-wave partition is missing,
 * whereas a 0 reads as a measured, perfectly clean sea.
 */
export function parseGriddapGrid(payload: unknown): WW3Grid {
  const table = (payload as { table?: { columnNames?: unknown; rows?: unknown } } | null)?.table
  const names = Array.isArray(table?.columnNames) ? (table.columnNames as unknown[]) : []
  const rows = Array.isArray(table?.rows) ? (table.rows as unknown[]) : []
  if (names.length === 0 || rows.length === 0) return { times: [], cells: [] }

  const col = (name: string) => names.indexOf(name)
  const iTime = col('time')
  const iLat = col('latitude')
  const iLon = col('longitude')
  const iThgt = col('Thgt')
  if (iLat < 0 || iLon < 0 || iThgt < 0) return { times: [], cells: [] }
  const iTper = col('Tper')
  const iShgt = col('shgt')
  const iSper = col('sper')
  const iSdir = col('sdir')
  const iWhgt = col('whgt')
  const iWper = col('wper')

  const at = (row: unknown[], i: number) => (i >= 0 ? numOrNull(row[i]) : null)

  const times: string[] = []
  const seenTimes = new Set<string>()
  const cells: WW3Cell[] = []
  for (const raw of rows) {
    if (!Array.isArray(raw)) continue
    const row = raw as unknown[]
    const time = iTime >= 0 && typeof row[iTime] === 'string' ? (row[iTime] as string) : null
    // A time column is not optional here: without it the readings cannot be
    // placed on the clock, and serving an unplaceable hour as "now" is the
    // exact failure a time-indexed blob exists to prevent.
    if (!time) continue
    if (!seenTimes.has(time)) { seenTimes.add(time); times.push(time) }
    const waveHeight = at(row, iThgt)
    const lat = at(row, iLat)
    const lng = at(row, iLon)
    // No combined wave height is the land/no-data signal for the whole cell.
    if (waveHeight == null || lat == null || lng == null) continue
    cells.push({
      time,
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
  return { times, cells }
}

// ── nearest valid cell ──────────────────────────────────────────────────────

export type WW3Index = Map<string, WW3Cell>

/** Lattice key for a cell coordinate. Uses the SUBSAMPLED spacing. */
export function gridCellKey(lat: number, lng: number): string {
  const step = WW3_GRID_DEG * WW3_SPATIAL_STRIDE
  return `${Math.round(lat / step)},${Math.round(lng / step)}`
}

export function buildGridIndex(cells: Iterable<WW3Cell>): WW3Index {
  const index: WW3Index = new Map()
  for (const cell of cells) index.set(gridCellKey(cell.lat, cell.lng), cell)
  return index
}

export interface WW3Snap {
  cell: WW3Cell
  distanceKm: number
}

/**
 * The closest cell WITH DATA to a coordinate, or null past `maxKm`.
 *
 * Searched as a bounded window on the grid lattice rather than by scanning
 * every cell: the snap runs once per conditions bucket (~1,192) against every
 * ocean cell in the world, and the naive form is millions of distance
 * computations inside a cron invocation that is already spending most of its
 * budget on the network.
 */
export function snapToNearestCell(
  index: WW3Index,
  lat: number,
  lng: number,
  maxKm: number = WW3_MAX_SNAP_KM
): WW3Snap | null {
  const step = WW3_GRID_DEG * WW3_SPATIAL_STRIDE
  const centreLat = Math.round(lat / step)
  const centreLon = Math.round(lng / step)
  const stepKm = step * 111.32
  // The window is wider in cells than in degrees near the poles, because a
  // degree of longitude shrinks with the cosine of the latitude — a fixed
  // window would search half as far east-west in Alaska as it claims to.
  const latCells = Math.ceil(maxKm / stepKm)
  const lonCells = Math.ceil(maxKm / (stepKm * Math.max(Math.cos((lat * Math.PI) / 180), 0.15)))
  // Lattice columns wrap: a spot at 179.4°E must see cells west of the
  // antimeridian. 360 / step columns cover the globe.
  const columns = Math.round(360 / step)

  let best: WW3Snap | null = null
  for (let di = -latCells; di <= latCells; di++) {
    for (let dj = -lonCells; dj <= lonCells; dj++) {
      const half = columns / 2
      const j = (((centreLon + dj + half) % columns) + columns) % columns - half
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
 * One bucket's reading at one forecast hour.
 *
 * A TUPLE, not an object, because the blob holds one of these per conditions
 * bucket per timestep — 1,192 × 8 ≈ 9,500 of them — and repeating seven field
 * names that many times roughly doubles the stored size for no benefit. Order
 * is fixed and is the only thing a reader needs; use `overviewEntryToConditions`
 * rather than indexing it by hand.
 *
 * [0] combined significant wave height, m (never null — its absence is no cell)
 * [1] combined sea mean period, s
 * [2] swell height, m   [3] swell period, s   [4] swell direction, deg
 * [5] wind-wave height, m   [6] wind-wave period, s
 */
export type WaveOverviewEntry = [
  number,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
]

export interface WaveOverviewBlob {
  version: 2
  /** Cron run time, ms since epoch. Diagnostic only — see the note on validity. */
  generatedAt: number
  /** The forecast hours the readings describe, ms since epoch, ascending. */
  times: number[]
  /** Boxes that answered, for diagnosing a partial run. */
  boxes: string[]
  /**
   * Conditions-bucket key -> one reading per entry in `times`, index-aligned.
   * A null element is an hour that box did not return.
   */
  entries: Record<string, (WaveOverviewEntry | null)[]>
}

// v2 = time-indexed. A v1 blob is a single snapshot with no `times` array and
// would be served as "current" forever; the version gate makes an old entry
// left in the cache across a deploy fall back rather than mislead.
export const WAVE_OVERVIEW_CACHE_KEY = 'ww3:overview:v2'

/**
 * Runtime Cache TTL, deliberately far longer than the daily cron interval:
 * a missed run must serve the tail of the previous forecast rather than
 * nothing, because "nothing" greys every pin on the map.
 */
export const WAVE_OVERVIEW_TTL_SECONDS = 48 * 3600

/**
 * How far the nearest stored forecast hour may be from the reader's clock.
 *
 * THIS, NOT THE BLOB'S AGE, IS THE VALIDITY TEST. A blob fetched 20 hours ago
 * is perfectly good if it still holds an hour near now, and a blob fetched two
 * days ago is useless however recently it was written — its last timestep is
 * long past, no hour is within this window, and the request falls back to
 * Open-Meteo sampling. `generatedAt` is kept for telemetry only.
 */
export const WW3_MAX_TIMESTEP_GAP_MS = 3 * 3600 * 1000

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
    if (!hit || hit.version !== 2) return null
    if (!Array.isArray(hit.times) || hit.times.length === 0) return null
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
  return [
    round(cell.waveHeight, 2)!,
    round(cell.wavePeriod, 1),
    round(cell.swellHeight, 2),
    round(cell.swellPeriod, 1),
    cell.swellDirection == null ? null : Math.round(cell.swellDirection),
    round(cell.windWaveHeight, 2),
    round(cell.windWavePeriod, 1),
  ]
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
  const [h, p, sh, sp, sd, wh, wp] = entry
  return {
    waveHeight: h,
    wavePeriod: p ?? 0,
    swellHeight: sh ?? 0,
    swellPeriod: sp ?? 0,
    swellDirection: sd,
    secondarySwellHeight: null,
    secondarySwellPeriod: null,
    secondarySwellDirection: null,
    windWaveHeight: wh,
    windWavePeriod: wp,
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
  /** The forecast hour served, ms since epoch. */
  timestep: number
  /** How far that hour is from `now`, ms. */
  gapMs: number
}

/**
 * Resolve conditions-bucket keys against a blob at the forecast hour nearest
 * to `now`, or null when the blob is missing, out of date, or too sparse to
 * colour the map with.
 */
export function lookupWaveOverview(
  blob: WaveOverviewBlob | null,
  keys: string[],
  now: number = Date.now()
): WaveOverviewLookup | null {
  if (!blob || keys.length === 0) return null
  if (!Array.isArray(blob.times) || blob.times.length === 0) return null

  let index = -1
  let gapMs = Infinity
  blob.times.forEach((t, i) => {
    const gap = Math.abs(t - now)
    if (gap < gapMs) { gapMs = gap; index = i }
  })
  // No stored hour is close enough to be called "current".
  if (index < 0 || gapMs > WW3_MAX_TIMESTEP_GAP_MS) return null

  let hits = 0
  const readings = keys.map((key) => {
    const entry = blob.entries[key]?.[index]
    if (!entry) return null
    hits++
    return overviewEntryToConditions(entry)
  })
  const coverage = hits / keys.length
  if (coverage < WW3_MIN_COVERAGE) return null
  return { readings, coverage, timestep: blob.times[index], gapMs }
}
