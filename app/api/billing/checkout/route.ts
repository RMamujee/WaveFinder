import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUrl, getProPriceId, STRIPE_TRIAL_DAYS, stripe, type ProPlan } from '@/lib/stripe'
import { monitor } from '@/lib/monitoring'

export async function POST(req: Request) {
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

  let plan: ProPlan = 'monthly'
  try {
    const body = await req.json()
    if (body?.plan === 'annual') plan = 'annual'
  } catch {
    // No/invalid body — default to monthly.
  }

  const priceId = getProPriceId(plan)
  if (!priceId) return NextResponse.json({ error: 'Stripe price is not configured' }, { status: 503 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, stripeCustomerId: true, stripeSubscriptionId: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  let customerId = user.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: user.id },
    })
    customerId = customer.id
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customerId },
    })
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: STRIPE_TRIAL_DAYS,
      metadata: { userId: user.id },
    },
    allow_promotion_codes: true,
    success_url: `${getAppUrl()}/dashboard?checkout=success`,
    cancel_url: `${getAppUrl()}/pricing?checkout=cancelled`,
  })

  monitor('info', 'stripe.checkout.created', { userId: user.id, customerId, plan })
  return NextResponse.json({ url: checkout.url })
}
