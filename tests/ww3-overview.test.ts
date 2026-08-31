import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CurrentMarineConditions, GeoPoint } from '@/lib/api/open-meteo'
import type { WaveOverviewBlob, WaveOverviewEntry } from '@/lib/api/ww3-overview'

// The route imports Prisma at module scope for the legacy-cuid bridge. Nothing
// here goes down that path.
vi.mock('@/lib/prisma', () => ({
  prisma: { surfSpot: { findMany: async () => [] } },
}))

// Only the cache read is stubbed — every pure function under test is the real
// one, because the parse/snap/mapping logic is the whole point of this file.
let stubBlob: WaveOverviewBlob | null = null
vi.mock('@/lib/api/ww3-overview', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/ww3-overview')>()
  return { ...actual, readWaveOverview: vi.fn(async () => stubBlob) }
})

const OM_CONDITIONS: CurrentMarineConditions = {
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
const batchCalls: GeoPoint[][] = []
vi.mock('@/lib/api/open-meteo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/open-meteo')>()
  return {
    ...actual,
    fetchCurrentConditionsBatch: vi.fn(async (points: GeoPoint[]) => {
      batchCalls.push(points)
      return points.map(() => OM_CONDITIONS)
    }),
  }
})

const {
  WW3_BOXES,
  WW3_GRID_DEG,
  WW3_MAX_SNAP_KM,
  WW3_MAX_TIMESTEP_GAP_MS,
  WW3_SPATIAL_STRIDE,
  WW3_TIME_STEPS,
  WW3_TIME_STRIDE_HOURS,
  WW3_VARIABLES,
  buildGridIndex,
  buildGriddapUrl,
  cellToGridTuple,
  cellToOverviewEntry,
  gridCellKey,
  lookupWaveGrid,
  lookupWaveOverview,
  overviewEntryToConditions,
  parseGriddapGrid,
  snapToNearestCell,
  ww3TimeRange,
} = await import('@/lib/api/ww3-overview')
const { CONDITIONS_BUCKETS, SPOTS } = await import('@/lib/spots/static-store')
const { GET } = await import('@/app/api/spots/route')
const { distanceKm } = await import('@/lib/forecast/nearest-fallback')

const HOUR = 3_600_000
const SUBSAMPLED_DEG = WW3_GRID_DEG * WW3_SPATIAL_STRIDE

// ── Fixture ─────────────────────────────────────────────────────────────────
// The 12:00Z rows are verbatim from a live griddap request (small California
// box, all variables, 2026-08-31). The 16:00Z rows are the same cells restamped
// with the next requested hour — the VALUES are not a second forecast, but the
// row shape is exactly what a strided time range returns, which is what the
// parser has to get right.
//
// Three real shapes matter here and none is obvious from the docs: a fully
// populated ocean cell, an ocean cell whose WIND-WAVE columns alone are null
// (no windsea partition), and a land cell that is null across the board. The
// longitudes are on the base dataset's 0-359.5 axis and the response carries
// `Tdir`/`wdir` columns the code no longer requests — both are deliberate: the
// parser is column-name driven and must not care.
const GRIDDAP_FIXTURE = {
  table: {
    columnNames: ['time', 'depth', 'latitude', 'longitude', 'Thgt', 'Tper', 'Tdir', 'shgt', 'sper', 'sdir', 'whgt', 'wper', 'wdir'],
    columnTypes: ['String', 'float', 'float', 'float', 'float', 'float', 'float', 'float', 'float', 'float', 'float', 'float', 'float'],
    columnUnits: ['UTC', 'm', 'degrees_north', 'degrees_east', 'meters', 'second', 'degrees', 'meters', 'seconds', 'degrees', 'meters', 'seconds', 'degrees'],
    rows: [
      ['2026-08-31T12:00:00Z', 0, 30, 235, 2.2, 13.157894, 168, 1.3199999, 12.58, 146, 1.5999999, 7.3599997, 1],
      ['2026-08-31T12:00:00Z', 0, 30, 235.5, 2.25, 12.987012, 159, 1.3399999, 12.53, 148, 1.63, 7.45, 359],
      ['2026-08-31T12:00:00Z', 0, 30, 243.5, 1.8399999, 12.048192, 184, 1.27, 8.139999, 306, null, null, null],
      ['2026-08-31T12:00:00Z', 0, 30, 244.5, null, null, null, null, null, null, null, null, null],
      ['2026-08-31T16:00:00Z', 0, 30, 235, 2.31, 13.1, 168, 1.4, 12.6, 146, 1.62, 7.4, 1],
      ['2026-08-31T16:00:00Z', 0, 30, 235.5, 2.36, 12.9, 159, 1.42, 12.5, 148, 1.65, 7.5, 359],
      ['2026-08-31T16:00:00Z', 0, 30, 243.5, 1.9, 12.0, 184, 1.3, 8.1, 306, null, null, null],
      ['2026-08-31T16:00:00Z', 0, 30, 244.5, null, null, null, null, null, null, null, null, null],
    ],
  },
}

