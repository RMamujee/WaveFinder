import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { monitor } from '@/lib/monitoring'

export const dynamic = 'force-dynamic'

// Daily Vercel cron (see vercel.json) that purges expired auth rows —
// better-auth never deletes them, so Session/Verification grow unbounded.
// Vercel invokes cron paths with `Authorization: Bearer ${CRON_SECRET}`.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
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
