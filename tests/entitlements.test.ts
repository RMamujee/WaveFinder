import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// hasProAccess is a pure function, but entitlements.ts also pulls in
// requireProAccess -> @/lib/session and @/lib/prisma at module load. Mock those
// so importing the module never instantiates a Prisma client or touches a DB.
vi.mock('@/lib/session', () => ({
  getServerSession: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: vi.fn() } },
}))

import { hasProAccess, billingLabel } from '@/lib/entitlements'

const FUTURE = () => new Date(Date.now() + 60 * 60 * 1000) // +1h
const PAST = () => new Date(Date.now() - 60 * 60 * 1000) // -1h

describe('hasProAccess', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-05T00:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns false for null / undefined user', () => {
    expect(hasProAccess(null)).toBe(false)
    expect(hasProAccess(undefined)).toBe(false)
  })

  it('returns false when there is no subscription status', () => {
    expect(hasProAccess({})).toBe(false)
    expect(hasProAccess({ stripeSubscriptionStatus: null })).toBe(false)
  })

  it('returns true for active subscription within the current period', () => {
    expect(
      hasProAccess({
        stripeSubscriptionStatus: 'active',
        stripeCurrentPeriodEnd: FUTURE(),
      }),
    ).toBe(true)
  })

  it('returns true for trialing subscription whose trial has not ended', () => {
    expect(
      hasProAccess({
        stripeSubscriptionStatus: 'trialing',
        stripeTrialEndsAt: FUTURE(),
      }),
    ).toBe(true)
  })

  it('returns false for active subscription whose period has expired', () => {
    expect(
      hasProAccess({
        stripeSubscriptionStatus: 'active',
        stripeCurrentPeriodEnd: PAST(),
      }),
    ).toBe(false)
  })

  it('returns false for a canceled subscription even with a future period end', () => {
    expect(
      hasProAccess({
        stripeSubscriptionStatus: 'canceled',
        stripeCurrentPeriodEnd: FUTURE(),
      }),
    ).toBe(false)
  })

  it('returns false for an inactive / unknown status', () => {
    expect(
      hasProAccess({
        stripeSubscriptionStatus: 'inactive',
        stripeCurrentPeriodEnd: FUTURE(),
      }),
    ).toBe(false)
    expect(
      hasProAccess({
        stripeSubscriptionStatus: 'past_due',
        stripeCurrentPeriodEnd: FUTURE(),
      }),
    ).toBe(false)
  })

  it('returns false for active status with no period/trial dates', () => {
    expect(hasProAccess({ stripeSubscriptionStatus: 'active' })).toBe(false)
  })
})

describe('billingLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-05T00:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('labels users without a subscription as Free', () => {
    expect(billingLabel(null)).toBe('Free')
    expect(billingLabel({})).toBe('Free')
  })

  it('labels an active pro subscriber as Pro', () => {
    expect(
      billingLabel({
        stripeSubscriptionStatus: 'active',
        stripeCurrentPeriodEnd: FUTURE(),
      }),
    ).toBe('Pro')
  })

  it('labels a current trial as "Pro trial"', () => {
    expect(
      billingLabel({
        stripeSubscriptionStatus: 'trialing',
        stripeTrialEndsAt: FUTURE(),
      }),
    ).toBe('Pro trial')
  })

  it('labels an expired active subscription as Free', () => {
    expect(
      billingLabel({
        stripeSubscriptionStatus: 'active',
        stripeCurrentPeriodEnd: PAST(),
      }),
    ).toBe('Free')
  })
})
