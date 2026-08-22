import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'

let ipCounter = 0

// Each call gets a unique client IP so the module-level in-memory rate-limit
// store never bleeds counts between assertions. Redis is not configured in the
// test environment, so proxy() always falls back to the in-memory limiter.
// x-real-ip is the platform-set header that ipAddress() reads — the limiter
// must ignore everything else.
function makeRequest(
  pathname: string,
  ip = `10.0.0.${++ipCounter % 250}-${ipCounter}`,
  extraHeaders: Record<string, string> = {}
) {
  return new NextRequest(`https://wavefinder.test${pathname}`, {
    headers: { 'x-real-ip': ip, ...extraHeaders },
  })
}

async function limitFor(pathname: string): Promise<number> {
  const res = await proxy(makeRequest(pathname))
  return Number(res.headers.get('X-RateLimit-Limit'))
}

describe('proxy rate limiter — per-path limits', () => {
  it('does not rate-limit non-/api/ paths', async () => {
    const res = await proxy(makeRequest('/dashboard'))
    expect(res.status).toBe(200)
    expect(res.headers.get('X-RateLimit-Limit')).toBeNull()
  })

  it('applies the /api/auth = 10 rule', async () => {
    expect(await limitFor('/api/auth')).toBe(10)
    expect(await limitFor('/api/auth/sign-in')).toBe(10)
  })

  it('applies the documented per-pattern limits', async () => {
    expect(await limitFor('/api/debug')).toBe(10)
    expect(await limitFor('/api/water-quality')).toBe(30)
    expect(await limitFor('/api/best-spots')).toBe(30)
    expect(await limitFor('/api/forecast')).toBe(45)
    expect(await limitFor('/api/surf-reports')).toBe(45)
    expect(await limitFor('/api/alerts')).toBe(60)
    expect(await limitFor('/api/health')).toBe(120)
    expect(await limitFor('/api/spots')).toBe(120)
  })

  it('applies the panels = 40 rule to the spot-page condition endpoints', async () => {
    for (const path of [
      '/api/air-quality',
      '/api/amenities',
      '/api/earthquakes',
      '/api/coastal-alerts',
      '/api/river-runoff',
      '/api/seasonal',
      '/api/solar',
    ]) {
      expect(await limitFor(path), path).toBe(40)
    }
    expect(await limitFor('/api/solar/malibu')).toBe(40)
  })

  it('keeps the tighter pre-existing limits for panels that already had a rule', async () => {
    // `panels` is listed last so the first-match lookup still finds these.
    expect(await limitFor('/api/water-quality/malibu')).toBe(30)
    expect(await limitFor('/api/surf-reports/malibu')).toBe(45)
  })

  it('falls back to the default limit (80) for unmatched /api/ paths', async () => {
    expect(await limitFor('/api/something-else')).toBe(80)
  })

  it('exempts self-authenticating callers from IP rate limiting entirely', async () => {
    // Stripe signs its webhooks and Vercel's cron presents CRON_SECRET, so an
    // IP bucket could only throttle the one legitimate sender. No counter is
    // kept for them at all — hence no rate-limit headers either.
    const ip = `169.254.10.${++ipCounter}`
    for (const path of ['/api/stripe/webhook', '/api/cron/cleanup']) {
      for (let i = 0; i < 200; i++) {
        const res = await proxy(makeRequest(path, ip))
        if (res.status !== 200) throw new Error(`${path} was limited on request ${i + 1}`)
      }
      const res = await proxy(makeRequest(path, ip))
      expect(res.status).toBe(200)
      expect(res.headers.get('X-RateLimit-Limit')).toBeNull()
    }
  })

  it('only matches a pattern at a segment boundary', async () => {
    // /api/authentication must NOT match the /api/auth (=10) rule; it should
    // fall through to the default limit of 80.
    expect(await limitFor('/api/authentication')).toBe(80)
  })
})

