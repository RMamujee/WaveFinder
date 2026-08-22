import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUrl, stripe } from '@/lib/stripe'

export async function POST() {
  // Dormant account stack — unreachable unless explicitly enabled. See the note
  // in app/api/auth/[...all]/route.ts.
  if (process.env.ENABLE_ACCOUNTS !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Lazy: `@/lib/session` pulls in `@/lib/auth`, which throws at module load
  // without BETTER_AUTH_SECRET in production.
  const { getServerSession } = await import('@/lib/session')

  const session = await getServerSession()
  if (!session?.user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  // TODO: require session.user.emailVerified here once email verification is
  // enforced (no email provider is wired yet, so we cannot gate on it today).
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
