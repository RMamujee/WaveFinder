import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { monitor } from '@/lib/monitoring'
import { redis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

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

export async function GET() {
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

  if (db === 'unreachable') {
    return NextResponse.json(
      { status: 'error', db, redis: redisStatus },
      { status: 503 }
    )
  }

  return NextResponse.json({
    status: redisStatus === 'unreachable' ? 'degraded' : 'ok',
    db,
    redis: redisStatus,
    ts: new Date().toISOString(),
  })
}
