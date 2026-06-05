import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'

let ipCounter = 0

// Each call gets a unique client IP so the module-level in-memory rate-limit
// store never bleeds counts between assertions. Redis is not configured in the
// test environment, so proxy() always falls back to the in-memory limiter.
function makeRequest(pathname: string, ip = `10.0.0.${++ipCounter % 250}-${ipCounter}`) {
  return new NextRequest(`https://wavefinder.test${pathname}`, {
    headers: { 'x-forwarded-for': ip },
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
    expect(await limitFor('/api/webcams')).toBe(20)
    expect(await limitFor('/api/water-quality')).toBe(30)
    expect(await limitFor('/api/best-spots')).toBe(30)
    expect(await limitFor('/api/forecast')).toBe(45)
    expect(await limitFor('/api/surf-reports')).toBe(45)
    expect(await limitFor('/api/alerts')).toBe(60)
    expect(await limitFor('/api/health')).toBe(120)
    expect(await limitFor('/api/spots')).toBe(120)
  })

  it('falls back to the default limit (80) for unmatched /api/ paths', async () => {
    expect(await limitFor('/api/something-else')).toBe(80)
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
    const path = '/api/webcams' // limit = 20

    const first = await proxy(makeRequest(path, ip))
    const second = await proxy(makeRequest(path, ip))

    expect(first.headers.get('X-RateLimit-Limit')).toBe('20')
    expect(Number(first.headers.get('X-RateLimit-Remaining'))).toBe(19)
    expect(Number(second.headers.get('X-RateLimit-Remaining'))).toBe(18)
  })
})
