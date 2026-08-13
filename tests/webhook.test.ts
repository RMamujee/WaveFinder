import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// The webhook route imports prisma, monitoring and stripe at module load. Mock
// them so importing the route never instantiates a Prisma client, hits Sentry,
// or constructs a real Stripe client. The stripe mock exposes a controllable
// webhooks.constructEvent so we can drive the signature-verification branches.
// Declared via vi.hoisted so it is initialised before the hoisted vi.mock
// factory below references it.
const { constructEvent } = vi.hoisted(() => ({ constructEvent: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
}))
vi.mock('@/lib/monitoring', () => ({
  monitor: vi.fn(),
}))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent },
    subscriptions: { retrieve: vi.fn() },
  },
  STRIPE_PRO_MONTHLY_PRICE_ID: 'price_test',
}))

import { POST } from '@/app/api/stripe/webhook/route'

function makeRequest(headers: Record<string, string> = {}, body = '{}') {
  return new Request('https://wavefinder.test/api/stripe/webhook', {
    method: 'POST',
    headers,
    body,
  })
}

describe('POST /api/stripe/webhook', () => {
  const ORIGINAL_SECRET = process.env.STRIPE_WEBHOOK_SECRET

  beforeEach(() => {
    constructEvent.mockReset()
  })

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.STRIPE_WEBHOOK_SECRET
    else process.env.STRIPE_WEBHOOK_SECRET = ORIGINAL_SECRET
  })

  it('refuses with 503 when STRIPE_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET

    const res = await POST(makeRequest({ 'stripe-signature': 'sig' }))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body).toMatchObject({ error: 'Stripe webhook is not configured' })
    // Signature verification must never be attempted when unconfigured.
    expect(constructEvent).not.toHaveBeenCalled()
  })

  it('returns 400 when the stripe-signature header is missing', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'

    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toMatchObject({ error: 'Missing signature' })
    expect(constructEvent).not.toHaveBeenCalled()
  })

  it('returns 400 when the signature is invalid', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    constructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature')
    })

    const res = await POST(
      makeRequest({ 'stripe-signature': 'invalid' }, '{"id":"evt_1"}'),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toMatchObject({ error: 'Invalid signature' })
    expect(constructEvent).toHaveBeenCalledOnce()
  })

  it('accepts a valid signature for an unhandled event type', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    constructEvent.mockReturnValue({
      id: 'evt_unhandled',
      type: 'invoice.paid',
      data: { object: {} },
    })

    const res = await POST(
      makeRequest({ 'stripe-signature': 'good' }, '{"id":"evt_unhandled"}'),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ received: true })
  })
})
