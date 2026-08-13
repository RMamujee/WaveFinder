import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// A spot page dies entirely when fetchMarineForecast throws — it is the one
// fetch /api/forecast/[slug] treats as fatal. Before stale-if-error, that meant
// any upstream hiccup landing in the window after the 1 h cache entry expired
// blanked the page with a 502. Open-Meteo rate-limits per minute, so the hiccup
// arrives exactly when traffic is highest.

interface CacheEntry { value: unknown; ttl: number }

const store = new Map<string, CacheEntry>()

vi.mock('@vercel/functions', () => ({
  getCache: () => ({
    get: async (key: string) => store.get(key)?.value ?? null,
    set: async (key: string, value: unknown, opts: { ttl: number }) => {
      store.set(key, { value, ttl: opts.ttl })
    },
  }),
}))

vi.mock('@/lib/monitoring', () => ({ monitor: vi.fn() }))

const { fetchMarineForecast } = await import('@/lib/api/open-meteo')

function marinePayload(waveHeight: number) {
  const time = ['2026-08-07T00:00', '2026-08-07T01:00']
  return {
    utc_offset_seconds: -25200,
    hourly: {
      time,
      wave_height: [waveHeight, waveHeight],
      wave_direction: [270, 270],
      wave_period: [12, 12],
      swell_wave_height: [waveHeight, waveHeight],
      swell_wave_direction: [270, 270],
      swell_wave_period: [14, 14],
      wind_wave_height: [0.2, 0.2],
      wind_wave_direction: [270, 270],
      wind_wave_period: [4, 4],
    },
  }
}

/** Drop only the fresh entries, exactly as a TTL lapse would. */
function expireFreshEntries() {
  for (const key of [...store.keys()]) {
    if (!key.endsWith(':last-good')) store.delete(key)
  }
}

describe('fetchMarineForecast — stale-if-error', () => {
  beforeEach(() => {
    store.clear()
    vi.restoreAllMocks()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('serves the last known good forecast when the refresh fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(marinePayload(1.8)), { status: 200 })))
    const fresh = await fetchMarineForecast(34.01, -118.5)
    expect(fresh.hourly.wave_height[0]).toBe(1.8)

    expireFreshEntries()
    // Upstream now refuses everything — a rate limit answers instantly.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('rate limited', { status: 429 })))

    const recovered = await fetchMarineForecast(34.01, -118.5)
    expect(recovered.hourly.wave_height[0]).toBe(1.8)
  })

  it('still throws when upstream fails and nothing good was ever cached', async () => {
    // Honest failure: there is genuinely nothing to show, so the route's 502
    // (now logged) is the correct outcome rather than a fabricated forecast.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })))
    await expect(fetchMarineForecast(10.5, -60.25)).rejects.toThrow()
  })

  it('prefers a fresh response over the last known good copy', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(marinePayload(1.0)), { status: 200 })))
    await fetchMarineForecast(20.1, -155.2)

    expireFreshEntries()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(marinePayload(2.5)), { status: 200 })))

    const next = await fetchMarineForecast(20.1, -155.2)
    expect(next.hourly.wave_height[0]).toBe(2.5)
  })

  it('replaces the last known good copy after a successful refresh', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(marinePayload(1.0)), { status: 200 })))
    await fetchMarineForecast(-33.9, 151.3)
    expireFreshEntries()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(marinePayload(3.2)), { status: 200 })))
    await fetchMarineForecast(-33.9, 151.3)

    expireFreshEntries()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })))
    const recovered = await fetchMarineForecast(-33.9, 151.3)
    // The 3.2 m run, not the 1.0 m one it superseded.
    expect(recovered.hourly.wave_height[0]).toBe(3.2)
  })

  it('keeps the last known good copy far longer than the fresh one', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(marinePayload(1.4)), { status: 200 })))
    await fetchMarineForecast(43.5, -70.1)

    const fresh = [...store.entries()].find(([k]) => !k.endsWith(':last-good'))!
    const lastGood = [...store.entries()].find(([k]) => k.endsWith(':last-good'))!
    expect(lastGood[1].ttl).toBeGreaterThan(fresh[1].ttl)
  })
})
