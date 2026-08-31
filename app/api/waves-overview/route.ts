import { NextResponse } from 'next/server'
import { lookupWaveGrid, readWaveGrid } from '@/lib/api/ww3-overview'
import { cdnCacheHeaders, handleRouteError } from '@/lib/route-helpers'

// Reads the Runtime Cache on every invocation — there is no request input to
// key a static render on, so without this Next would happily freeze the first
// response and serve it forever instead of re-reading the cron's latest write.
export const dynamic = 'force-dynamic'

/**
 * The map's animated swell-flow layer reads this — the single forecast hour
 * nearest to now, at raw WaveWatch III grid resolution (not the per-spot
 * conditions the rest of the app uses).
 *
 * `204 No Content` — deliberately not a JSON error body — whenever there is
 * nothing current to draw: the cron has never run, the Runtime Cache is
 * unavailable in this environment, or every stored hour is more than
 * `WW3_MAX_TIMESTEP_GAP_MS` (3 h) from now. The client's contract for this
 * route is "hide the layer, never show an error state", so a clean empty
 * response is the correct shape for that, not a 404/500 the client would have
 * to specifically ignore.
 */
export async function GET() {
  try {
    const grid = await readWaveGrid()
    const hit = lookupWaveGrid(grid)

    if (!hit) {
      // Short-lived even though it's "no data": a cron run that lands a
      // minute from now should not be masked behind the long success TTL
      // below for half an hour.
      return new NextResponse(null, { status: 204, headers: cdnCacheHeaders(60, 300) })
    }

    return NextResponse.json(
      { time: hit.time, cells: hit.cells },
      // The cron runs once a day, so a long stale window is the point — see
      // lib/route-helpers.ts. 30 min fresh / 1 h stale-while-revalidate.
      { headers: cdnCacheHeaders(1800, 3600) }
    )
  } catch (err) {
    return handleRouteError(err, 'api.waves_overview.failed')
  }
}