describe('proxy rate limiter — 429 behaviour', () => {
  it('returns 429 with Retry-After once the limit is exceeded', async () => {
    const ip = `198.51.100.${++ipCounter}`
    const path = '/api/auth' // limit = 10

    // First 10 requests are allowed.
    for (let i = 0; i < 10; i++) {
      const ok = await proxy(makeRequest(path, ip))
      expect(ok.status).toBe(200)
    }

    // The 11th exceeds the limit.
    const blocked = await proxy(makeRequest(path, ip))
    expect(blocked.status).toBe(429)

    const retryAfter = blocked.headers.get('Retry-After')
    expect(retryAfter).not.toBeNull()
    expect(Number(retryAfter)).toBeGreaterThan(0)
    expect(blocked.headers.get('X-RateLimit-Limit')).toBe('10')
    expect(blocked.headers.get('X-RateLimit-Remaining')).toBe('0')

    const body = await blocked.json()
    expect(body).toMatchObject({ error: 'Too many requests' })
  })

  it('exposes a decreasing remaining count below the limit', async () => {
    const ip = `203.0.113.${++ipCounter}`
    const path = '/api/water-quality' // limit = 30

    const first = await proxy(makeRequest(path, ip))
    const second = await proxy(makeRequest(path, ip))

    expect(first.headers.get('X-RateLimit-Limit')).toBe('30')
    expect(Number(first.headers.get('X-RateLimit-Remaining'))).toBe(29)
    expect(Number(second.headers.get('X-RateLimit-Remaining'))).toBe(28)
  })
})

describe('proxy rate limiter — key derivation', () => {
  it('shares one bucket across all paths matching the same rule (slug variation cannot reset the counter)', async () => {
    const ip = `192.0.2.${++ipCounter}`

    const first = await proxy(makeRequest('/api/forecast/malibu', ip))
    const second = await proxy(makeRequest('/api/forecast/pipeline', ip))

    expect(Number(first.headers.get('X-RateLimit-Remaining'))).toBe(44)
    expect(Number(second.headers.get('X-RateLimit-Remaining'))).toBe(43)
  })

  it('keeps separate counters for different rule buckets from the same IP', async () => {
    const ip = `192.0.2.${++ipCounter}-buckets`

    const forecast = await proxy(makeRequest('/api/forecast/malibu', ip))
    const waterQuality = await proxy(makeRequest('/api/water-quality/malibu', ip))

    expect(Number(forecast.headers.get('X-RateLimit-Remaining'))).toBe(44)
    expect(Number(waterQuality.headers.get('X-RateLimit-Remaining'))).toBe(29)
  })

  it('ignores spoofable x-forwarded-for: requests without a platform IP share the unknown bucket', async () => {
    // No x-real-ip header — only attacker-settable headers. Varying them must
    // NOT mint fresh buckets.
    const spoofed = (xff: string) =>
      new NextRequest('https://wavefinder.test/api/water-quality/spot', {
        headers: { 'x-forwarded-for': xff },
      })

    const first = await proxy(spoofed('1.1.1.1'))
    const second = await proxy(spoofed('2.2.2.2'))

    const firstRemaining = Number(first.headers.get('X-RateLimit-Remaining'))
    const secondRemaining = Number(second.headers.get('X-RateLimit-Remaining'))
    expect(secondRemaining).toBe(firstRemaining - 1)
  })

  it('ignores x-forwarded-for when a platform IP is present', async () => {
    const ip = `192.0.2.${++ipCounter}-xff`

    const first = await proxy(makeRequest('/api/alerts/a', ip, { 'x-forwarded-for': '3.3.3.3' }))
    const second = await proxy(makeRequest('/api/alerts/b', ip, { 'x-forwarded-for': '4.4.4.4' }))

    expect(Number(first.headers.get('X-RateLimit-Remaining'))).toBe(59)
    expect(Number(second.headers.get('X-RateLimit-Remaining'))).toBe(58)
  })
})