describe('parseGriddapGrid', () => {
  it('reads every forecast hour and its ocean cells out of a real response', () => {
    const grid = parseGriddapGrid(GRIDDAP_FIXTURE)
    expect(grid.times).toEqual(['2026-08-31T12:00:00Z', '2026-08-31T16:00:00Z'])
    expect(grid.cells).toHaveLength(6)
    expect(grid.cells[0]).toEqual({
      time: '2026-08-31T12:00:00Z',
      lat: 30,
      lng: 235,
      waveHeight: 2.2,
      wavePeriod: 13.157894,
      swellHeight: 1.3199999,
      swellPeriod: 12.58,
      swellDirection: 146,
      windWaveHeight: 1.5999999,
      windWavePeriod: 7.3599997,
    })
  })

  it('keeps the hours distinct — the same cell appears once per timestep', () => {
    const grid = parseGriddapGrid(GRIDDAP_FIXTURE)
    const atOrigin = grid.cells.filter((c) => c.lng === 235)
    expect(atOrigin.map((c) => c.time)).toEqual(['2026-08-31T12:00:00Z', '2026-08-31T16:00:00Z'])
    expect(atOrigin.map((c) => c.waveHeight)).toEqual([2.2, 2.31])
  })

  it('lists an hour even when every cell in it is land', () => {
    // The hour still happened; it just has no ocean in this box. Dropping it
    // would misalign the per-timestep series the cron builds.
    const grid = parseGriddapGrid({
      table: {
        columnNames: ['time', 'depth', 'latitude', 'longitude', 'Thgt'],
        rows: [['2026-08-31T12:00:00Z', 0, 30, 244.5, null]],
      },
    })
    expect(grid.times).toEqual(['2026-08-31T12:00:00Z'])
    expect(grid.cells).toEqual([])
  })

  it('drops land cells, which arrive as null IN PLACE rather than as gaps', () => {
    expect(parseGriddapGrid(GRIDDAP_FIXTURE).cells.some((c) => c.lng === 244.5)).toBe(false)
  })

  it('preserves a missing wind-wave partition as null, never as 0', () => {
    // 0 would be scored as a measured, perfectly clean sea; null makes the
    // rating engine drop the cleanliness factor and renormalise.
    const swellOnly = parseGriddapGrid(GRIDDAP_FIXTURE).cells.find((c) => c.lng === 243.5)!
    expect(swellOnly.windWaveHeight).toBeNull()
    expect(swellOnly.windWavePeriod).toBeNull()
    expect(swellOnly.swellHeight).toBe(1.27)
  })

  it('is column-name driven, so a reordered or extended response still parses', () => {
    const grid = parseGriddapGrid({
      table: {
        columnNames: ['time', 'depth', 'longitude', 'latitude', 'shgt', 'Thgt'],
        rows: [['2026-08-31T12:00:00Z', 0, -19.5, 35, 0.81, 1.16]],
      },
    })
    expect(grid.cells).toEqual([{
      time: '2026-08-31T12:00:00Z', lat: 35, lng: -19.5, waveHeight: 1.16, wavePeriod: null,
      swellHeight: 0.81, swellPeriod: null, swellDirection: null,
      windWaveHeight: null, windWavePeriod: null,
    }])
  })

  it('discards a row with no time — an unplaceable hour must never be served as now', () => {
    const grid = parseGriddapGrid({
      table: {
        columnNames: ['depth', 'latitude', 'longitude', 'Thgt'],
        rows: [[0, 35, -19.5, 1.16]],
      },
    })
    expect(grid).toEqual({ times: [], cells: [] })
  })

  it('returns nothing rather than throwing on an error body or garbage', () => {
    for (const bad of [null, undefined, {}, { table: {} }, { code: 404, message: 'x' }, 'nope']) {
      expect(parseGriddapGrid(bad)).toEqual({ times: [], cells: [] })
    }
  })
})

