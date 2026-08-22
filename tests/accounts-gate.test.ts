import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// The account stack is dormant: every one of these routes must be a hard 404
// unless ENABLE_ACCOUNTS === 'true'. Prisma/Stripe/monitoring are mocked only
// so importing the route modules never instantiates a real client — the gate
// itself runs before any of them is touched.
vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
}))
vi.mock('@/lib/monitoring', () => ({ monitor: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: { checkout: { sessions: { create: vi.fn() } }, billingPortal: { sessions: { create: vi.fn() } } },
  getAppUrl: () => 'https://wavefinder.test',
  getProPriceId: () => 'price_test',
  getProPriceIds: () => ['price_test'],
  STRIPE_TRIAL_DAYS: 7,
}))

// If the gate ever regressed to a static import, pulling `@/lib/auth` in would
// be the first thing these modules do — these spies prove it does not happen
// on the gated-off path.
const sessionSpy = vi.fn()
vi.mock('@/lib/session', () => {
  sessionSpy()
  return { getServerSession: vi.fn(), requireUser: vi.fn() }
})

import { GET as authGet, POST as authPost } from '@/app/api/auth/[...all]/route'
import { GET as accountGet } from '@/app/api/account/route'
import { POST as checkoutPost } from '@/app/api/billing/checkout/route'
import { POST as portalPost } from '@/app/api/billing/portal/route'
import { POST as webhookPost } from '@/app/api/stripe/webhook/route'

function post(url: string) {
  return new Request(url, { method: 'POST', body: '{}' })
}

describe('account routes are 404 unless ENABLE_ACCOUNTS is enabled', () => {
  const ORIGINAL = process.env.ENABLE_ACCOUNTS

  beforeEach(() => {
    delete process.env.ENABLE_ACCOUNTS
    sessionSpy.mockClear()
  })

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ENABLE_ACCOUNTS
    else process.env.ENABLE_ACCOUNTS = ORIGINAL
  })

  const cases: [string, () => Promise<Response>][] = [
    ['GET /api/auth/[...all]', () => authGet(new Request('https://wavefinder.test/api/auth/session'))],
    ['POST /api/auth/[...all]', () => authPost(post('https://wavefinder.test/api/auth/sign-in/email'))],
    ['GET /api/account', () => accountGet()],
    ['POST /api/billing/checkout', () => checkoutPost(post('https://wavefinder.test/api/billing/checkout'))],
    ['POST /api/billing/portal', () => portalPost()],
    [
      'POST /api/stripe/webhook',
      () =>
        webhookPost(
          new Request('https://wavefinder.test/api/stripe/webhook', {
            method: 'POST',
            headers: { 'stripe-signature': 'sig' },
            body: '{}',
          }),
        ),
    ],
  ]

  for (const [name, call] of cases) {
    it(`${name} returns 404 when the flag is unset`, async () => {
      const res = await call()
      expect(res.status).toBe(404)
      expect(await res.json()).toMatchObject({ error: 'Not found' })
    })

    it(`${name} returns 404 when the flag is not exactly "true"`, async () => {
      process.env.ENABLE_ACCOUNTS = '1'
      const res = await call()
      expect(res.status).toBe(404)
    })
  }

  it('never resolves a session while the gate is closed', async () => {
    await accountGet()
    await portalPost()
    expect(sessionSpy).not.toHaveBeenCalled()
  })
})
