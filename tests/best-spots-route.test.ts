import { describe, it, expect, vi } from 'vitest'
import type { OpenMeteoMarineResponse, OpenMeteoWindResponse } from '@/lib/api/open-meteo'

// /api/best-spots used to sit behind requireProAccess() and answered 401 to
// every signed-out visitor — which is what /timeline rendered as the literal
// text "401". The app is free and account-free now, so the route must stay
// public. These two modules are mocked even though the route no longer imports
// them: if the gate is ever reintroduced, it fails on the 200 assertions below
// instead of crashing at import time (lib/prisma constructs a PrismaClient at
// module scope), so the failure names the actual regression.
vi.mock('@/lib/session', () => ({ getServerSession: vi.fn(async () => null) }))
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: vi.fn(async () => null) } } }))

const DATE = '2026-08-07'
const HOURS = Array.from({ length: 24 }, (_, h) => `${DATE}T${String(h).padStart(2, '0')}:00`)

function fill(value: number): number[] {
  return HOURS.map(() => value)
}

const MARINE: OpenMeteoMarineResponse = {
  utc_offset_seconds: -25200,
  hourly: {
    time: HOURS,
    wave_height: fill(1.5),
    wave_direction: fill(270),
    wave_period: fill(11),
    swell_wave_height: fill(1.2),
    swell_wave_direction: fill(265),
    swell_wave_period: fill(13),
    wind_wave_height: fill(0.3),
    wind_wave_direction: fill(300),
    wind_wave_period: fill(4),
    sea_surface_temperature: fill(18),
  },
}

const WIND: OpenMeteoWindResponse = {
  hourly: {
    time: HOURS,
    wind_speed_10m: fill(8),
    wind_direction_10m: fill(60),
    wind_gusts_10m: fill(12),
    temperature_2m: fill(20),
    weather_code: fill(0),
    precipitation_probability: fill(0),
    cloud_cover: fill(10),
  },
}

vi.mock('@/lib/api/open-meteo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/open-meteo')>()
  return {
    ...actual,
    fetchMarineForecast: vi.fn(async () => MARINE),
    fetchWindForecast: vi.fn(async () => WIND),
  }
})

const { GET } = await import('@/app/api/best-spots/route')

function get(region: string, date = DATE) {
  return GET(new Request(`http://localhost/api/best-spots?region=${encodeURIComponent(region)}&date=${date}`))
}

describe('GET /api/best-spots — public', () => {
  // No cookie, no session, no Pro subscription: the anonymous visitor is the
  // only visitor there is now.
  it('answers an anonymous request with ranked spots', async () => {
    const res = await get('Los Angeles')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.date).toBe(DATE)
    expect(body.spots.length).toBeGreaterThan(0)
    expect(body.regionalSwell.length).toBeGreaterThan(0)
    expect(body.spots[0].hours.length).toBeGreaterThan(0)
  })

  it('never answers 401 or 403', async () => {
    for (const region of ['Los Angeles', 'San Diego', 'Gold Coast']) {
      const res = await get(region)
      expect([401, 403], region).not.toContain(res.status)
    }
  })

  it('still rejects a malformed request on its own merits', async () => {
    // Un-gating the route must not un-validate it.
    expect((await get('Los Angeles', 'not-a-date')).status).toBe(400)
    expect((await GET(new Request('http://localhost/api/best-spots?date=' + DATE))).status).toBe(400)
  })
})

describe('GET /api/best-spots — CDN caching', () => {
  // The response depends only on (region, date), so it is share-cacheable —
  // and it must be, because the cold path is up to 8 Open-Meteo calls. The
  // header was `private, no-store` while the route was per-user.
  it('is share-cacheable with a stale window longer than its fresh window', async () => {
    const res = await get('Los Angeles')

    for (const header of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control']) {
      const value = res.headers.get(header)
      expect(value, header).toBeTruthy()
      expect(value, header).toContain('public')
      expect(value, header).not.toContain('no-store')
      expect(value, header).not.toContain('private')
    }

    const value = res.headers.get('Vercel-CDN-Cache-Control')!
    const maxAge = Number(/s-maxage=(\d+)/.exec(value)![1])
    const stale = Number(/stale-while-revalidate=(\d+)/.exec(value)![1])
    expect(stale).toBeGreaterThan(maxAge)
  })
})