describe('ww3TimeRange', () => {
  it('floors to the hour and formats what griddap accepts', () => {
    const range = ww3TimeRange(new Date('2026-08-31T12:47:31.500Z'))
    expect(range.start).toBe('2026-08-31T12:00:00Z')
    expect(range.end).toBe('2026-09-01T16:00:00Z')
  })

  it('never emits the tabledap-only `now` keyword', () => {
    // griddap answers `[(now)]` with
    // `Start=NaN (invalid format?) isn't allowed` — verified live.
    const range = ww3TimeRange()
    expect(range.start).not.toContain('now')
    expect(range.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00Z$/)
    expect(range.end).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00Z$/)
  })

  it('outlasts the gap between two daily cron runs', () => {
    // Hobby cron timing is imprecise (it fires within ~an hour of the
    // schedule), so consecutive runs can be ~25 h apart. A window shorter than
    // that leaves the map with no usable hour before the next refresh.
    const span = (WW3_TIME_STEPS - 1) * WW3_TIME_STRIDE_HOURS
    expect(span).toBeGreaterThanOrEqual(26)
  })

  it('spaces the hours closer together than the validity window', () => {
    // With 6-hourly steps the worst-case distance to a stored hour is exactly
    // the 3 h cutoff, i.e. the feature switches itself off at the midpoint.
    expect(WW3_TIME_STRIDE_HOURS * HOUR / 2).toBeLessThan(WW3_MAX_TIMESTEP_GAP_MS)
  })
})

describe('buildGriddapUrl', () => {
  const box = { id: 'test', latMin: 30.5, latMax: 40.5, lonMin: -124.5, lonMax: -114.5 }
  const range = { start: '2026-08-31T12:00:00Z', end: '2026-09-01T16:00:00Z' }

  it('asks for every variable over the whole window in one request', () => {
    const url = decodeURIComponent(buildGriddapUrl(box, range))
    for (const v of WW3_VARIABLES) {
      expect(url).toContain(
        `${v}[(2026-08-31T12:00:00Z):${WW3_TIME_STRIDE_HOURS}:(2026-09-01T16:00:00Z)]` +
        `[0][(30.5):${WW3_SPATIAL_STRIDE}:(40.5)][(-124.5):${WW3_SPATIAL_STRIDE}:(-114.5)]`
      )
    }
    // One query, N variables — adding variables is far cheaper than adding
    // requests, because the time/depth/lat/lon columns dominate a griddap row.
    expect(url.split('?')[1].split(',')).toHaveLength(WW3_VARIABLES.length)
  })

  it('requests only what the conditions mapping consumes', () => {
    // Tdir and wdir are read by nothing: swell direction comes from sdir, and
    // wdir is a wind-WAVE direction that must never be passed off as a wind.
    expect([...WW3_VARIABLES]).toEqual(['Thgt', 'Tper', 'shgt', 'sper', 'sdir', 'whgt', 'wper'])
  })

  it('uses the lon180 alias, because the 0-359.5 axis 404s across the meridian', () => {
    expect(buildGriddapUrl(box, range)).toContain('/griddap/ww3_global_lon180.json?')
  })
})

