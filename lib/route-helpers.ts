import { NextResponse } from 'next/server'
import { monitor } from '@/lib/monitoring'

/**
 * Cache headers for a CDN-cacheable route handler.
 *
 * A plain `Cache-Control: s-maxage=…, stale-while-revalidate=…` on a Next.js
 * route handler does NOT give you stale-while-revalidate on Vercel. Measured
 * against production: the response reaches the browser as
 * `public, max-age=0, must-revalidate`, and polling `/api/spots?withConditions`
 * across the expiry showed `X-Vercel-Cache: HIT` (0.27 s) flip straight to
 * `MISS` (4.67 s) — never `STALE`. So every time an entry expired, one unlucky
 * visitor blocked on the full Open-Meteo fan-out and watched a map of grey
 * "No data" pins for ~5 s.
 *
 * `Vercel-CDN-Cache-Control` is the header Vercel's edge actually honours and
 * does not rewrite; `CDN-Cache-Control` covers any CDN in front of it. With
 * these set, an expired entry is served stale immediately and refreshed in the
 * background, so nobody waits for a regeneration.
 *
 * @param maxAge          seconds the entry is fresh
 * @param staleWhileRevalidate  seconds an expired entry may still be served
 *                              while it refreshes behind the request
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
