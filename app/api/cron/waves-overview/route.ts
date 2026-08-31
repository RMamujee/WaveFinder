import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { monitor } from '@/lib/monitoring'
import { CONDITIONS_BUCKETS } from '@/lib/spots/static-store'
import {
  WW3_BOXES,
  buildGriddapUrl,
  buildGridIndex,
  cellToOverviewEntry,
  gridCellKey,
  parseGriddapGrid,
  snapToNearestCell,
  writeWaveOverview,
  ww3TimeRange,
  type WW3Box,
  type WW3Cell,
  type WW3Index,
  type WW3TimeRange,
  type WaveOverviewEntry,
} from '@/lib/api/ww3-overview'

export const dynamic = 'force-dynamic'

// Twelve boxes × 5,068 subsampled cells × 8 forecast hours ≈ 40,500 griddap
// rows, ~3.9 MB, ~124 s of upstream work at the measured ~51 KB/s plus ~4 s of
// fixed cost per request. Four in flight brings the wall time to ~30 s when
// PacIOOS is healthy; the ceiling is set for the day it is not (a live probe
// caught it running 5× slow just after a dataset reload). A run that dies half
// way leaves the map on the previous blob, which is survivable, but there is no
// reason to make that the normal outcome.
export const maxDuration = 300

// Concurrent box requests. PacIOOS publishes no rate limit, so this is
// politeness rather than a documented ceiling: four in flight keeps the run
// inside the budget above without opening twelve sockets on a free public
// service.
const BOX_CONCURRENCY = 4
const BOX_TIMEOUT_MS = 120_000

// Constant-time secret comparison — same guard as /api/cron/cleanup. `===` on
// strings short-circuits at the first differing byte, which leaks the secret's
// prefix to anyone who can measure response times across many attempts.
// timingSafeEqual needs equal-length buffers, so the length check is done first
// and deliberately non-secret.
function secretMatches(provided: string | null, expected: string) {
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

interface BoxResult {
  box: WW3Box
  cells: WW3Cell[]
  times: string[]
  error: string | null
}

async function fetchBox(box: WW3Box, range: WW3TimeRange): Promise<BoxResult> {
  const url = buildGriddapUrl(box, range)
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(BOX_TIMEOUT_MS),
    })
    if (!res.ok) {
      return { box, cells: [], times: [], error: `http_${res.status}` }
    }
    const grid = parseGriddapGrid(await res.json())
    return { box, cells: grid.cells, times: grid.times, error: null }
  } catch (err) {
    return { box, cells: [], times: [], error: err instanceof Error ? err.name : 'fetch_failed' }
  }
}