describe('snapToNearestCell', () => {
  const cell = (lat: number, lng: number, waveHeight: number) => ({
    time: '2026-08-31T12:00:00Z', lat, lng, waveHeight,
    wavePeriod: 10, swellHeight: 1, swellPeriod: 12, swellDirection: 270,
    windWaveHeight: 0.4, windWavePeriod: 5,
  })

  it('snaps to the nearest cell that carries data, not the nearest lattice point', () => {
    // The containing cell is land (absent from the index); the ocean is west.
    const index = buildGridIndex([cell(34.5, -120.5, 1.1), cell(34.5, -122.5, 2.2)])
    const snap = snapToNearestCell(index, 34.4, -120.1)!
    expect(snap.cell.lng).toBe(-120.5)
    expect(snap.distanceKm).toBeLessThan(50)
  })

  it('reaches past a subsampled cell of land to find water', () => {
    const index = buildGridIndex([cell(34.5, -122.5, 1.4)])
    const snap = snapToNearestCell(index, 34.5, -120.5)!
    expect(snap.cell.lng).toBe(-122.5)
    expect(snap.distanceKm).toBeGreaterThan(150)
  })

  it('refuses a borrow past the ceiling rather than inventing a reading', () => {
    // Two subsampled cells west is ~367 km at this latitude — past
    // WW3_MAX_SNAP_KM, and far enough that it is no longer the same sea.
    const index = buildGridIndex([cell(34.5, -124.5, 1.4)])
    expect(snapToNearestCell(index, 34.5, -120.5)).toBeNull()
    expect(snapToNearestCell(buildGridIndex([cell(34.5, -122.5, 1.4)]), 34.5, -120.5, 100)).toBeNull()
  })

  it('returns null for an index with no cells at all', () => {
    expect(snapToNearestCell(buildGridIndex([]), 34, -120)).toBeNull()
  })

  it('crosses the antimeridian — Fiji must see cells on both sides of it', () => {
    const index = buildGridIndex([cell(-18.5, -179.5, 2.0)])
    const snap = snapToNearestCell(index, -18.1, 179.6)!
    expect(snap.cell.lng).toBe(-179.5)
    expect(snap.distanceKm).toBeLessThan(150)
  })

  it('widens the search in cells near the poles, where a longitude cell is narrow', () => {
    // At 60°N a 2° step of longitude is ~111 km, so a window sized in degrees
    // would search half as far east-west as it claims to.
    const index = buildGridIndex([cell(60.5, -124.5, 3.1)])
    expect(snapToNearestCell(index, 60.5, -120.5)!.cell.lng).toBe(-124.5)
  })
})

describe('WW3 partition -> map conditions', () => {
  const entry = cellToOverviewEntry({
    time: '2026-08-31T12:00:00Z', lat: 30.5, lng: -124.5,
    waveHeight: 2.2, wavePeriod: 13.157894,
    swellHeight: 1.3199999, swellPeriod: 12.58, swellDirection: 146,
    windWaveHeight: 1.5999999, windWavePeriod: 7.3599997,
  })

  it('stores a compact tuple, rounded without changing what it says', () => {
    // A tuple, not an object: the blob holds ~9,500 of these and repeating
    // seven field names each time roughly doubles the stored size.
    expect(entry).toEqual([2.2, 13.2, 1.32, 12.6, 146, 1.6, 7.4])
  })

  it('maps the swell and wind-wave partitions onto the conditions shape', () => {
    const om = overviewEntryToConditions(entry)
    expect(om.waveHeight).toBe(2.2)
    expect(om.wavePeriod).toBe(13.2)
    expect(om.swellHeight).toBe(1.32)
    expect(om.swellPeriod).toBe(12.6)
    expect(om.swellDirection).toBe(146)
    expect(om.windWaveHeight).toBe(1.6)
    expect(om.windWavePeriod).toBe(7.4)
  })

  it('leaves wind NULL — WaveWatch III measures no wind and must not invent one', () => {
    const om = overviewEntryToConditions(entry)
    expect(om.windSpeed).toBeNull()
    expect(om.windDirection).toBeNull()
    expect(om.windGust).toBeNull()
  })

  it('reports no second swell train — WW3 partitions the sea into two, not three', () => {
    const om = overviewEntryToConditions(entry)
    expect(om.secondarySwellHeight).toBeNull()
    expect(om.secondarySwellPeriod).toBeNull()
    expect(om.secondarySwellDirection).toBeNull()
  })

  it('keeps a missing wind-wave partition null so cleanliness renormalises', () => {
    const om = overviewEntryToConditions([1.84, 12, 1.27, 8.1, 306, null, null])
    expect(om.windWaveHeight).toBeNull()
    expect(om.windWavePeriod).toBeNull()
  })

  it('uses 0 only where the conditions shape itself means "absent partition"', () => {
    // waveHeight/swellHeight/swellPeriod are non-nullable in
    // CurrentMarineConditions and every consumer branches on `> 0`.
    const om = overviewEntryToConditions([0.9, null, null, null, null, 0.9, 4])
    expect(om.swellHeight).toBe(0)
    expect(om.swellPeriod).toBe(0)
    expect(om.wavePeriod).toBe(0)
    expect(om.swellDirection).toBeNull()
  })
})

