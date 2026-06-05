import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { ipAddress } from '@vercel/functions'

const WINDOW_MS = 60_000   // 1 minute

const RATE_LIMITS: { pattern: RegExp; limit: number }[] = [
  { pattern: /^\/api\/auth(?:\/|$)/, limit: 10 },
  { pattern: /^\/api\/debug(?:\/|$)/, limit: 10 },
  { pattern: /^\/api\/webcams(?:\/|$)/, limit: 20 },
  { pattern: /^\/api\/water-quality(?:\/|$)/, limit: 30 },
  { pattern: /^\/api\/best-spots(?:\/|$)/, limit: 30 },
  { pattern: /^\/api\/forecast(?:\/|$)/, limit: 45 },
  { pattern: /^\/api\/surf-reports(?:\/|$)/, limit: 45 },
  { pattern: /^\/api\/alerts(?:\/|$)/, limit: 60 },
  { pattern: /^\/api\/health(?:\/|$)/, limit: 120 },
  { pattern: /^\/api\/spots(?:\/|$)/, limit: 120 },
]
const DEFAULT_LIMIT = 80

const store = new Map<string, { count: number; resetAt: number }>()
const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL ??
  process.env.KV_REST_API_URL ??
  process.env.WaveFinderStorage_KV_REST_API_URL
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN ??
  process.env.KV_REST_API_TOKEN ??
  process.env.WaveFinderStorage_KV_REST_API_TOKEN
const redis = redisUrl && redisToken
  ? new Redis({ url: redisUrl, token: redisToken })
  : null

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

function rateLimitKey(req: NextRequest) {
  const ip =
    ipAddress(req) ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '0.0.0.0'
  return `${ip}:${req.nextUrl.pathname}`
}

function limitForPath(pathname: string) {
  return RATE_LIMITS.find(({ pattern }) => pattern.test(pathname))?.limit ?? DEFAULT_LIMIT
}

async function checkRedisLimit(key: string) {
  if (!redis) return null

  const redisKey = `rl:${key}`
  const count = await redis.incr(redisKey)
  if (count === 1) await redis.pexpire(redisKey, WINDOW_MS)
  const ttl = await redis.pttl(redisKey)
  const resetAt = Date.now() + Math.max(ttl, 0)
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
  const key = rateLimitKey(req)
  const limit = limitForPath(req.nextUrl.pathname)
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
