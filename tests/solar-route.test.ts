import { describe, it, expect, vi, beforeEach } from 'vitest'

// The route forwards `date` to an upstream API, so the query param is the thing
// under test here. The spot store and the upstream client are stubbed so this
// stays a validation test (and never touches the network).
const { getSpotBySlug, fetchSolarData } = vi.hoisted(() => ({
  getSpotBySlug: vi.fn(),
  fetchSolarData: vi.fn(),
}))

vi.mock('@/lib/spots/static-store', () => ({ getSpotBySlug }))
vi.mock('@/lib/api/sunrise-sunset', () => ({ fetchSolarData }))

import { GET } from '@/app/api/solar/[slug]/route'

function call(query = '') {
  return GET(
    new Request(`https://wavefinder.test/api/solar/malibu${query}`),
    { params: Promise.resolve({ slug: 'malibu' }) },
  )
}

describe('GET /api/solar/[slug] — date validation', () => {
  beforeEach(() => {
    getSpotBySlug.mockReset().mockReturnValue({ slug: 'malibu', lat: 34.03, lng: -118.68 })
    fetchSolarData.mockReset().mockResolvedValue({ sunrise: '06:00', sunset: '18:00' })
  })

  it('accepts a well-formed date and forwards it', async () => {
    const res = await call('?date=2026-08-21')
    expect(res.status).toBe(200)
    expect(fetchSolarData).toHaveBeenCalledWith(34.03, -118.68, '2026-08-21')
  })

  it('accepts a missing date', async () => {
    const res = await call()
    expect(res.status).toBe(200)
    expect(fetchSolarData).toHaveBeenCalledWith(34.03, -118.68, undefined)
  })

  it.each([
    '?date=21-08-2026',
    '?date=2026-8-21',
    '?date=2026-08-21T00:00:00Z',
    '?date=tomorrow',
    '?date=',
    "?date=2026-08-21'%20OR%201=1",
  ])('rejects malformed input %s with 400', async (query) => {
    const res = await call(query)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Invalid date' })
    expect(fetchSolarData).not.toHaveBeenCalled()
  })

  it.each(['?date=2026-13-01', '?date=2026-02-31', '?date=2026-00-10'])(
    'rejects the shape-valid but impossible date %s',
    async (query) => {
      const res = await call(query)
      expect(res.status).toBe(400)
      expect(fetchSolarData).not.toHaveBeenCalled()
    },
  )
})
