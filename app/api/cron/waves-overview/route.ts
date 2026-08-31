import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { monitor } from '@/lib/monitoring'
import { CONDITIONS_BUCKETS } from '@/lib/spots/static-store'
import {
  WW3_BOXES,
  buildGriddapUrl,
  buildGridIndex,
  cellToOverviewEntry,
  parseGriddapGrid,
  snapToNearestCell,
  writeWaveOverview,
  ww3TimeParam,
  type WW3Box,
  type WW3Cell,
  type WaveOverviewEntry,
} from '@/lib/api/ww3-overview'

export const dynamic = 'force-dynamic'

// The whole world at full resolution is ~79,000 grid cells across 12 boxes.
// Measured against PacIOOS: ~50 KB/s of griddap throughput plus ~4 s of fixed
// cost per request, i.e. a few minutes of upstream work if it serialises and
// well under a minute if it parallelises. Budget for the pessimistic case —
// a cron that dies half way leaves the map on the previous run's blob, which is
// fine, but there is no reason to make that the normal outcome.
export const maxDuration = 300

// Concurrent box requests. PacIOOS publishes no rate limit, so this is
// politeness rather than a documented ceiling: four in flight keeps the run
// inside the budget above without opening twelve sockets on a free public
// service four times a day.
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
  time: string | null
  error: string | null
}

async function fetchBox(box: WW3Box, time: string): Promise<BoxResult> {
  const url = buildGriddapUrl(box, time)
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(BOX_TIMEOUT_MS),
    })
    if (!res.ok) {
      return { box, cells: [], time: null, error: `http_${res.status}` }
    }
    const grid = parseGriddapGrid(await res.json())
    return { box, cells: grid.cells, time: grid.time, error: null }
  } catch (err) {
    return { box, cells: [], time: null, error: err instanceof Error ? err.name : 'fetch_failed' }
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
 * Each run fetches every box for ONE forecast hour, snaps all ~1,192 conditions
 * buckets to their nearest grid cell that carries data, and writes a single
 * compact blob to the Vercel Runtime Cache. The snap is precomputed here rather
 * than per request precisely because it is the expensive part.
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
  const time = ww3TimeParam()

  try {
    const results: BoxResult[] = []
    for (let i = 0; i < WW3_BOXES.length; i += BOX_CONCURRENCY) {
      const chunk = WW3_BOXES.slice(i, i + BOX_CONCURRENCY)
      results.push(...await Promise.all(chunk.map((box) => fetchBox(box, time))))
    }

    const index = buildGridIndex(results.flatMap((r) => r.cells))
    const okBoxes = results.filter((r) => r.error === null)
    const failed = results.filter((r) => r.error !== null)

    if (index.size === 0) {
      // Every box failed. Writing an empty blob would overwrite a perfectly
      // good previous run with "no data everywhere" for the next 24 hours.
      monitor('error', 'cron.waves_overview.no_data', {
        time,
        failed: failed.map((r) => `${r.box.id}:${r.error}`).join(','),
      })
      return NextResponse.json({ ok: false, reason: 'no_grid_data' }, { status: 502 })
    }

    const entries: Record<string, WaveOverviewEntry> = {}
    const distances: number[] = []
    for (const bucket of CONDITIONS_BUCKETS) {
      const snap = snapToNearestCell(index, bucket.lat, bucket.lng)
      if (!snap) continue
      entries[bucket.key] = cellToOverviewEntry(snap.cell)
      distances.push(snap.distanceKm)
    }

    const written = await writeWaveOverview({
      version: 1,
      generatedAt: Date.now(),
      dataTime: okBoxes.find((r) => r.time)?.time ?? null,
      boxes: okBoxes.map((r) => r.box.id),
      entries,
    })

    distances.sort((a, b) => a - b)
    const coverage = distances.length / CONDITIONS_BUCKETS.length
    const payload = {
      ok: written,
      time,
      cells: index.size,
      buckets: CONDITIONS_BUCKETS.length,
      snapped: distances.length,
      coverage: Math.round(coverage * 1000) / 1000,
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
      time,
    })
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
