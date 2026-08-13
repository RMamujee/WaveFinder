import { NextResponse } from 'next/server'
import { monitor } from '@/lib/monitoring'

/**
 * Cache headers for a CDN-cacheable route handler.
 *
 * THE STALE WINDOW IS THE IMPORTANT NUMBER, and it is easy to set far too low.
 * `stale-while-revalidate` only covers the period *after* `s-maxage` lapses:
 * once both elapse with no traffic, the entry is gone and the next visitor
 * blocks on a full regeneration. The conditions payload ran 180 s fresh + 60 s
 * stale, so any 4-minute gap between requests — routine on a surf app outside
 * a swell — cost somebody the entire Open-Meteo fan-out. Measured in
 * production, that is a 4.7 s response staring at grey "No data" pins.
 *
 * Polling across an expiry confirms SWR itself does work through Vercel's edge
 * (`X-Vercel-Cache: STALE`, 0.52 s, at age 185 s). It is the window that was
 * too tight, not the mechanism that was missing.
 *
 * The browser still receives `public, max-age=0, must-revalidate` — Next
 * rewrites the client-facing header. `Vercel-CDN-Cache-Control` and
 * `CDN-Cache-Control` are the CDN-tier headers, set explicitly so the caching
 * intent survives a refactor of the client-facing one and is legible without
 * knowing that Vercel consumes `s-maxage` from `Cache-Control`.
 *
 * @param maxAge          seconds the entry is fresh
 * @param staleWhileRevalidate  seconds an expired entry may still be served
 *                              while it refreshes behind the request. Set this
 *                              well above the expected gap between requests.
 */
export function cdnCacheHeaders(
  maxAge: number,
  staleWhileRevalidate: number
): Record<string, string> {
  const directive = `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`
  return {
    'Cache-Control': directive,
    'CDN-Cache-Control': directive,
    'Vercel-CDN-Cache-Control': directive,
  }
}

export function handleRouteError(error: unknown, event: string) {
  // Pass the raw error so monitor() can forward an Error (with stack) to Sentry
  // as a captured exception; non-Error values still log/serialize cleanly.
  monitor('error', event, { error })
  return NextResponse.json({ error: 'Internal error' }, { status: 500 })
}
