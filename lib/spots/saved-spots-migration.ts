// One-time, idempotent migration of the saved-spots localStorage list from the
// legacy Postgres cuid ids to slug ids.
//
// Background: saved spots are stored in localStorage under 'wavefinder_saved'.
// Historically that array held the Postgres `SurfSpot.id` (a cuid). Spots are
// now keyed by slug everywhere, and new saves store the slug directly. This
// helper rewrites any lingering cuid entries to their slug so the list keeps
// resolving once the transitional cuid bridge is removed.
//
// Safety: if resolution fails for any reason the stored array is left exactly
// as-is (no data loss). The function is idempotent — once every entry is a
// slug there is nothing cuid-shaped left to migrate, so it becomes a no-op.

const SAVED_KEY = 'wavefinder_saved'

// A cuid is 20–36 lowercase alphanumerics with no hyphens. Slugs are
// hyphenated kebab-case (or short single words well under 20 chars), so this
// pattern only catches legacy cuid ids, never a real slug.
const CUID_RE = /^[a-z0-9]{20,36}$/

export function isCuidShaped(token: string): boolean {
  return CUID_RE.test(token)
}

function readSaved(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * Migrate any cuid-shaped saved-spot ids to their slug. Resolves cuids via
 * /api/spots?ids= and rewrites the localStorage array in place, preserving
 * order and de-duplicating. Dispatches the 'storage' event the app already
 * listens for so dependent views refresh. On any failure the array is left
 * unchanged.
 *
 * @returns true if the stored array was rewritten, false otherwise.
 */
export async function migrateSavedSpots(
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  let saved: string[]
  try {
    saved = readSaved()
  } catch {
    return false
  }

  if (saved.length === 0) return false

  const cuids = saved.filter(isCuidShaped)
  if (cuids.length === 0) return false // already all slugs — idempotent no-op

  // Resolve cuid → slug via the API (store-first, DB fallback for legacy cuids).
  const cuidToSlug = new Map<string, string>()
  try {
    const res = await fetchImpl(
      `/api/spots?ids=${cuids.map(encodeURIComponent).join(',')}`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return false
    const data: unknown = await res.json()
    if (!Array.isArray(data)) return false
    for (const row of data) {
      if (row && typeof row === 'object') {
        const id = (row as { id?: unknown }).id
        const slug = (row as { slug?: unknown }).slug
        if (typeof id === 'string' && typeof slug === 'string') {
          cuidToSlug.set(id, slug)
        }
      }
    }
  } catch {
    return false // network/timeout/parse error — leave the array untouched
  }

  // Compare-and-set: the snapshot read at the top is now stale — the awaited
  // fetch above yielded the event loop, during which SaveSpotButton may have
  // done its own read-modify-write of 'wavefinder_saved'. Re-read the FRESH
  // array and apply the cuid→slug mapping to it so a concurrent save survives.
  const fresh = readSaved()

  // Rewrite: cuids we resolved become their slug; everything else is kept as-is
  // (unresolved cuids stay so a future run can retry — no data loss).
  const seen = new Set<string>()
  const next: string[] = []
  let changed = false
  for (const token of fresh) {
    const mapped = isCuidShaped(token) ? cuidToSlug.get(token) : undefined
    const value = mapped ?? token
    if (mapped) changed = true
    if (!seen.has(value)) {
      seen.add(value)
      next.push(value)
    }
  }

  if (!changed) return false

  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(next))
  } catch {
    return false // QuotaExceededError etc. — original array still intact
  }
  window.dispatchEvent(new Event('storage'))
  return true
}
