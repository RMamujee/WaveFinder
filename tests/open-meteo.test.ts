import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getCache } from '@vercel/functions'
import {
  pickHourIndex,
  parseCurrentConditions,
  fetchCurrentConditionsBatch,
  type MarineCurrentEntry,
} from '@/lib/api/open-meteo'

// ── pickHourIndex ────────────────────────────────────────────────────────────

describe('pickHourIndex', () => {
  const times = ['2026-08-06T12:00', '2026-08-06T13:00', '2026-08-06T14:00']

  it('picks the in-progress hour, not the next one', () => {
    // 13:34 local → still surfing the 13:00 hour.
    expect(pickHourIndex(times, 0, Date.parse('2026-08-06T13:34:00Z'))).toBe(1)
  })

  it('falls back to the last hour when every hour is behind now', () => {
    expect(pickHourIndex(times, 0, Date.parse('2026-08-06T23:00:00Z'))).toBe(2)
  })

  // The bug this guards: hours come back as offset-less *local* strings. Parsing
  // them in the runtime's zone (UTC on Vercel) selects an hour off by the spot's
  // entire UTC offset — a Californian checking at 5pm saw 11pm conditions.
  it('reads the spot local clock, not the runtime clock', () => {
    const pdt = -7 * 3600
    // 20:20 UTC is 13:20 in California, so the 13:00 local hour is current.
    expect(pickHourIndex(times, pdt, Date.parse('2026-08-06T20:20:00Z'))).toBe(1)
    // Ignoring the offset would have picked the 20:00 hour — off the end of
    // this window entirely, which is what pinned spots to 23:00.
    expect(pickHourIndex(times, 0, Date.parse('2026-08-06T20:20:00Z'))).toBe(2)
  })
})

// ── parseCurrentConditions ───────────────────────────────────────────────────

function marineEntry(overrides: Partial<NonNullable<MarineCurrentEntry['hourly']>> = {}): MarineCurrentEntry {
  return {
    utc_offset_seconds: 0,
    hourly: {
      time: ['2026-08-06T12:00', '2026-08-06T13:00', '2026-08-06T14:00'],
      wave_height: [1.0, 1.5, 2.0],
      wave_period: [8, 9, 10],
      swell_wave_height: [0.8, 1.2, 1.6],
      swell_wave_period: [12, 13, 14],
      swell_wave_direction: [270, 275, 280],
      secondary_swell_wave_height: [0.3, 0.35, 0.4],
      secondary_swell_wave_period: [16, 17, 18],
      secondary_swell_wave_direction: [200, 205, 210],
      wind_wave_height: [0.2, 0.3, 0.4],
      wind_wave_period: [4, 5, 6],
      wind_wave_direction: [180, 185, 190],
      ...overrides,
    },
  }
}

const NOW = Date.parse('2026-08-06T13:30:00Z') // → hour index 1

describe('parseCurrentConditions', () => {
  it('reads every field from the selected hour', () => {
    const c = parseCurrentConditions(marineEntry(), { current: { wind_speed_10m: 12, wind_direction_10m: 300 } }, NOW)
    expect(c).toEqual({
      waveHeight: 1.5,
      wavePeriod: 9,
      swellHeight: 1.2,
      swellPeriod: 13,
      swellDirection: 275,
      secondarySwellHeight: 0.35,
      secondarySwellPeriod: 17,
      secondarySwellDirection: 205,
      windWaveHeight: 0.3,
      windWavePeriod: 5,
      windSpeed: 12,
      windDirection: 300,
    })
  })

  // Open-Meteo ranks swell partitions by HEIGHT, so the longer-period (more
  // surfable) train is frequently the second one — and it was never requested.
  // A response without it must read as "no second train", not as a 0 m one.
  it('reports a missing secondary partition as null, never 0', () => {
    const c = parseCurrentConditions(
      marineEntry({
        secondary_swell_wave_height: undefined,
        secondary_swell_wave_period: undefined,
        secondary_swell_wave_direction: undefined,
      }),
      null,
      NOW
    )
    expect(c).toMatchObject({
      secondarySwellHeight: null,
      secondarySwellPeriod: null,
      secondarySwellDirection: null,
    })
  })

  it('returns null when the entry has no hours at all', () => {
    expect(parseCurrentConditions({ hourly: { time: [] } }, null, NOW)).toBeNull()
    expect(parseCurrentConditions(undefined, null, NOW)).toBeNull()
  })

  // A land or invalid marine cell is a definitive answer, not a transient
  // failure — the caller caches it so the cell stops being re-requested.
  it('reports no-data rather than flat when the model has no wave height', () => {
    const c = parseCurrentConditions(marineEntry({ wave_height: [null, null, null] }), null, NOW)
    expect(c).toEqual({ noData: true })
  })

  it('preserves nulls instead of coercing them to a real bearing', () => {
    const c = parseCurrentConditions(marineEntry({ swell_wave_direction: [null, null, null] }), null, NOW)
    // 0 would be scored as a genuine due-north swell.
    expect(c).toMatchObject({ swellDirection: null })
  })

  it('estimates wind speed from the wind-wave partition when the weather entry is missing', () => {
    const c = parseCurrentConditions(marineEntry(), undefined, NOW)
    // Hs_wind ≈ 0.0248·U² → U = sqrt(0.3/0.0248) m/s ≈ 3.48 m/s ≈ 13 km/h
    expect(c).toMatchObject({ windSpeed: 13 })
  })

  it('leaves wind direction null rather than borrowing the chop bearing', () => {
    const c = parseCurrentConditions(marineEntry(), undefined, NOW)
    // wind_wave_direction is 185 here; using it would rate an estimated breeze
    // as if it blew from the chop's bearing.
    expect(c).toMatchObject({ windDirection: null })
  })
})

