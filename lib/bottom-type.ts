/**
 * Guess a spot's bottom type from its prose.
 *
 * This ran at request time against marketing copy, which meant editing a
 * description silently re-rated the spot. It is now a ONE-TIME migration:
 * `scripts/backfill-bottom-type.ts` writes the result into the seed as an
 * explicit `bottomType` field, and the store reads that field. Keep this
 * function for backfilling newly-added spots (and for the transitional
 * Postgres-cuid path in /api/spots, whose rows carry no stored bottom type).
 *
 * Rule order matters and three of the original orderings were wrong:
 *  - `/reef/` ran first, so 58 spots described as "beach and reef" came out as
 *    pure reef. Mixed bottoms are now detected before any single material.
 *  - the point-break rule sat below a `/beach|break/` catch-all that matched
 *    the word "break" in "point break", so it never fired — Rincon Point, a
 *    cobblestone point, was classified as sand.
 *  - that same catch-all made sand the de-facto default for anything whose
 *    description contained "break". It is still the last resort, but only
 *    after the specific rules have had their say.
 */
export function inferBottomType(description?: string | null, name?: string | null): string {
  const text = ((description ?? '') + ' ' + (name ?? '')).toLowerCase()

  // "sand and reef", "reef and sand bottom", "part beach break, part rock" —
  // described as more than one material, so don't pick a winner.
  if (/(?:sand|sandy|beach)[^.]{0,30}\b(?:and|to|over|with|\/)\b[^.]{0,30}(?:reef|rock|coral)/.test(text)) return 'mixed'
  if (/(?:reef|rock|rocky|coral)[^.]{0,30}\b(?:and|to|over|with|\/)\b[^.]{0,30}(?:sand|sandy|beach)/.test(text)) return 'mixed'

  if (/coral/.test(text)) return 'coral'
  // Point breaks are rock or cobble by definition. This must precede `reef`
  // and the generic catch-all.
  if (/point\s*break|rocky\s+point|cobble(?:stone)?s?|boulder/.test(text)) return 'rock'
  if (/reef/.test(text)) return 'reef'
  if (/rock(?:y)?(?:\s+(?:bottom|shore|ledge|ledges|shelf|slab))?/.test(text)) return 'rock'
  if (/sand(?:y|bar|bank)?|beach\s+break|river\s*mouth|jett(?:y|ies)|sandbar/.test(text)) return 'sand'
  // Last resort: something called a beach, or simply "a break", is sand until
  // the prose says otherwise.
  if (/beach|break/.test(text)) return 'sand'
  return 'mixed'
}

export const BOTTOM_TYPES = ['sand', 'reef', 'rock', 'coral', 'mixed'] as const
export type BottomType = (typeof BOTTOM_TYPES)[number]

export const BOTTOM_TYPE_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  sand:  { color: '#92400e', bg: '#fef3c7', label: 'Sand'  },
  reef:  { color: '#9a3412', bg: '#ffedd5', label: 'Reef'  },
  rock:  { color: '#374151', bg: '#f3f4f6', label: 'Rock'  },
  coral: { color: '#9d174d', bg: '#fce7f3', label: 'Coral' },
  mixed: { color: '#1e40af', bg: '#dbeafe', label: 'Mixed' },
}
