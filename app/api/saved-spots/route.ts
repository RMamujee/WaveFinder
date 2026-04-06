import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const saved = await prisma.savedSpot.findMany({
    where: { userId: session.user.id },
    include: { spot: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(saved.map((s) => s.spot))
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { spotId } = await req.json()
  if (!spotId) {
    return NextResponse.json({ error: 'spotId required' }, { status: 400 })
  }

  try {
    const saved = await prisma.savedSpot.create({
      data: { userId: session.user.id, spotId },
    })
    return NextResponse.json(saved, { status: 201 })
  } catch {
    // Unique constraint = already saved
    return NextResponse.json({ error: 'Already saved' }, { status: 409 })
  }
}
