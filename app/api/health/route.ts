import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', db: 'connected', ts: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json(
      { status: 'error', db: 'unreachable', error: String(err) },
      { status: 503 }
    )
  }
}
