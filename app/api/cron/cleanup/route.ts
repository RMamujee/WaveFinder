import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { monitor } from '@/lib/monitoring'

export const dynamic = 'force-dynamic'

// Constant-time secret comparison. `===` on strings short-circuits at the first
// differing byte, which leaks the secret's prefix to anyone who can measure
// response times across many attempts. timingSafeEqual needs equal-length
// buffers, so the length check is done first and deliberately non-secret (the
// length of CRON_SECRET is not the part worth protecting).
function secretMatches(provided: string | null, expected: string) {
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// Daily Vercel cron (see vercel.json) that purges expired auth rows —
// better-auth never deletes them, so Session/Verification grow unbounded.
// Vercel invokes cron paths with `Authorization: Bearer ${CRON_SECRET}`.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || !secretMatches(req.headers.get('authorization'), `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const [sessions, verifications] = await prisma.$transaction([
      prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.verification.deleteMany({ where: { expiresAt: { lt: now } } }),
    ])

    monitor('info', 'cron.cleanup.completed', {
      sessions: sessions.count,
      verifications: verifications.count,
    })
    return NextResponse.json({
      ok: true,
      deleted: { sessions: sessions.count, verifications: verifications.count },
    })
  } catch (err) {
    monitor('error', 'cron.cleanup.failed', {
      error: err instanceof Error ? err : String(err),
    })
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
