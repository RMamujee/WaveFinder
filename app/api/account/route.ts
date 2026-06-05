import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { billingLabel, hasProAccess } from '@/lib/entitlements'
import { getServerSession } from '@/lib/session'
import { handleRouteError } from '@/lib/route-helpers'

export async function GET() {
  const session = await getServerSession()
  // Personalized billing/identity data — must never be shared/edge-cached.
  const noStore = { 'Cache-Control': 'private, no-store' }
  if (!session?.user) {
    return NextResponse.json(
      { user: null, plan: 'Free', hasProAccess: false, canManageBilling: false },
      { headers: noStore },
    )
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        stripeCustomerId: true,
        stripeSubscriptionStatus: true,
        stripeCurrentPeriodEnd: true,
        stripeTrialEndsAt: true,
      },
    })

    return NextResponse.json({
      user: user ? { id: user.id, email: user.email, name: user.name } : null,
      plan: billingLabel(user),
      hasProAccess: hasProAccess(user),
      canManageBilling: Boolean(user?.stripeCustomerId),
      stripeSubscriptionStatus: user?.stripeSubscriptionStatus ?? null,
      stripeCurrentPeriodEnd: user?.stripeCurrentPeriodEnd ?? null,
      stripeTrialEndsAt: user?.stripeTrialEndsAt ?? null,
    }, { headers: noStore })
  } catch (error) {
    return handleRouteError(error, 'account_error')
  }
}
