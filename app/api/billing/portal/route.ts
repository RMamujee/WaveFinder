import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/session'
import { getAppUrl, stripe } from '@/lib/stripe'

export async function POST() {
  const session = await getServerSession()
  if (!session?.user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  if (!stripe) return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  })
  if (!user?.stripeCustomerId) return NextResponse.json({ error: 'No billing account found' }, { status: 404 })

  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${getAppUrl()}/dashboard`,
  })

  return NextResponse.json({ url: portal.url })
}
