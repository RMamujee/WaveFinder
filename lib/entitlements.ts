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
