import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ spotId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { spotId } = await params

  await prisma.savedSpot.deleteMany({
    where: { userId: session.user.id, spotId },
  })

  return NextResponse.json({ success: true })
}
