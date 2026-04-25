export function inferBottomType(description?: string | null, name?: string | null): string {
  const text = ((description ?? '') + ' ' + (name ?? '')).toLowerCase()
  if (/coral/.test(text)) return 'coral'
  if (/reef/.test(text)) return 'reef'
  if (/rock(?:y)?(?:\s+(?:reef|bottom|point|shore|ledge|shelf))?|cobble(?:stone)?/.test(text)) return 'rock'
  if (/sand(?:y|bar|bank)?|beach\s+break/.test(text)) return 'sand'
  if (/point\s+break/.test(text)) return 'rock'
  if (/river\s*mouth/.test(text)) return 'sand'
  if (/beach|break/.test(text)) return 'sand'
  return 'mixed'
}

export const BOTTOM_TYPE_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  sand:  { color: '#92400e', bg: '#fef3c7', label: 'Sand'  },
  reef:  { color: '#9a3412', bg: '#ffedd5', label: 'Reef'  },
  rock:  { color: '#374151', bg: '#f3f4f6', label: 'Rock'  },
  coral: { color: '#9d174d', bg: '#fce7f3', label: 'Coral' },
  mixed: { color: '#1e40af', bg: '#dbeafe', label: 'Mixed' },
}