describe('lookupWaveOverview', () => {
  const NOW = Date.parse('2026-08-31T13:00:00Z')
  const morning: WaveOverviewEntry = [2.2, 13.2, 1.32, 12.6, 146, 1.6, 7.4]
  const evening: WaveOverviewEntry = [0.6, 7.1, 0.3, 8, 200, 0.4, 5]

  const blob = (overrides: Partial<WaveOverviewBlob> = {}): WaveOverviewBlob => ({
    version: 2,
    generatedAt: NOW - 2 * HOUR,
    times: [NOW - HOUR, NOW + 3 * HOUR],
    boxes: ['test'],
    entries: {
      a: [morning, evening],
      b: [[1.1, 9.1, 0.6, 11, 200, 0.5, 5], null],
      c: [morning, evening],
    },
    ...overrides,
  })

  it('serves the forecast hour nearest to now, not the first one stored', () => {
    // 1 h ago beats 3 h ahead.
    const hit = lookupWaveOverview(blob(), ['a'], NOW)!
    expect(hit.readings[0]!.waveHeight).toBe(2.2)
    expect(hit.timestep).toBe(NOW - HOUR)
    expect(hit.gapMs).toBe(HOUR)
  })

  it('moves on to the later hour as the day advances — a snapshot would not', () => {
    // Four hours later the evening step is the closer one. This is the whole
    // reason the blob is time-indexed: with a daily cron, a single stored hour
    // would still be showing the morning's sea.
    const hit = lookupWaveOverview(blob(), ['a'], NOW + 4 * HOUR)!
    expect(hit.readings[0]!.waveHeight).toBe(0.6)
  })

  it('answers in the order of the keys it was asked about', () => {
    const hit = lookupWaveOverview(blob(), ['b', 'a'], NOW)!
    expect(hit.readings[0]!.waveHeight).toBe(1.1)
    expect(hit.readings[1]!.waveHeight).toBe(2.2)
    expect(hit.coverage).toBe(1)
  })

  it('treats a null element as a bucket the blob cannot answer for that hour', () => {
    // `b` has a reading at the first step and none at the later one, so the
    // same blob answers differently depending on which hour is served.
    expect(lookupWaveOverview(blob(), ['a', 'b', 'c'], NOW)!.coverage).toBe(1)
    const later = lookupWaveOverview(blob(), ['a', 'b', 'c'], NOW + 4 * HOUR)!
    expect(later.coverage).toBeCloseTo(2 / 3)
    expect(later.readings[1]).toBeNull()
  })

  it('refuses a blob whose nearest hour is outside the validity window', () => {
    const stale = blob({ times: [NOW - 30 * HOUR, NOW - 26 * HOUR] })
    expect(lookupWaveOverview(stale, ['a'], NOW)).toBeNull()
  })

  it('accepts a blob written long ago that still holds a nearby hour', () => {
    // AGE IS NOT THE TEST. A run from 20 h ago whose window reaches now is
    // exactly as useful as one written a minute ago.
    const old = blob({ generatedAt: NOW - 20 * HOUR })
    expect(lookupWaveOverview(old, ['a'], NOW)).not.toBeNull()
  })

  it('rejects the boundary a whisker past the cutoff and accepts it a whisker before', () => {
    const at = (offset: number) => lookupWaveOverview(
      blob({ times: [NOW + offset] }), ['a'], NOW)
    expect(at(WW3_MAX_TIMESTEP_GAP_MS - 1000)).not.toBeNull()
    expect(at(WW3_MAX_TIMESTEP_GAP_MS + 1000)).toBeNull()
  })

  it('refuses a blob that covers too little of the request', () => {
    // A partial cron run must not paint a third of the world grey; below the
    // coverage floor the caller falls back to Open-Meteo wholesale.
    expect(lookupWaveOverview(blob(), ['a', 'x', 'y', 'z'], NOW)).toBeNull()
  })

  it('is null with no blob, no keys, or no timesteps', () => {
    expect(lookupWaveOverview(null, ['a'], NOW)).toBeNull()
    expect(lookupWaveOverview(blob(), [], NOW)).toBeNull()
    expect(lookupWaveOverview(blob({ times: [] }), ['a'], NOW)).toBeNull()
  })
})