/**
 * Refresh the world map's conditions overview from PacIOOS ERDDAP `ww3_global`.
 *
 * WHY THIS EXISTS: Open-Meteo bills a multi-location request PER LOCATION, so
 * a zoomed-out map was a ~2,400-call sweep against a 5,000/hour allowance — the
 * failure that greyed every pin in production and forced the 200-bucket ceiling
 * in app/api/spots/route.ts. WaveWatch III over griddap is a gridded source:
 * twelve requests cover the entire planet regardless of how many spots there
 * are, at zero Open-Meteo cost.
 *
 * WHY IT STORES A FORECAST WINDOW RATHER THAN A SNAPSHOT: this runs once a day
 * (the Vercel Hobby limit), so a single hour would be served as "current" to an
 * evening visitor who is actually looking at the morning's sea. Each run stores
 * eight hours spanning now..now+28 h and the read path picks the one nearest to
 * the reader's clock.
 *
 * The snap is precomputed here — once per bucket, against the union of every
 * hour's cells so the same grid point is read at every timestep — because it is
 * the expensive part and it does not change between requests.
 *
 * A PARTIAL RUN IS WRITTEN, not discarded: if one box times out the rest of the
 * world still gets fresh readings, and `lookupWaveOverview` decides per request
 * whether the coverage is high enough to colour the map with (below 60% the
 * request falls back to Open-Meteo sampling). Vercel invokes cron paths with
 * `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || !secretMatches(req.headers.get('authorization'), `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const range = ww3TimeRange()

  try {
    const results: BoxResult[] = []
    for (let i = 0; i < WW3_BOXES.length; i += BOX_CONCURRENCY) {
      const chunk = WW3_BOXES.slice(i, i + BOX_CONCURRENCY)
      results.push(...await Promise.all(chunk.map((box) => fetchBox(box, range))))
    }

    // One index per forecast hour, plus a union used only for the snap: a cell
    // that carries data at some hours and not others must still be findable,
    // and every hour must then be read from THAT cell rather than from whichever
    // cell happened to be nearest at that hour.
    const slices = new Map<string, WW3Index>()
    const union: WW3Cell[] = []
    for (const result of results) {
      for (const cell of result.cells) {
        let slice = slices.get(cell.time)
        if (!slice) { slice = new Map(); slices.set(cell.time, slice) }
        slice.set(gridCellKey(cell.lat, cell.lng), cell)
        union.push(cell)
      }
    }
    const times = [...slices.keys()].sort()
    const okBoxes = results.filter((r) => r.error === null)
    const failed = results.filter((r) => r.error !== null)

    if (times.length === 0) {
      // Every box failed. Writing an empty blob would overwrite a perfectly
      // good previous run with "no data everywhere" for the next two days.
      monitor('error', 'cron.waves_overview.no_data', {
        start: range.start,
        failed: failed.map((r) => `${r.box.id}:${r.error}`).join(','),
      })
      return NextResponse.json({ ok: false, reason: 'no_grid_data' }, { status: 502 })
    }

    const snapIndex = buildGridIndex(union)
    const entries: Record<string, (WaveOverviewEntry | null)[]> = {}
    const distances: number[] = []
    for (const bucket of CONDITIONS_BUCKETS) {
      const snap = snapToNearestCell(snapIndex, bucket.lat, bucket.lng)
      if (!snap) continue
      const cellKey = gridCellKey(snap.cell.lat, snap.cell.lng)
      const series = times.map((t) => {
        const cell = slices.get(t)?.get(cellKey)
        return cell ? cellToOverviewEntry(cell) : null
      })
      if (series.every((e) => e === null)) continue
      entries[bucket.key] = series
      distances.push(snap.distanceKm)
    }

    const written = await writeWaveOverview({
      version: 2,
      generatedAt: Date.now(),
      times: times.map((t) => Date.parse(t)),
      boxes: okBoxes.map((r) => r.box.id),
      entries,
    })

    distances.sort((a, b) => a - b)
    const payload = {
      ok: written,
      window: `${range.start}..${range.end}`,
      timesteps: times.length,
      cells: snapIndex.size,
      buckets: CONDITIONS_BUCKETS.length,
      snapped: distances.length,
      coverage: Math.round((distances.length / CONDITIONS_BUCKETS.length) * 1000) / 1000,
      medianSnapKm: distances.length ? Math.round(distances[distances.length >> 1] * 10) / 10 : null,
      maxSnapKm: distances.length ? Math.round(distances[distances.length - 1] * 10) / 10 : null,
      failedBoxes: failed.map((r) => `${r.box.id}:${r.error}`),
      elapsedMs: Date.now() - startedAt,
    }

    // A cache-less environment (no Vercel Runtime Cache) is a real outcome, not
    // an error: the map keeps working on the Open-Meteo path. It is worth
    // knowing about, so it is logged rather than swallowed.
    monitor(written ? 'info' : 'warn', 'cron.waves_overview.completed', payload)
    return NextResponse.json(payload, { status: written ? 200 : 500 })
  } catch (err) {
    monitor('error', 'cron.waves_overview.failed', {
      error: err instanceof Error ? err : String(err),
      start: range.start,
    })
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
