import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { monitor } from '@/lib/monitoring'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', db: 'connected', ts: new Date().toISOString() })
  } catch (err) {
    monitor('error', 'health.db.unreachable', { message: err instanceof Error ? err.message : 'unknown' })
    return NextResponse.json(
      { status: 'error', db: 'unreachable' },
      { status: 503 }
    )
  }
}
