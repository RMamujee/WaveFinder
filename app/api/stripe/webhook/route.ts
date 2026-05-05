import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { monitor } from '@/lib/monitoring'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

function unixToDate(value: number | null | undefined) {
  return value ? new Date(value * 1000) : null
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id

  const subscriptionItem = subscription.items.data[0]
  const priceId = subscriptionItem?.price.id ?? null
  const userId = subscription.metadata.userId
  const where = userId ? { id: userId } : { stripeCustomerId: customerId }

  await prisma.user.update({
    where,
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionStatus: subscription.status,
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: unixToDate(subscriptionItem?.current_period_end),
      stripeTrialEndsAt: unixToDate(subscription.trial_end),
    },
  })
}

export async function POST(req: Request) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe webhook is not configured' }, { status: 503 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      await req.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    )
  } catch (error) {
    monitor('warn', 'stripe.webhook.invalid_signature', { message: error instanceof Error ? error.message : 'unknown' })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const checkout = event.data.object as Stripe.Checkout.Session
        if (checkout.subscription) {
          const subscription = await stripe.subscriptions.retrieve(String(checkout.subscription))
          await syncSubscription(subscription)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(event.data.object as Stripe.Subscription)
        break
      default:
        break
    }
  } catch (error) {
    monitor('error', 'stripe.webhook.sync_failed', {
      eventType: event.type,
      message: error instanceof Error ? error.message : 'unknown',
    })
    return NextResponse.json({ error: 'Webhook sync failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
