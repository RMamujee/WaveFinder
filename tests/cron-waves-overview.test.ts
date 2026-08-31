import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { WaveOverviewBlob } from '@/lib/api/ww3-overview'

vi.mock('@/lib/monitoring', () => ({ monitor: vi.fn() }))

// The Runtime Cache is a Vercel primitive; under vitest `getCache()` throws and
// the module's write returns false. Stubbed so the success path can be asserted
// on its own rather than through an environment accident.
const writeWaveOverview = vi.fn<(blob: WaveOverviewBlob) => Promise<boolean>>(async () => true)
vi.mock('@/lib/api/ww3-overview', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/ww3-overview')>()
  return { ...actual, writeWaveOverview }
})

const { GET } = await import('@/app/api/cron/waves-overview/route')
const { WW3_BOXES } = await import('@/lib/api/ww3-overview')

function makeRequest(authorization?: string) {
  return new NextRequest('https://wavefinder.test/api/cron/waves-overview', {
    headers: authorization ? { authorization } : {},
  })
}

// One ocean cell per box, placed at the box's own centre, so the snap has
// something to find everywhere without pretending to be a real forecast.
function gridResponse(box: { latMin: number; latMax: number; lonMin: number; lonMax: number }) {
  const rows: unknown[][] = []
  for (let lat = box.latMin; lat <= box.latMax; lat += 0.5) {
    for (let lng = box.lonMin; lng <= box.lonMax; lng += 0.5) {
      rows.push(['2026-08-31T12:00:00Z', 0, lat, lng, 1.5, 9, 200, 1.1, 12, 210, 0.4, 5, 190])
    }
  }
  return {
    table: {
      columnNames: ['time', 'depth', 'latitude', 'longitude', 'Thgt', 'Tper', 'Tdir', 'shgt', 'sper', 'sdir', 'whgt', 'wper', 'wdir'],
      rows,
    },
  }
}

describe('GET /api/cron/waves-overview', () => {
  const ORIGINAL_SECRET = process.env.CRON_SECRET
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    process.env.CRON_SECRET = 'test-cron-secret'
    writeWaveOverview.mockClear().mockResolvedValue(true)
    fetchMock = vi.fn(async (url: string) => {
      const box = WW3_BOXES.find((b) => url.includes(`(${b.latMin})`) && url.includes(`(${b.lonMin})`))!
      return { ok: true, status: 200, json: async () => gridResponse(box) } as unknown as Response
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = ORIGINAL_SECRET
  })

  it('returns 401 without the bearer secret and fetches nothing', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(writeWaveOverview).not.toHaveBeenCalled()
  })

  it('returns 401 for a wrong secret', async () => {
    expect((await GET(makeRequest('Bearer wrong'))).status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 401 when CRON_SECRET is unset — never an open endpoint', async () => {
    delete process.env.CRON_SECRET
    expect((await GET(makeRequest('Bearer '))).status).toBe(401)
  })

  it('fetches every box once and snaps every conditions bucket', async () => {
    const res = await GET(makeRequest('Bearer test-cron-secret'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(fetchMock).toHaveBeenCalledTimes(WW3_BOXES.length)
    expect(body.snapped).toBe(body.buckets)
    expect(body.failedBoxes).toEqual([])
    const blob = writeWaveOverview.mock.calls[0][0]
    expect(blob.version).toBe(1)
    expect(Object.keys(blob.entries)).toHaveLength(body.buckets)
  })

  it('still writes when a box fails — a partial world beats no world', async () => {
    let first = true
    fetchMock.mockImplementation(async (url: string) => {
      if (first) { first = false; return { ok: false, status: 500 } as unknown as Response }
      const box = WW3_BOXES.find((b) => url.includes(`(${b.latMin})`) && url.includes(`(${b.lonMin})`))!
      return { ok: true, status: 200, json: async () => gridResponse(box) } as unknown as Response
    })
    const res = await GET(makeRequest('Bearer test-cron-secret'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.failedBoxes).toHaveLength(1)
    expect(writeWaveOverview).toHaveBeenCalledTimes(1)
  })

  it('refuses to overwrite a good previous run with nothing when every box fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 } as unknown as Response)
    const res = await GET(makeRequest('Bearer test-cron-secret'))
    expect(res.status).toBe(502)
    expect(writeWaveOverview).not.toHaveBeenCalled()
  })

  it('reports failure when the blob could not be stored', async () => {
    writeWaveOverview.mockResolvedValue(false)
    expect((await GET(makeRequest('Bearer test-cron-secret'))).status).toBe(500)
  })
})
