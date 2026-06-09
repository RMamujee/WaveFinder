import { NextRequest, NextResponse } from 'next/server'
import { ipAddress } from '@vercel/functions'
import { redis } from '@/lib/redis'

const WINDOW_MS = 60_000   // 1 minute

const RATE_LIMITS: { bucket: string; pattern: RegExp; limit: number }[] = [
  { bucket: 'auth', pattern: /^\/api\/auth(?:\/|$)/, limit: 10 },
  { bucket: 'debug', pattern: /^\/api\/debug(?:\/|$)/, limit: 10 },
  { bucket: 'webcams', pattern: /^\/api\/webcams(?:\/|$)/, limit: 20 },
  { bucket: 'water-quality', pattern: /^\/api\/water-quality(?:\/|$)/, limit: 30 },
  { bucket: 'best-spots', pattern: /^\/api\/best-spots(?:\/|$)/, limit: 30 },
  { bucket: 'forecast', pattern: /^\/api\/forecast(?:\/|$)/, limit: 45 },
  { bucket: 'surf-reports', pattern: /^\/api\/surf-reports(?:\/|$)/, limit: 45 },
  { bucket: 'alerts', pattern: /^\/api\/alerts(?:\/|$)/, limit: 60 },
  { bucket: 'health', pattern: /^\/api\/health(?:\/|$)/, limit: 120 },
  { bucket: 'spots', pattern: /^\/api\/spots(?:\/|$)/, limit: 120 },
]
const DEFAULT_RULE = { bucket: 'default', limit: 80 }

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

function rateLimitKey(req: NextRequest, bucket: string) {
  // Only trust the platform-derived IP (Vercel's edge sets x-real-ip itself).
  // Falling back to client-settable headers would let an attacker mint a fresh
  // bucket per request; instead, requests without a platform IP all share one
  // 'unknown' bucket. Keying on the matched rule's bucket (not the raw
  // pathname) keeps cardinality bounded — varying the slug on
  // /api/forecast/[slug] etc. must not reset the counter.
  const ip = ipAddress(req) ?? 'unknown'
  return `${ip}:${bucket}`
}

function ruleForPath(pathname: string) {
  return RATE_LIMITS.find(({ pattern }) => pattern.test(pathname)) ?? DEFAULT_RULE
}

async function checkRedisLimit(key: string) {
  if (!redis) return null

  // Single pipelined round-trip instead of 3 sequential ones — this runs in
  // middleware on every API request, so each extra Redis RTT is added latency
  // on every response (including edge-cached ones).
  const redisKey = `rl:${key}`
  const [count, ttl] = await redis
    .pipeline()
    .incr(redisKey)
    .pttl(redisKey)
    .exec<[number, number]>()
  // First hit of the window (or a key that lost its expiry) pays one extra
  // round-trip to arm the TTL; every other request stays at one.
  if (count === 1 || ttl < 0) await redis.pexpire(redisKey, WINDOW_MS)
  const resetAt = Date.now() + (ttl > 0 ? ttl : WINDOW_MS)
  return { count, resetAt }
}

function checkMemoryLimit(key: string) {
  const now = Date.now()
  maybeprune()

  const entry = store.get(key)
  if (!entry || now > entry.resetAt) {
    const next = { count: 1, resetAt: now + WINDOW_MS }
    store.set(key, next)
    return next
  }

  entry.count++
  return entry
}

export async function proxy(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const now = Date.now()
  const { bucket, limit } = ruleForPath(req.nextUrl.pathname)
  const key = rateLimitKey(req, bucket)
  const entry = await checkRedisLimit(key).catch(() => null) ?? checkMemoryLimit(key)

  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
        },
      }
    )
  }

  const response = NextResponse.next()
  response.headers.set('X-RateLimit-Limit', String(limit))
  response.headers.set('X-RateLimit-Remaining', String(Math.max(0, limit - entry.count)))
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))
  return response
}

export const config = {
  matcher: '/api/:path*',
}
