import { getServerSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

type BillingUser = {
  stripeSubscriptionStatus?: string | null
  stripeCurrentPeriodEnd?: Date | null
  stripeTrialEndsAt?: Date | null
}

const ACTIVE_STATUSES = new Set(['active', 'trialing'])

export function hasProAccess(user: BillingUser | null | undefined) {
  if (!user?.stripeSubscriptionStatus) return false
  if (!ACTIVE_STATUSES.has(user.stripeSubscriptionStatus)) return false

  const now = Date.now()
  const periodEnd = user.stripeCurrentPeriodEnd?.getTime() ?? 0
  const trialEnd = user.stripeTrialEndsAt?.getTime() ?? 0

  return Math.max(periodEnd, trialEnd) > now
}

export function billingLabel(user: BillingUser | null | undefined) {
  if (!user?.stripeSubscriptionStatus) return 'Free'
  if (hasProAccess(user)) return user.stripeSubscriptionStatus === 'trialing' ? 'Pro trial' : 'Pro'
  return 'Free'
}

type RequireProResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 }

export async function requireProAccess(): Promise<RequireProResult> {
  const session = await getServerSession()
  if (!session?.user) return { ok: false, status: 401 }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      stripeSubscriptionStatus: true,
      stripeCurrentPeriodEnd: true,
      stripeTrialEndsAt: true,
    },
  })

  return hasProAccess(user) ? { ok: true, userId: session.user.id } : { ok: false, status: 403 }
}
