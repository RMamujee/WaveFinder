import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const alerts = await prisma.spotAlert.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(alerts)
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { spotId, spotName, minRating, email } = await req.json()
  if (!spotId || !spotName || !minRating || !email) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const alert = await prisma.spotAlert.upsert({
    where: { userId_spotId: { userId: session.user.id, spotId } },
    create: { userId: session.user.id, spotId, spotName, minRating, email, active: true },
    update: { minRating, email, active: true },
  })
  return NextResponse.json(alert)
}
