import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CurrentMarineConditions, GeoPoint } from '@/lib/api/open-meteo'
import type { WaveOverviewBlob } from '@/lib/api/ww3-overview'

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
  WW3_MAX_AGE_MS,
  WW3_VARIABLES,
  buildGridIndex,
  buildGriddapUrl,
  cellToOverviewEntry,
  lookupWaveOverview,
  overviewEntryToConditions,
  parseGriddapGrid,
  snapToNearestCell,
  ww3TimeParam,
} = await import('@/lib/api/ww3-overview')
const { CONDITIONS_BUCKETS, SPOTS } = await import('@/lib/spots/static-store')
const { GET } = await import('@/app/api/spots/route')

// ── Fixture ─────────────────────────────────────────────────────────────────
// Captured verbatim from a live griddap request (small California box,
// 2026-08-31T12:00Z, all nine variables). The longitudes are on the base
// dataset's 0-359.5 axis, which the parser neither knows nor cares about — it
// is column-name driven. The rows are here because three real shapes matter and
// none of them is obvious from the docs: a fully populated ocean cell, an ocean
// cell whose WIND-WAVE columns alone are null (no windsea partition), and a
// land cell that is null across the board.
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
    ],
  },
}

describe('parseGriddapGrid', () => {
  it('reads the ocean cells and the forecast hour out of a real response', () => {
    const grid = parseGriddapGrid(GRIDDAP_FIXTURE)
    expect(grid.time).toBe('2026-08-31T12:00:00Z')
    expect(grid.cells).toHaveLength(3)
    expect(grid.cells[0]).toEqual({
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

  it('drops land cells, which arrive as null IN PLACE rather than as gaps', () => {
    const grid = parseGriddapGrid(GRIDDAP_FIXTURE)
    expect(grid.cells.some((c) => c.lng === 244.5)).toBe(false)
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
    const reordered = {
      table: {
        columnNames: ['time', 'depth', 'longitude', 'latitude', 'shgt', 'Thgt'],
        rows: [['2026-08-31T12:00:00Z', 0, -19.5, 35, 0.81, 1.16]],
      },
    }
    const grid = parseGriddapGrid(reordered)
    expect(grid.cells).toEqual([{
      lat: 35, lng: -19.5, waveHeight: 1.16, wavePeriod: null,
      swellHeight: 0.81, swellPeriod: null, swellDirection: null,
      windWaveHeight: null, windWavePeriod: null,
    }])
  })

  it('returns nothing rather than throwing on an error body or garbage', () => {
    for (const bad of [null, undefined, {}, { table: {} }, { code: 404, message: 'x' }, 'nope']) {
      expect(parseGriddapGrid(bad)).toEqual({ time: null, cells: [] })
    }
  })
})

describe('buildGriddapUrl', () => {
  const box = { id: 'test', latMin: 30, latMax: 40, lonMin: -125, lonMax: -115 }

  it('asks for every variable in one request, at one hour and one depth', () => {
    const url = decodeURIComponent(buildGriddapUrl(box, '2026-08-31T12:00:00Z'))
    for (const v of WW3_VARIABLES) {
      expect(url).toContain(`${v}[(2026-08-31T12:00:00Z)][0][(30):(40)][(-125):(-115)]`)
    }
    // One query, nine variables — adding variables is far cheaper than adding
    // requests, because the time/depth/lat/lon columns dominate a griddap row.
    expect(url.split('?')[1].split(',')).toHaveLength(WW3_VARIABLES.length)
  })

  it('uses the lon180 alias, because the 0-359.5 axis 404s across the meridian', () => {
    expect(buildGriddapUrl(box, '2026-08-31T12:00:00Z')).toContain('/griddap/ww3_global_lon180.json?')
  })
})

describe('ww3TimeParam', () => {
  it('floors to the hour and formats what griddap accepts', () => {
    expect(ww3TimeParam(new Date('2026-08-31T12:47:31.500Z'))).toBe('2026-08-31T12:00:00Z')
  })

  it('never emits the tabledap-only `now` keyword', () => {
    // griddap answers `[(now)]` with
    // `Start=NaN (invalid format?) isn't allowed` — verified live.
    expect(ww3TimeParam()).not.toContain('now')
    expect(ww3TimeParam()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00Z$/)
  })
})

describe('snapToNearestCell', () => {
  const cell = (lat: number, lng: number, waveHeight: number) => ({
    lat, lng, waveHeight,
    wavePeriod: 10, swellHeight: 1, swellPeriod: 12, swellDirection: 270,
    windWaveHeight: 0.4, windWavePeriod: 5,
  })

  it('snaps to the nearest cell that carries data, not the nearest lattice point', () => {
    // The containing cell is land (absent from the index); the coast is west.
    const index = buildGridIndex([cell(34, -120, 1.1), cell(34, -120.5, 2.2)])
    const snap = snapToNearestCell(index, 34.02, -119.9)!
    expect(snap.cell.lng).toBe(-120)
    expect(snap.distanceKm).toBeLessThan(15)
  })

  it('reaches past a whole grid cell of land to find water', () => {
    const index = buildGridIndex([cell(34, -121.5, 1.4)])
    const snap = snapToNearestCell(index, 34, -120)!
    expect(snap.cell.lng).toBe(-121.5)
    expect(snap.distanceKm).toBeGreaterThan(100)
  })

  it('refuses a borrow past maxKm rather than inventing a reading', () => {
    const index = buildGridIndex([cell(34, -121.5, 1.4)])
    expect(snapToNearestCell(index, 34, -120, 50)).toBeNull()
  })

  it('returns null for an index with no cells at all', () => {
    expect(snapToNearestCell(buildGridIndex([]), 34, -120)).toBeNull()
  })

  it('crosses the antimeridian — Fiji must see cells on both sides of it', () => {
    const index = buildGridIndex([cell(-18, -179.5, 2.0)])
    const snap = snapToNearestCell(index, -18.1, 179.6)!
    expect(snap.cell.lng).toBe(-179.5)
    expect(snap.distanceKm).toBeLessThan(120)
  })

  it('widens the search in cells near the poles, where a longitude cell is narrow', () => {
    // At 60°N a 0.5° step of longitude is ~28 km, so a fixed ±3-cell window
    // would search only ~83 km east-west while claiming to search 165.
    const index = buildGridIndex([cell(60, -125, 3.1)])
    const snap = snapToNearestCell(index, 60, -122.5)!
    expect(snap.cell.lng).toBe(-125)
  })
})

describe('WW3 partition -> map conditions', () => {
  const entry = cellToOverviewEntry({
    lat: 30, lng: -125,
    waveHeight: 2.2, wavePeriod: 13.157894,
    swellHeight: 1.3199999, swellPeriod: 12.58, swellDirection: 146,
    windWaveHeight: 1.5999999, windWavePeriod: 7.3599997,
  })

  it('rounds the stored entry without changing what it says', () => {
    expect(entry).toEqual({ h: 2.2, p: 13.2, sh: 1.32, sp: 12.6, sd: 146, wh: 1.6, wp: 7.4 })
  })

  it('maps the swell and wind-wave partitions onto the conditions shape', () => {
    const om = overviewEntryToConditions(entry)
    expect(om.waveHeight).toBe(2.2)
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
    // The wind-wave DIRECTION is not a wind direction. Passing it as one would
    // score a real onshore/offshore penalty from a number that never described
    // the wind.
    expect(om.windDirection).not.toBe(1)
  })

  it('reports no second swell train — WW3 partitions the sea into two, not three', () => {
    const om = overviewEntryToConditions(entry)
    expect(om.secondarySwellHeight).toBeNull()
    expect(om.secondarySwellPeriod).toBeNull()
    expect(om.secondarySwellDirection).toBeNull()
  })

  it('keeps a missing wind-wave partition null so cleanliness renormalises', () => {
    const om = overviewEntryToConditions({ h: 1.84, p: 12, sh: 1.27, sp: 8.1, sd: 306, wh: null, wp: null })
    expect(om.windWaveHeight).toBeNull()
    expect(om.windWavePeriod).toBeNull()
  })

  it('uses 0 only where the conditions shape itself means "absent partition"', () => {
    // waveHeight/swellHeight/swellPeriod are non-nullable in
    // CurrentMarineConditions and every consumer branches on `> 0`.
    const om = overviewEntryToConditions({ h: 0.9, p: null, sh: null, sp: null, sd: null, wh: 0.9, wp: 4 })
    expect(om.swellHeight).toBe(0)
    expect(om.swellPeriod).toBe(0)
    expect(om.wavePeriod).toBe(0)
    expect(om.swellDirection).toBeNull()
  })
})

describe('lookupWaveOverview', () => {
  const blob = (overrides: Partial<WaveOverviewBlob> = {}): WaveOverviewBlob => ({
    version: 1,
    generatedAt: Date.now(),
    dataTime: '2026-08-31T12:00:00Z',
    boxes: ['test'],
    entries: {
      a: { h: 2.2, p: 13.2, sh: 1.32, sp: 12.6, sd: 146, wh: 1.6, wp: 7.4 },
      b: { h: 1.1, p: 9.1, sh: 0.6, sp: 11, sd: 200, wh: 0.5, wp: 5 },
    },
    ...overrides,
  })

  it('answers in the order of the keys it was asked about', () => {
    const hit = lookupWaveOverview(blob(), ['b', 'a'])!
    expect(hit.readings[0]!.waveHeight).toBe(1.1)
    expect(hit.readings[1]!.waveHeight).toBe(2.2)
    expect(hit.coverage).toBe(1)
  })

  it('refuses a blob older than the hard staleness limit', () => {
    expect(lookupWaveOverview(blob({ generatedAt: Date.now() - WW3_MAX_AGE_MS - 1 }), ['a'])).toBeNull()
  })

  it('refuses a blob that covers too little of the request', () => {
    // A partial cron run must not paint a third of the world grey; below the
    // coverage floor the caller falls back to Open-Meteo wholesale.
    expect(lookupWaveOverview(blob(), ['a', 'x', 'y', 'z'])).toBeNull()
  })

  it('serves a sparse-but-usable blob with nulls for the buckets it lacks', () => {
    const hit = lookupWaveOverview(blob(), ['a', 'b', 'x'])!
    expect(hit.readings[2]).toBeNull()
    expect(hit.coverage).toBeCloseTo(2 / 3)
  })

  it('is null when there is no blob at all', () => {
    expect(lookupWaveOverview(null, ['a'])).toBeNull()
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

  it('leaves at least a grid cell of ocean around each spot to snap to', () => {
    const tooTight = SPOTS.filter((s) => !WW3_BOXES.some((b) =>
      s.lat >= b.latMin + WW3_GRID_DEG && s.lat <= b.latMax - WW3_GRID_DEG &&
      s.lng >= b.lonMin + WW3_GRID_DEG && s.lng <= b.lonMax - WW3_GRID_DEG))
    expect(tooTight.map((s) => s.slug)).toEqual([])
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

  it('never asks for the full-resolution global grid', () => {
    // Measured: 11.3 MB and over 120 s. It does not fit in an invocation.
    const cells = WW3_BOXES.reduce((n, b) =>
      n + ((b.latMax - b.latMin) / WW3_GRID_DEG + 1) * ((b.lonMax - b.lonMin) / WW3_GRID_DEG + 1), 0)
    expect(cells).toBeLessThan(311 * 720)
  })
})

// ── The reason the whole thing exists: no Open-Meteo calls on a wide map ─────
describe('GET /api/spots?withConditions=true — overview source', () => {
  const fullBlob = (generatedAt = Date.now()): WaveOverviewBlob => ({
    version: 1,
    generatedAt,
    dataTime: '2026-08-31T12:00:00Z',
    boxes: ['all'],
    entries: Object.fromEntries(CONDITIONS_BUCKETS.map((b) =>
      [b.key, { h: 2.2, p: 13.2, sh: 1.32, sp: 12.6, sd: 146, wh: 0.4, wp: 7.4 }])),
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

  it('falls back to Open-Meteo sampling when the cron has never run', async () => {
    stubBlob = null
    await conditions('withConditions=true')
    expect(batchCalls).toHaveLength(1)
    expect(batchCalls[0].length).toBeLessThanOrEqual(200)
  })

  it('falls back to Open-Meteo sampling when the blob is too old to trust', async () => {
    stubBlob = fullBlob(Date.now() - WW3_MAX_AGE_MS - 1)
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
