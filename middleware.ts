import { NextRequest, NextResponse } from 'next/server'

// Per-edge-node in-memory rate limiter.
// For global rate limiting across all Vercel edge nodes, replace with Upstash Redis.
const WINDOW_MS = 60_000   // 1 minute
const MAX_REQUESTS = 80    // requests per IP per window on API routes

const store = new Map<string, { count: number; resetAt: number }>()

// Prune stale entries every 200 requests to prevent unbounded memory growth
let pruneCounter = 0
function maybeprune() {
  if (++pruneCounter < 200) return
  pruneCounter = 0
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}

function buildCSP(nonce: string): string {
  return [
    "default-src 'self'",
    // nonce covers Next.js inline hydration scripts; strict-dynamic trusts scripts they load
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://maps.wikimedia.org https://tile.openstreetmap.org https://server.arcgisonline.com https://*.arcgisonline.com https://*.arcgis.com https://*.basemaps.cartocdn.com https://cartodb-basemaps-*.global.ssl.fastly.net",
    "connect-src 'self' https://*.open-meteo.com https://api.open-meteo.com https://www.ndbc.noaa.gov https://tidesandcurrents.noaa.gov https://www.waterqualitydata.us https://server.arcgisonline.com https://*.arcgisonline.com https://*.basemaps.cartocdn.com",
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
    "worker-src blob:",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ')
}

export function middleware(req: NextRequest) {
  const isApiRoute = req.nextUrl.pathname.startsWith('/api/')

  // ── Rate limiting (API routes only) ──────────────────────────────────────────
  if (isApiRoute) {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      '0.0.0.0'

    const now = Date.now()
    maybeprune()

    const entry = store.get(ip)
    if (!entry || now > entry.resetAt) {
      store.set(ip, { count: 1, resetAt: now + WINDOW_MS })
      return NextResponse.next()
    }

    entry.count++

    if (entry.count > MAX_REQUESTS) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(MAX_REQUESTS),
            'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
          },
        }
      )
    }

    return NextResponse.next()
  }

  // ── Nonce-based CSP (page routes) ────────────────────────────────────────────
  // Generate a per-request nonce; Next.js reads x-nonce to attribute its own
  // inline hydration scripts, eliminating the need for 'unsafe-inline'.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', buildCSP(nonce))

  return response
}

export const config = {
  matcher: [
    // Rate-limit all API routes
    '/api/:path*',
    // Set nonce-based CSP on page routes; skip Next.js static assets and prefetch requests
    {
      source: '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
