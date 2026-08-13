import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock prisma and monitoring so importing the route never instantiates a real
// Prisma client (mirrors tests/webhook.test.ts).
const { deleteSessions, deleteVerifications, transaction } = vi.hoisted(() => {
  const deleteSessions = vi.fn()
  const deleteVerifications = vi.fn()
  // $transaction receives the array of (mocked) deleteMany promises and
  // resolves them like the real client would.
  const transaction = vi.fn((ops: Promise<unknown>[]) => Promise.all(ops))
  return { deleteSessions, deleteVerifications, transaction }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    session: { deleteMany: deleteSessions },
    verification: { deleteMany: deleteVerifications },
    $transaction: transaction,
  },
}))
vi.mock('@/lib/monitoring', () => ({ monitor: vi.fn() }))

import { GET } from '@/app/api/cron/cleanup/route'

function makeRequest(authorization?: string) {
  return new NextRequest('https://wavefinder.test/api/cron/cleanup', {
    headers: authorization ? { authorization } : {},
  })
}

describe('GET /api/cron/cleanup', () => {
  const ORIGINAL_SECRET = process.env.CRON_SECRET

  beforeEach(() => {
    deleteSessions.mockReset().mockResolvedValue({ count: 3 })
    deleteVerifications.mockReset().mockResolvedValue({ count: 5 })
    transaction.mockClear()
    process.env.CRON_SECRET = 'test-cron-secret'
  })

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = ORIGINAL_SECRET
  })

  it('returns 401 without the bearer secret and deletes nothing', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('returns 401 for a wrong secret', async () => {
    const res = await GET(makeRequest('Bearer wrong'))
    expect(res.status).toBe(401)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('returns 401 when CRON_SECRET is unset (never an open endpoint)', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(makeRequest('Bearer '))
    expect(res.status).toBe(401)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('purges expired sessions and verifications with the right secret', async () => {
    const res = await GET(makeRequest('Bearer test-cron-secret'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true,
      deleted: { sessions: 3, verifications: 5 },
    })

    const sessionWhere = deleteSessions.mock.calls[0][0]
    expect(sessionWhere.where.expiresAt.lt).toBeInstanceOf(Date)
    const verificationWhere = deleteVerifications.mock.calls[0][0]
    expect(verificationWhere.where.expiresAt.lt).toBeInstanceOf(Date)
  })

  it('returns 500 when the purge fails', async () => {
    transaction.mockRejectedValueOnce(new Error('db down'))
    const res = await GET(makeRequest('Bearer test-cron-secret'))
    expect(res.status).toBe(500)
  })
})
