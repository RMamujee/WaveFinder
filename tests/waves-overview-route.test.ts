import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WaveGridBlob } from '@/lib/api/ww3-overview'

// Only readWaveGrid is stubbed — lookupWaveGrid (the nearest-timestep pick)
// runs for real, because that logic is exactly what this route's empty-state
// contract depends on and it is the one path this environment (no Vercel
// Runtime Cache locally) can actually exercise end to end.
let stubBlob: WaveGridBlob | null = null
vi.mock('@/lib/api/ww3-overview', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/ww3-overview')>()
  return { ...actual, readWaveGrid: vi.fn(async () => stubBlob) }
})

const { GET } = await import('@/app/api/waves-overview/route')

const HOUR = 3_600_000

describe('GET /api/waves-overview', () => {
  beforeEach(() => {
    stubBlob = null
  })

  it('returns 204 with no body when the cron has never run', async () => {
    const res = await GET()
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
  })

  it('returns 204 when every stored hour is outside the validity window', async () => {
    stubBlob = {
      version: 1,
      generatedAt: Date.now() - 2 * 24 * HOUR,
      times: [Date.now() - 2 * 24 * HOUR],
      cells: [[[30.5, -124.5, 1.3, 12.6, 146]]],
    }
    const res = await GET()
    expect(res.status).toBe(204)
  })

  it('uses a short cache window on the empty-state response', async () => {
    const res = await GET()
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=60')
  })

  it('serves the single nearest timestep as {time, cells}', async () => {
    const now = Date.now()
    stubBlob = {
      version: 1,
      generatedAt: now,
      times: [now - 5 * HOUR, now - HOUR, now + 3 * HOUR],
      cells: [
        [[10, 10, 9, 9, 9]],
        [[30.5, -124.5, 1.3, 12.6, 146], [30.5, -122.5, 1.4, 12.4, 150]],
        [[20, 20, 8, 8, 8]],
      ],
    }
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.time).toBe(now - HOUR)
    expect(body.cells).toEqual([[30.5, -124.5, 1.3, 12.6, 146], [30.5, -122.5, 1.4, 12.4, 150]])
  })

  it('uses the long stale-while-revalidate window on a real hit — the cron only runs daily', async () => {
    const now = Date.now()
    stubBlob = {
      version: 1,
      generatedAt: now,
      times: [now],
      cells: [[[30.5, -124.5, 1.3, 12.6, 146]]],
    }
    const res = await GET()
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=1800')
    expect(res.headers.get('Cache-Control')).toContain('stale-while-revalidate=3600')
  })

  it('degrades to empty rather than 500 on a blob with no timesteps at all', async () => {
    stubBlob = { version: 1, generatedAt: Date.now(), times: [], cells: [] }
    const res = await GET()
    expect(res.status).toBe(204)
  })
})
