import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { monitor } from '@/lib/monitoring'
import { redis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

// Which components are up is infrastructure detail an anonymous caller has no
// need for — "redis: unreachable" tells an attacker the rate limiter has fallen
// back to per-instance memory, which is exactly when it is cheapest to abuse.
// Operators get the breakdown by presenting the cron secret; everyone else gets
// the verdict. Compared in constant time for the same reason /api/cron/cleanup
// does: `===` on the same secret would leak its prefix byte by byte.
function isOperator(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const provided = req.headers.get('authorization')
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(`Bearer ${secret}`)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// A slow-but-alive Redis must map to 'degraded', not stall the whole health
// response past the uptime monitor's own timeout (which would read as the
// entire app being down even though the DB — the only hard dependency — is fine).
const REDIS_PING_TIMEOUT_MS = 2000

// Redis backs rate limiting and webhook idempotency; an outage degrades both
// silently (limiter falls back to per-instance memory), so monitors need to
// see it here — but it must not 503 the app, the DB is the only hard dependency.
async function checkRedis(): Promise<'connected' | 'unreachable' | 'unconfigured'> {
  if (!redis) return 'unconfigured'
  try {
    await Promise.race([
      redis.ping(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('redis ping timeout')), REDIS_PING_TIMEOUT_MS)
      ),
    ])
    return 'connected'
  } catch (err) {
    monitor('error', 'health.redis.unreachable', {
      message: err instanceof Error ? err.message : 'unknown',
    })
    return 'unreachable'
  }
}

export async function GET(req: Request) {
  const [db, redisStatus] = await Promise.all([
    prisma.$queryRaw`SELECT 1`.then(
      () => 'connected' as const,
      (err: unknown) => {
        monitor('error', 'health.db.unreachable', {
          message: err instanceof Error ? err.message : 'unknown',
        })
        return 'unreachable' as const
      }
    ),
    checkRedis(),
  ])

  // Both components are still pinged on every request — the monitor() calls
  // above are what alerting reads. Only the wire response is trimmed.
  const breakdown = isOperator(req) ? { db, redis: redisStatus } : {}

  if (db === 'unreachable') {
    return NextResponse.json(
      { status: 'error', ...breakdown },
      { status: 503 }
    )
  }

  return NextResponse.json({
    status: redisStatus === 'unreachable' ? 'degraded' : 'ok',
    ...breakdown,
    ts: new Date().toISOString(),
  })
}
