import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }
  const spot = await prisma.surfSpot.findUnique({ where: { slug } })

  if (!spot) {
    return NextResponse.json({ error: 'Spot not found' }, { status: 404 })
  }

  return NextResponse.json(spot)
}