// ── fetchCurrentConditionsBatch ──────────────────────────────────────────────

function jsonResponse(body: unknown) {
  return { ok: true, text: async () => JSON.stringify(body) } as unknown as Response
}

/** Marine payload for one location, with a distinguishing wave height. */
function marinePayload(waveHeight: number) {
  return marineEntry({ wave_height: [waveHeight, waveHeight, waveHeight] })
}

function installFetch(handler: (url: string) => Response | Promise<Response>) {
  const calls: { url: string }[] = []
  const spy = vi.fn(async (url: string | URL) => {
    const u = url.toString()
    calls.push({ url: u })
    return handler(u)
  })
  vi.stubGlobal('fetch', spy)
  return { calls, spy }
}

const MARINE = 'marine-api.open-meteo.com'

/** Echo back one entry per requested coordinate. */
function echo(url: string, entry: (i: number) => unknown) {
  const count = new URL(url).searchParams.get('latitude')!.split(',').length
  return jsonResponse(Array.from({ length: count }, (_, i) => entry(i)))
}

describe('fetchCurrentConditionsBatch', () => {
  beforeEach(async () => {
    // Outside Vercel, getCache() still returns a real in-memory cache that
    // outlives each test — without this, a coordinate fetched by one test is
    // served from cache in the next and the fetch-count assertions go green
    // for the wrong reason.
    await getCache().expireTag('open-meteo')
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-06T13:30:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('collapses many coordinates into one marine request and one weather request', async () => {
    const points = Array.from({ length: 12 }, (_, i) => ({ lat: 33 + i * 0.1, lng: -117 - i * 0.1 }))
    const { calls } = installFetch((url) =>
      echo(url, (i) => (url.includes(MARINE) ? marinePayload(i) : { current: { wind_speed_10m: 10, wind_direction_10m: 270 } }))
    )

    const results = await fetchCurrentConditionsBatch(points)

    expect(calls).toHaveLength(2)
    const marineUrl = calls.find((c) => c.url.includes(MARINE))!.url
    // Comma-separated coordinate lists, in request order.
    expect(decodeURIComponent(marineUrl)).toContain('latitude=33.0000,33.1000,33.2000')
    expect(results.map((r) => r!.waveHeight)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])

    // One timezone per coordinate — the documented multi-coordinate form. Each
    // entry then reports its own utc_offset_seconds, which the hour selection
    // needs to read the spot's local clock.
    for (const call of calls) {
      expect(new URL(call.url).searchParams.get('timezone')!.split(',')).toHaveLength(12)
    }
  })

  it('splits into further requests past the per-request coordinate cap', async () => {
    const points = Array.from({ length: 120 }, (_, i) => ({ lat: 40 + i * 0.05, lng: -120 }))
    const { calls } = installFetch((url) =>
      echo(url, () => (url.includes(MARINE) ? marinePayload(1.5) : { current: { wind_speed_10m: 5, wind_direction_10m: 90 } }))
    )

    const results = await fetchCurrentConditionsBatch(points)

    // 120 coordinates → 3 chunks of ≤50 → 3 marine + 3 weather requests.
    expect(calls).toHaveLength(6)
    expect(calls.filter((c) => c.url.includes(MARINE))).toHaveLength(3)
    expect(results.filter(Boolean)).toHaveLength(120)
  })

  it('requests a duplicated coordinate only once but answers every caller', async () => {
    const points = [
      { lat: 10.5, lng: -117.5 },
      { lat: 10.5, lng: -117.5 },
      { lat: 11.0, lng: -118.0 },
    ]
    const { calls } = installFetch((url) => echo(url, (i) => (url.includes(MARINE) ? marinePayload(i) : {})))

    const results = await fetchCurrentConditionsBatch(points)

    const marineUrl = new URL(calls.find((c) => c.url.includes(MARINE))!.url)
    expect(marineUrl.searchParams.get('latitude')!.split(',')).toHaveLength(2)
    expect(results).toHaveLength(3)
    expect(results[0]!.waveHeight).toBe(results[1]!.waveHeight)
    expect(results[2]!.waveHeight).not.toBe(results[0]!.waveHeight)
  })

  it('returns nulls rather than misaligned data when the response is short', async () => {
    const points = Array.from({ length: 4 }, (_, i) => ({ lat: 12 + i, lng: -117 }))
    installFetch((url) =>
      // Three entries for four coordinates: silently zipping these would give
      // each spot its neighbour's surf.
      jsonResponse(url.includes(MARINE) ? [marinePayload(1), marinePayload(2), marinePayload(3)] : [{}, {}, {}, {}])
    )

    expect(await fetchCurrentConditionsBatch(points)).toEqual([null, null, null, null])
  })

  it('normalises the bare object returned for a single coordinate', async () => {
    installFetch((url) => jsonResponse(url.includes(MARINE) ? marinePayload(2.25) : { current: { wind_speed_10m: 7, wind_direction_10m: 15 } }))

    const [result] = await fetchCurrentConditionsBatch([{ lat: 21.65, lng: -158.06 }])

    expect(result).toMatchObject({ waveHeight: 2.25, windSpeed: 7 })
  })

  it('keeps marine data when the weather request fails', async () => {
    installFetch((url) => {
      if (url.includes(MARINE)) return jsonResponse(marinePayload(1.8))
      return { ok: false, text: async () => 'nope' } as unknown as Response
    })

    const [result] = await fetchCurrentConditionsBatch([{ lat: 13.5, lng: -117.5 }])

    expect(result).toMatchObject({ waveHeight: 1.8 })
    // Falls back to the wind-wave estimate rather than dropping the spot.
    expect(result!.windSpeed).toBeGreaterThan(0)
  })

  it('returns nulls when the API answers with HTML at status 200', async () => {
    installFetch(() => ({ ok: true, text: async () => '<!DOCTYPE html><html>blocked</html>' }) as unknown as Response)

    expect(await fetchCurrentConditionsBatch([{ lat: 14.5, lng: -117.5 }])).toEqual([null])
  })

  it('caches a no-data cell so it is not re-requested', async () => {
    const { calls } = installFetch((url) =>
      echo(url, () => (url.includes(MARINE) ? marineEntry({ wave_height: [null, null, null] }) : {}))
    )

    const land = { lat: 39.0, lng: -105.0 }
    expect(await fetchCurrentConditionsBatch([land])).toEqual([null])
    calls.length = 0

    // Second pass is served by the sentinel — a land cell must not re-hit
    // Open-Meteo on every origin run.
    expect(await fetchCurrentConditionsBatch([land])).toEqual([null])
    expect(calls).toHaveLength(0)
  })

  it('joins concurrent callers on one upstream request per coordinate', async () => {
    const { calls } = installFetch((url) => echo(url, () => (url.includes(MARINE) ? marinePayload(1.1) : {})))

    const shared = { lat: 36.85, lng: -121.95 }
    const [a, b] = await Promise.all([
      fetchCurrentConditionsBatch([shared]),
      fetchCurrentConditionsBatch([shared]),
    ])

    expect(calls.filter((c) => c.url.includes(MARINE))).toHaveLength(1)
    expect(a[0]).toMatchObject({ waveHeight: 1.1 })
    expect(b[0]).toMatchObject({ waveHeight: 1.1 })
  })

  it('does not strand later callers after a failed fetch', async () => {
    let attempt = 0
    installFetch((url) => {
      if (url.includes(MARINE)) {
        attempt += 1
        if (attempt === 1) throw new Error('connect ETIMEDOUT')
        return jsonResponse(marinePayload(0.9))
      }
      return jsonResponse({})
    })

    const point = { lat: 43.66, lng: -1.43 }
    expect(await fetchCurrentConditionsBatch([point])).toEqual([null])
    // A transient failure is never cached, and the in-flight entry must have
    // been cleared, so a retry actually refetches.
    expect((await fetchCurrentConditionsBatch([point]))[0]).toMatchObject({ waveHeight: 0.9 })
  })

  it('serves a repeat coordinate from cache and only fetches the new ones', async () => {
    const { calls } = installFetch((url) => echo(url, () => (url.includes(MARINE) ? marinePayload(2.4) : {})))

    const warm = { lat: -28.0, lng: 153.43 }
    const cold = { lat: -33.72, lng: 151.28 }
    await fetchCurrentConditionsBatch([warm])
    calls.length = 0

    const results = await fetchCurrentConditionsBatch([warm, cold])

    const marineUrl = new URL(calls.find((c) => c.url.includes(MARINE))!.url)
    expect(marineUrl.searchParams.get('latitude')).toBe('-33.7200')
    expect(results.every((r) => r?.waveHeight === 2.4)).toBe(true)
  })

  it('returns an empty list without touching the network', async () => {
    const { calls } = installFetch(() => jsonResponse([]))
    expect(await fetchCurrentConditionsBatch([])).toEqual([])
    expect(calls).toHaveLength(0)
  })
})
