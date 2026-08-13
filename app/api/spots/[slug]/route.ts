import { NextResponse } from 'next/server'
import { getSpotBySlug } from '@/lib/spots/static-store'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }

  const spot = getSpotBySlug(slug)

  if (!spot) {
    return NextResponse.json({ error: 'Spot not found' }, { status: 404 })
  }

  // This route's response has historically carried no bottomType — keep that
  // exact shape (the store precomputes bottomType, so strip it here).
  const { bottomType: _bottomType, ...rest } = spot
  void _bottomType
  return NextResponse.json(rest)
}
