import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isCuidShaped, migrateSavedSpots } from '@/lib/spots/saved-spots-migration'

const SAVED_KEY = 'wavefinder_saved'

// Minimal localStorage + window stubs for the Node test environment.
function installStorage(initial: string[]) {
  const store = new Map<string, string>()
  store.set(SAVED_KEY, JSON.stringify(initial))
  const localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  }
  const events: Event[] = []
  const win = { dispatchEvent: (e: Event) => { events.push(e); return true } }
  // @ts-expect-error — test-only global stubs
  globalThis.localStorage = localStorage
  // @ts-expect-error — test-only global stubs
  globalThis.window = win
  return {
    read: () => JSON.parse(store.get(SAVED_KEY) ?? '[]') as string[],
    events,
  }
}

// A representative cuid (25 lowercase alphanumerics).
const CUID_A = 'ckabcd1234efgh5678ijklm'
const CUID_B = 'cl0987zyxwv6543210pqrst'

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as unknown as Response
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('isCuidShaped', () => {
  it('detects cuid-shaped tokens', () => {
    expect(isCuidShaped(CUID_A)).toBe(true)
    expect(isCuidShaped(CUID_B)).toBe(true)
  })

  it('rejects slug-shaped and short tokens', () => {
    expect(isCuidShaped('blacks-beach')).toBe(false)
    expect(isCuidShaped('windansea')).toBe(false)
    expect(isCuidShaped('uluwatu')).toBe(false)
    expect(isCuidShaped('')).toBe(false)
  })
})

describe('migrateSavedSpots', () => {
  it('rewrites cuid entries to slugs and dispatches a storage event', async () => {
    const ctx = installStorage([CUID_A, CUID_B])
    const fetchImpl = vi.fn(async () =>
      jsonResponse([
        { id: CUID_A, slug: 'blacks-beach' },
        { id: CUID_B, slug: 'uluwatu' },
      ])
    )

    const changed = await migrateSavedSpots(fetchImpl as unknown as typeof fetch)

    expect(changed).toBe(true)
    expect(ctx.read()).toEqual(['blacks-beach', 'uluwatu'])
    expect(ctx.events.length).toBe(1)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('leaves slug-only arrays untouched and makes no network call', async () => {
    const ctx = installStorage(['blacks-beach', 'uluwatu'])
    const fetchImpl = vi.fn(async () => jsonResponse([]))

    const changed = await migrateSavedSpots(fetchImpl as unknown as typeof fetch)

    expect(changed).toBe(false)
    expect(ctx.read()).toEqual(['blacks-beach', 'uluwatu'])
    expect(ctx.events.length).toBe(0)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('is idempotent: a second run after migration is a no-op', async () => {
    const ctx = installStorage([CUID_A])
    const fetchImpl = vi.fn(async () =>
      jsonResponse([{ id: CUID_A, slug: 'blacks-beach' }])
    )

    const first = await migrateSavedSpots(fetchImpl as unknown as typeof fetch)
    expect(first).toBe(true)
    expect(ctx.read()).toEqual(['blacks-beach'])

    const second = await migrateSavedSpots(fetchImpl as unknown as typeof fetch)
    expect(second).toBe(false)
    expect(ctx.read()).toEqual(['blacks-beach'])
    expect(fetchImpl).toHaveBeenCalledTimes(1) // not called again
  })

  it('leaves the array unchanged when resolution fails (non-ok response)', async () => {
    const ctx = installStorage([CUID_A, CUID_B])
    const fetchImpl = vi.fn(async () => ({ ok: false, json: async () => [] }) as unknown as Response)

    const changed = await migrateSavedSpots(fetchImpl as unknown as typeof fetch)

    expect(changed).toBe(false)
    expect(ctx.read()).toEqual([CUID_A, CUID_B])
    expect(ctx.events.length).toBe(0)
  })

  it('leaves the array unchanged when fetch throws', async () => {
    const ctx = installStorage([CUID_A])
    const fetchImpl = vi.fn(async () => { throw new Error('network down') })

    const changed = await migrateSavedSpots(fetchImpl as unknown as typeof fetch)

    expect(changed).toBe(false)
    expect(ctx.read()).toEqual([CUID_A])
  })

  it('keeps unresolved cuids and migrates the resolvable ones', async () => {
    const ctx = installStorage([CUID_A, CUID_B])
    const fetchImpl = vi.fn(async () =>
      jsonResponse([{ id: CUID_A, slug: 'blacks-beach' }]) // CUID_B not returned
    )

    const changed = await migrateSavedSpots(fetchImpl as unknown as typeof fetch)

    expect(changed).toBe(true)
    expect(ctx.read()).toEqual(['blacks-beach', CUID_B])
  })

  it('empty saved array is a no-op', async () => {
    const ctx = installStorage([])
    const fetchImpl = vi.fn(async () => jsonResponse([]))

    const changed = await migrateSavedSpots(fetchImpl as unknown as typeof fetch)

    expect(changed).toBe(false)
    expect(ctx.read()).toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
