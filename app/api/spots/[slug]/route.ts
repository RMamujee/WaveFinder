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
  let spot
  try {
    spot = await prisma.surfSpot.findUnique({ where: { slug } })
  } catch (err) {
    console.error('[api/spots/[slug]] findUnique failed', err)
    return NextResponse.json({ error: 'Failed to load spot' }, { status: 500 })
  }

  if (!spot) {
    return NextResponse.json({ error: 'Spot not found' }, { status: 404 })
  }

  return NextResponse.json(spot)
}
