import Stripe from 'stripe'

export const STRIPE_TRIAL_DAYS = 7

export const STRIPE_PRO_MONTHLY_PRICE_ID = process.env.STRIPE_PRO_MONTHLY_PRICE_ID
export const STRIPE_PRO_ANNUAL_PRICE_ID = process.env.STRIPE_PRO_ANNUAL_PRICE_ID

export type ProPlan = 'monthly' | 'annual'

export function getProPriceId(plan: ProPlan) {
  return plan === 'annual' ? STRIPE_PRO_ANNUAL_PRICE_ID : STRIPE_PRO_MONTHLY_PRICE_ID
}

// Every price id that should confer Pro — used to validate webhook subscriptions.
export function getProPriceIds() {
  return [STRIPE_PRO_MONTHLY_PRICE_ID, STRIPE_PRO_ANNUAL_PRICE_ID].filter(Boolean) as string[]
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null

export function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  ).replace(/\/$/, '')
}

export function getProMonthlyPriceId() {
  return process.env.STRIPE_PRO_MONTHLY_PRICE_ID
}
