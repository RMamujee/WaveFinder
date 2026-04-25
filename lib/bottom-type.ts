/**
 * Infers ocean bottom type from a surf spot's description.
 * Returns one of: 'Sand' | 'Reef' | 'Rock' | 'Cobblestone' | 'Sand & Reef'
 */
export function inferBottomType(description?: string | null): string {
  const d = (description ?? '').toLowerCase()

  // Cobblestone / pebble / shingle — check before 'rock' so "cobble" wins
  if (/cobble|pebble beach|shingle beach|gravel bottom/.test(d)) return 'Cobblestone'

  // Mixed sand and reef bottom
  if (/(sand and reef|reef and sand|sand\/reef|reef over sand|sand over reef)/.test(d)) return 'Sand & Reef'

  // Reef — explicit phrases first, then bare word
  if (/reef break|reef bottom|coral reef|submerged reef|lava reef|rocky reef|breaks over reef|over the reef|sits on reef/.test(d)) return 'Reef'
  if (/\breef\b/.test(d)) return 'Reef'

  // Rock — explicit bottom context, then point breaks, then general 'rock' near surf terms
  if (/rock bottom|rocky bottom|lava rock|basalt|limestone|rock ledge|rock shelf|rock platform|submerged rock|rocky shelf/.test(d)) return 'Rock'
  if (/\bpoint break\b/.test(d)) return 'Rock'
  if (/\brock\b/.test(d) && /\b(break|shore|bottom|wave|surf|ledge)\b/.test(d) && !/rockaway|rockport/.test(d)) return 'Rock'

  // Sand — explicit beach-break or sandy-bottom language
  if (/beach break|sandy bottom|sand bar|sandbar|sand bottom/.test(d)) return 'Sand'

  // Default: most open-ocean beaches have sand bottoms
  return 'Sand'
}

const BOTTOM_TYPE_STYLES: Record<string, { bg: string; color: string }> = {
  'Reef':        { bg: '#eff6ff', color: '#1d4ed8' },
  'Rock':        { bg: '#f3f4f6', color: '#374151' },
  'Cobblestone': { bg: '#fafaf9', color: '#57534e' },
  'Sand & Reef': { bg: '#fff7ed', color: '#c2410c' },
  'Sand':        { bg: '#fefce8', color: '#92400e' },
}

export function bottomTypeStyle(type: string): { bg: string; color: string } {
  return BOTTOM_TYPE_STYLES[type] ?? BOTTOM_TYPE_STYLES['Sand']
}
