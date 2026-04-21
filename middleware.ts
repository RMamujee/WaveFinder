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

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

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

export const config = {
  matcher: '/api/:path*',
}
