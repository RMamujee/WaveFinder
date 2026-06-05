import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { Redis } from '@upstash/redis'
import { prisma } from '@/lib/prisma'
import { monitor } from '@/lib/monitoring'
import { stripe, STRIPE_PRO_MONTHLY_PRICE_ID } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL ??
  process.env.KV_REST_API_URL ??
  process.env.WaveFinderStorage_KV_REST_API_URL
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN ??
  process.env.KV_REST_API_TOKEN ??
  process.env.WaveFinderStorage_KV_REST_API_TOKEN
const redis = redisUrl && redisToken
  ? new Redis({ url: redisUrl, token: redisToken })
  : null

const EVENT_TTL_SECONDS = 60 * 60 * 24 // 24h

// Returns true if this event was already processed (duplicate). If Redis is not
// configured, idempotency is skipped gracefully and this always returns false.
async function isDuplicateEvent(eventId: string) {
  if (!redis) return false
  try {
    const result = await redis.set(`stripe:evt:${eventId}`, '1', {
      nx: true,
      ex: EVENT_TTL_SECONDS,
    })
    // `set` with NX returns 'OK' when the key was created, null when it already existed.
    return result === null
  } catch (error) {
    // On Redis failure, do not block processing — fail open.
    monitor('warn', 'stripe.webhook.idempotency_unavailable', {
      eventId,
      message: error instanceof Error ? error.message : 'unknown',
    })
    return false
  }
}

// Release a claimed idempotency key so a failed sync can be retried by Stripe.
async function releaseEvent(eventId: string) {
  if (!redis) return
  try {
    await redis.del(`stripe:evt:${eventId}`)
  } catch {
    // Best-effort — the 24h TTL will expire the key anyway.
  }
}

function unixToDate(value: number | null | undefined) {
  return value ? new Date(value * 1000) : null
}

// Resolve the WaveFinder user for a subscription using stripeCustomerId as the
// source of truth. metadata.userId is only honored for first-time linkage on
// checkout (allowLink), and only when customerId is not already attached to a
// different user.
async function syncSubscription(subscription: Stripe.Subscription, allowLink = false) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id

  const subscriptionItem = subscription.items.data[0]
  const priceId = subscriptionItem?.price.id ?? null

  // Source of truth: find the user already linked to this Stripe customer.
  let user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  })

  // First-time linkage path (checkout.session.completed only): if no user is
  // linked yet, fall back to metadata.userId — but verify the customer is not
  // already attached to a different user before linking.
  if (!user && allowLink) {
    const metadataUserId = subscription.metadata.userId
    if (metadataUserId) {
      const candidate = await prisma.user.findUnique({
        where: { id: metadataUserId },
        select: { id: true, stripeCustomerId: true },
      })
      if (candidate && (candidate.stripeCustomerId === null || candidate.stripeCustomerId === customerId)) {
        user = { id: candidate.id }
      } else {
        monitor('warn', 'stripe.webhook.link_rejected', {
          customerId,
          metadataUserId,
          reason: candidate ? 'customer_belongs_to_other_user' : 'metadata_user_not_found',
        })
      }
    }
  }

  if (!user) {
    monitor('warn', 'stripe.webhook.user_not_found', {
      customerId,
      subscriptionId: subscription.id,
    })
    return
  }

  // Price validation: only grant Pro for active/trialing subscriptions whose
  // price matches the configured Pro monthly price. Otherwise sync the raw
  // status but never let an unexpected price confer Pro entitlement.
  const isProGrantStatus = subscription.status === 'active' || subscription.status === 'trialing'
  const priceMatches = STRIPE_PRO_MONTHLY_PRICE_ID
    ? priceId === STRIPE_PRO_MONTHLY_PRICE_ID
    : false
  if (isProGrantStatus && !priceMatches) {
    monitor('warn', 'stripe.webhook.price_mismatch', {
      customerId,
      subscriptionId: subscription.id,
      priceId,
      expected: STRIPE_PRO_MONTHLY_PRICE_ID ?? null,
    })
  }
  const grantPro = isProGrantStatus && priceMatches

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionStatus: grantPro ? subscription.status : 'inactive',
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

  // Idempotency: skip events we have already processed. Skipped gracefully when
  // Redis is not configured.
  if (await isDuplicateEvent(event.id)) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const checkout = event.data.object as Stripe.Checkout.Session
        if (checkout.subscription) {
          const subscription = await stripe.subscriptions.retrieve(String(checkout.subscription))
          // First-time linkage is only permitted on checkout completion.
          await syncSubscription(subscription, true)
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
    // Release the idempotency claim so Stripe's automatic retry can re-process
    // this event (otherwise a transient failure would be permanently dropped).
    await releaseEvent(event.id)
    monitor('error', 'stripe.webhook.sync_failed', {
      eventType: event.type,
      message: error instanceof Error ? error.message : 'unknown',
    })
    return NextResponse.json({ error: 'Webhook sync failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