describe('cellToGridTuple', () => {
  const baseCell = {
    time: '2026-08-31T12:00:00Z', lat: 30.5, lng: -124.5,
    waveHeight: 2.2, wavePeriod: 13.157894,
    swellHeight: 1.3199999, swellPeriod: 12.58, swellDirection: 146,
    windWaveHeight: 1.5999999, windWavePeriod: 7.3599997,
  }

  it('stores a compact 5-number tuple, rounded without changing what it says', () => {
    expect(cellToGridTuple(baseCell)).toEqual([30.5, -124.5, 1.32, 12.6, 146])
  })

  it('returns null for an ocean cell with no swell partition — nothing to draw', () => {
    // A wind-wave-only cell (enclosed sea, lee of an island) still has a
    // combined wave height, so parseGriddapGrid kept it — but there is no
    // swell direction for the flow layer to animate toward.
    expect(cellToGridTuple({ ...baseCell, swellHeight: null })).toBeNull()
    expect(cellToGridTuple({ ...baseCell, swellPeriod: null })).toBeNull()
    expect(cellToGridTuple({ ...baseCell, swellDirection: null })).toBeNull()
  })

  it('returns null for a genuinely flat swell partition (height 0)', () => {
    expect(cellToGridTuple({ ...baseCell, swellHeight: 0 })).toBeNull()
  })
})

describe('lookupWaveGrid', () => {
  const NOW = Date.parse('2026-08-31T13:00:00Z')
  const morning: [number, number, number, number, number][] = [[30.5, -124.5, 1.3, 12.6, 146]]
  const evening: [number, number, number, number, number][] = [[30.5, -124.5, 0.6, 8, 200]]

  const blob = (overrides: Partial<{ times: number[]; cells: typeof morning[] }> = {}) => ({
    version: 1 as const,
    generatedAt: NOW - 2 * HOUR,
    times: [NOW - HOUR, NOW + 3 * HOUR],
    cells: [morning, evening],
    ...overrides,
  })

  it('serves the timestep nearest to now, not the first one stored', () => {
    const hit = lookupWaveGrid(blob(), NOW)!
    expect(hit.cells).toEqual(morning)
    expect(hit.time).toBe(NOW - HOUR)
  })

  it('moves on to the later timestep as the day advances', () => {
    const hit = lookupWaveGrid(blob(), NOW + 4 * HOUR)!
    expect(hit.cells).toEqual(evening)
  })

  it('refuses a blob whose nearest hour is outside the validity window', () => {
    const stale = blob({ times: [NOW - 30 * HOUR, NOW - 26 * HOUR] })
    expect(lookupWaveGrid(stale, NOW)).toBeNull()
  })

  it('rejects the boundary a whisker past the cutoff and accepts it a whisker before', () => {
    const at = (offset: number) => lookupWaveGrid(blob({ times: [NOW + offset], cells: [morning] }), NOW)
    expect(at(WW3_MAX_TIMESTEP_GAP_MS - 1000)).not.toBeNull()
    expect(at(WW3_MAX_TIMESTEP_GAP_MS + 1000)).toBeNull()
  })

  it('is null with no blob, no timesteps, or an empty cell list at the chosen hour', () => {
    expect(lookupWaveGrid(null, NOW)).toBeNull()
    expect(lookupWaveGrid(blob({ times: [] }), NOW)).toBeNull()
    expect(lookupWaveGrid(blob({ times: [NOW], cells: [[]] }), NOW)).toBeNull()
  })
})

