import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { OpenMeteoMarineResponse, OpenMeteoWindResponse } from '@/lib/api/open-meteo'

const { fetchMarineForecast, fetchWindForecast } = vi.hoisted(() => ({
  fetchMarineForecast: vi.fn(),
  fetchWindForecast: vi.fn(),
}))

vi.mock('@/lib/api/open-meteo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/open-meteo')>()),
  fetchMarineForecast,
  fetchWindForecast,
}))
// No station/buoy for the test spot's path here — keep the route's other three
// fetches off the network without changing what they mean.
vi.mock('@/lib/api/noaa-tides', () => ({
  fetchTidePredictions: vi.fn(async () => []),
  fetchCoastalWind: vi.fn(async () => null),
}))
vi.mock('@/lib/api/noaa-buoy', () => ({ fetchBuoyData: vi.fn(async () => null) }))

const { GET } = await import('@/app/api/forecast/[slug]/route')

// Open-Meteo hourly strings are the spot's LOCAL clock with no offset — the
// fixture keeps that shape so the merge behaves as it does in production.
const TIMES = ['2026-08-22T00:00', '2026-08-22T01:00', '2026-08-22T02:00']
const n = (v: number) => TIMES.map(() => v)

function marine(extra: Partial<OpenMeteoMarineResponse> = {}): OpenMeteoMarineResponse {
  return {
    utc_offset_seconds: 8 * 3600,
    timezone: 'Asia/Makassar',
    hourly: {
      time: TIMES,
      wave_height: n(1.5),
      wave_direction: n(250),
      wave_period: n(10),
      swell_wave_height: n(1.2),
      swell_wave_direction: n(255),
      swell_wave_period: n(13),
      wind_wave_height: n(0.4),
      wind_wave_direction: n(200),
      wind_wave_period: n(4),
      sea_surface_temperature: n(21),
    },
    ...extra,
  }
}

const wind: OpenMeteoWindResponse = {
  utc_offset_seconds: 8 * 3600,
  timezone: 'Asia/Makassar',
  hourly: {
    time: TIMES,
    wind_speed_10m: n(8),
    wind_direction_10m: n(90),
    wind_gusts_10m: n(12),
    temperature_2m: n(26),
    weather_code: n(1),
    precipitation_probability: n(5),
    cloud_cover: n(20),
  },
}

async function getForecast(slug = 'malibu') {
  const res = await GET(new Request(`http://localhost/api/forecast/${slug}`), {
    params: Promise.resolve({ slug }),
  })
  return { res, body: (await res.json()) as Record<string, unknown> }
}

beforeEach(() => {
  fetchMarineForecast.mockReset().mockResolvedValue(marine())
  fetchWindForecast.mockReset().mockResolvedValue(wind)
})

describe('GET /api/forecast/[slug] — spot timezone', () => {
  it('carries the spot IANA timezone into the payload', async () => {
    const { res, body } = await getForecast()
    expect(res.status).toBe(200)
    expect(body.timezone).toBe('Asia/Makassar')
    expect(body.utcOffsetSeconds).toBe(8 * 3600)
  })

  it('omits timezone — rather than sending null — for a payload cached before the field existed', async () => {
    // withCache keeps a marine response for up to 24 h, so the first deploy
    // after this change serves entries with no `timezone`. A null would be
    // handed to Intl.DateTimeFormat as a zone name; an absent key lets the
    // client fall through to utcOffsetSeconds.
    const stale = marine()
    delete stale.timezone
    fetchMarineForecast.mockResolvedValue(stale)

    const { res, body } = await getForecast()
    expect(res.status).toBe(200)
    expect('timezone' in body).toBe(false)
    expect(body.utcOffsetSeconds).toBe(8 * 3600)
    // The rest of the payload is unaffected — a missing zone must not degrade
    // the forecast itself.
    expect(Array.isArray(body.forecast)).toBe(true)
    expect((body.forecast as unknown[]).length).toBeGreaterThan(0)
  })

  it('still answers when the upstream has neither timezone nor offset', async () => {
    const bare = marine()
    delete bare.timezone
    delete bare.utc_offset_seconds
    fetchMarineForecast.mockResolvedValue(bare)

    const { res, body } = await getForecast()
    expect(res.status).toBe(200)
    expect('timezone' in body).toBe(false)
    expect('utcOffsetSeconds' in body).toBe(false)
    expect(Array.isArray(body.forecast)).toBe(true)
  })

  it('survives a marine payload whose timezone is an empty string', async () => {
    // Open-Meteo has no business sending one, but an empty zone name is not a
    // usable zone — it must be dropped, not forwarded for Intl to reject.
    fetchMarineForecast.mockResolvedValue(marine({ timezone: '' }))

    const { res, body } = await getForecast()
    expect(res.status).toBe(200)
    expect('timezone' in body).toBe(false)
  })
})
