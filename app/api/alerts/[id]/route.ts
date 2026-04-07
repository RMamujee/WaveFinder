import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const result = await prisma.spotAlert.deleteMany({ where: { id, userId: session.user.id } })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { active } = await req.json()
  const result = await prisma.spotAlert.updateMany({
    where: { id, userId: session.user.id },
    data: { active },
  })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