describe('WW3_BOXES', () => {
  it('covers every spot in the dataset', () => {
    const outside = SPOTS.filter((s) => !WW3_BOXES.some((b) =>
      s.lat >= b.latMin && s.lat <= b.latMax && s.lng >= b.lonMin && s.lng <= b.lonMax))
    // Adding a spot in an unmodelled corner of the world is exactly the change
    // that would silently leave it grey on a zoomed-out map.
    expect(outside.map((s) => `${s.slug} ${s.lat},${s.lng}`)).toEqual([])
  })

  it('puts every box origin on the SAME subsampled lattice', () => {
    // griddap counts a stride from the box's own start index. Two boxes whose
    // origins differ by an odd number of native cells sample two interleaved
    // lattices, and `gridCellKey` then rounds cells 0.5° apart onto one key —
    // silently serving one cell's readings for another's.
    for (const b of WW3_BOXES) {
      for (const v of [b.latMin, b.lonMin]) {
        expect(((v / WW3_GRID_DEG) % WW3_SPATIAL_STRIDE + WW3_SPATIAL_STRIDE) % WW3_SPATIAL_STRIDE)
          .toBe(((0.5 / WW3_GRID_DEG) % WW3_SPATIAL_STRIDE))
      }
    }
  })

  it('gives each box origin a distinct lattice key per sampled cell', () => {
    const keys = new Set<string>()
    for (const b of WW3_BOXES) {
      for (let lat = b.latMin; lat <= b.latMax; lat += SUBSAMPLED_DEG) {
        keys.add(gridCellKey(lat, b.lonMin))
      }
    }
    // A collision here means two real cells share a key and one overwrites the
    // other in the snap index.
    const cells: string[] = []
    for (const b of WW3_BOXES) {
      for (let lat = b.latMin; lat <= b.latMax; lat += SUBSAMPLED_DEG) cells.push(`${lat},${b.lonMin}`)
    }
    expect(keys.size).toBe(new Set(cells).size)
  })

  it('leaves every conditions bucket a sampled cell within the snap ceiling', () => {
    // Land is not modelled here, so this is a necessary condition rather than a
    // sufficient one — but a bucket with no SAMPLED point in range can never be
    // answered however much ocean is nearby.
    const unreachable = CONDITIONS_BUCKETS.filter((bucket) => {
      let best = Infinity
      for (const b of WW3_BOXES) {
        for (let lat = b.latMin; lat <= b.latMax + 1e-9; lat += SUBSAMPLED_DEG) {
          for (let lng = b.lonMin; lng <= b.lonMax + 1e-9; lng += SUBSAMPLED_DEG) {
            const d = distanceKm(bucket.lat, bucket.lng, lat, lng)
            if (d < best) best = d
          }
        }
      }
      return best > WW3_MAX_SNAP_KM
    })
    expect(unreachable.map((b) => b.key)).toEqual([])
  })

  it('stays inside the dataset domain and never straddles the antimeridian', () => {
    for (const b of WW3_BOXES) {
      expect(b.latMin).toBeGreaterThanOrEqual(-77.5)
      expect(b.latMax).toBeLessThanOrEqual(77.5)
      expect(b.lonMin).toBeGreaterThanOrEqual(-180)
      expect(b.lonMax).toBeLessThanOrEqual(180)
      expect(b.lonMin).toBeLessThan(b.lonMax)
      expect(b.latMin).toBeLessThan(b.latMax)
    }
  })

  it('keeps the whole run inside the fetch budget', () => {
    // The measured model: ~4 s of fixed cost per griddap request and ~51.2 KB/s
    // of throughput, on rows of 45.83 B plus 7.09 B per variable. Blowing this
    // is how the cron starts dying against `maxDuration` instead of finishing.
    const cells = WW3_BOXES.reduce((n, b) =>
      n + (Math.floor((b.latMax - b.latMin) / SUBSAMPLED_DEG) + 1)
        * (Math.floor((b.lonMax - b.lonMin) / SUBSAMPLED_DEG) + 1), 0)
    const bytes = cells * WW3_TIME_STEPS * (45.83 + 7.09 * WW3_VARIABLES.length)
    const seconds = WW3_BOXES.length * 4 + bytes / 51200
    expect(seconds).toBeLessThan(130)
    // And it must never become the full-resolution global grid: 11.3 MB, >120 s
    // for a SINGLE variable and a single hour, measured.
    expect(cells).toBeLessThan(311 * 720)
  })
})

