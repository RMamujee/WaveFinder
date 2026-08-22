import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { queryRaw, ping } = vi.hoisted(() => ({ queryRaw: vi.fn(), ping: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: queryRaw } }))
vi.mock('@/lib/monitoring', () => ({ monitor: vi.fn() }))
vi.mock('@/lib/redis', () => ({ redis: { ping } }))

import { GET } from '@/app/api/health/route'

function request(authorization?: string) {
  return new Request('https://wavefinder.test/api/health', {
    headers: authorization ? { authorization } : {},
  })
}

describe('GET /api/health', () => {
  const ORIGINAL_SECRET = process.env.CRON_SECRET

  beforeEach(() => {
    queryRaw.mockReset().mockResolvedValue([{ '?column?': 1 }])
    ping.mockReset().mockResolvedValue('PONG')
    process.env.CRON_SECRET = 'test-cron-secret'
  })

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = ORIGINAL_SECRET
  })

  it('gives an anonymous caller the verdict only — no component breakdown', async () => {
    const res = await GET(request())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body).not.toHaveProperty('db')
    expect(body).not.toHaveProperty('redis')
    // Both components are still pinged; only the response is trimmed.
    expect(queryRaw).toHaveBeenCalled()
    expect(ping).toHaveBeenCalled()
  })

  it('returns the breakdown to a caller presenting the cron secret', async () => {
    const res = await GET(request('Bearer test-cron-secret'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'ok', db: 'connected', redis: 'connected' })
  })

  it('withholds the breakdown from a wrong secret', async () => {
    const res = await GET(request('Bearer wrong-secret-value'))
    const body = await res.json()
    expect(body).not.toHaveProperty('db')
    expect(body).not.toHaveProperty('redis')
  })

  it('reports degraded (still 200) when Redis is unreachable', async () => {
    ping.mockRejectedValue(new Error('redis down'))
    const res = await GET(request())
    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe('degraded')
  })

  it('503s when the database is unreachable, still without the breakdown', async () => {
    queryRaw.mockRejectedValue(new Error('db down'))
    const res = await GET(request())
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.status).toBe('error')
    expect(body).not.toHaveProperty('db')
  })

  it('503s with the breakdown for an authorized caller', async () => {
    queryRaw.mockRejectedValue(new Error('db down'))
    const res = await GET(request('Bearer test-cron-secret'))
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ status: 'error', db: 'unreachable' })
  })
})
