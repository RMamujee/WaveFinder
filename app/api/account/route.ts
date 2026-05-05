import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { billingLabel, hasProAccess } from '@/lib/entitlements'
import { getServerSession } from '@/lib/session'

export async function GET() {
  const session = await getServerSession()
  if (!session?.user) {
    return NextResponse.json({ user: null, plan: 'Free', hasProAccess: false, canManageBilling: false })
  }

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
  })
}