// ── The reason the whole thing exists: no Open-Meteo calls on a wide map ─────
describe('GET /api/spots?withConditions=true — overview source', () => {
  const entry: WaveOverviewEntry = [2.2, 13.2, 1.32, 12.6, 146, 0.4, 7.4]

  const fullBlob = (times = [Date.now()]): WaveOverviewBlob => ({
    version: 2,
    generatedAt: Date.now(),
    times,
    boxes: ['all'],
    entries: Object.fromEntries(CONDITIONS_BUCKETS.map((b) =>
      [b.key, times.map(() => entry)])),
  })

  beforeEach(() => {
    batchCalls.length = 0
    stubBlob = null
  })

  async function conditions(query: string) {
    const res = await GET(new Request(`http://localhost/api/spots?${query}`))
    expect(res.status).toBe(200)
    return res.json() as Promise<Record<string, unknown>[]>
  }

  it('serves a sampled overview from WaveWatch III with ZERO Open-Meteo calls', async () => {
    stubBlob = fullBlob()
    const body = await conditions('withConditions=true')
    expect(batchCalls).toHaveLength(0)
    expect(body.every((s) => s.approx === true)).toBe(true)
    expect(body.filter((s) => s.currentRating !== 'unknown').length).toBeGreaterThan(body.length * 0.9)
  })

  it('still says "regional estimate" — the contract does not change with the source', async () => {
    stubBlob = fullBlob()
    const [first] = await conditions('withConditions=true')
    expect(Object.keys(first).sort()).toEqual([
      'approx', 'bottomType', 'country', 'currentFaceHeight', 'currentPeriod', 'currentRating',
      'currentWaveHeight', 'currentWindDir', 'currentWindSpeed', 'difficulty', 'facingDirection',
      'id', 'lat', 'lng', 'name', 'parkingOptions', 'region', 'slug', 'wavePower',
    ])
  })

  it('reports no wind rather than a fabricated one', async () => {
    stubBlob = fullBlob()
    const body = await conditions('withConditions=true')
    expect(body.every((s) => s.currentWindSpeed === null && s.currentWindDir === null)).toBe(true)
  })

  it('picks the stored hour nearest to now out of a full day of them', async () => {
    const now = Date.now()
    const times = Array.from({ length: WW3_TIME_STEPS }, (_, i) =>
      now - 6 * HOUR + i * WW3_TIME_STRIDE_HOURS * HOUR)
    stubBlob = fullBlob(times)
    await conditions('withConditions=true')
    // The first two steps are 6 h and 2 h behind; only the second is usable, so
    // reaching Open-Meteo would mean the nearest-hour pick failed.
    expect(batchCalls).toHaveLength(0)
  })

  it('falls back to Open-Meteo sampling when the cron has never run', async () => {
    stubBlob = null
    await conditions('withConditions=true')
    expect(batchCalls).toHaveLength(1)
    expect(batchCalls[0].length).toBeLessThanOrEqual(200)
  })

  it('falls back when every stored hour is out of the validity window', async () => {
    stubBlob = fullBlob([Date.now() - 2 * 24 * HOUR])
    await conditions('withConditions=true')
    expect(batchCalls).toHaveLength(1)
  })

  it('leaves an in-viewport request on Open-Meteo — below the ceiling nothing changes', async () => {
    stubBlob = fullBlob()
    const body = await conditions('withConditions=true&bbox=33.5,-118.9,34.2,-118.2')
    expect(batchCalls).toHaveLength(1)
    expect(body.every((s) => s.approx === undefined)).toBe(true)
    expect(body[0].currentWindSpeed).toBe(9)
  })
})
