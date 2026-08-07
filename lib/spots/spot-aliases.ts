// Retired spot slugs → the record that replaced them.
//
// The seed carried eight duplicate records: same break, same name, either
// identical coordinates or a few tens of metres apart, sometimes disagreeing
// with their twin on facing, difficulty and tide station. Keeping both meant
// the map drew two markers on one peak and a user could save the "wrong" one.
//
// Where a pair disagreed, the FIRST record in seed order was kept — the later
// one is the appended duplicate. Deleting outright would 404 any bookmark and
// silently drop the spot from a saved-spots list, so the retired slug resolves
// to its replacement instead: `getSpotBySlug` follows the alias, and
// next.config redirects /spots/<old> to /spots/<new>.
//
// This is intentionally a fixed, short list, not a general renaming mechanism.
export const SPOT_SLUG_ALIASES: Readonly<Record<string, string>> = {
  // Exact-coordinate duplicates.
  'laniakea-north-shore': 'laniakea-oahu',
  'lahaina-harbor-surf': 'lahaina-harbor-maui',
  'pohnpei-outer-reef': 'pohnpei-micronesia',
  'vavau-tonga': 'vava-u-tonga',
  // Same break, metres apart, disagreeing on facing and/or tide station.
  'sunset-beach-oahu': 'sunset-beach',
  'gold-beach-or': 'gold-beach',
  'kalaloch-beach-wa': 'kalaloch-beach',
  // 8 km apart — the retired record was misplaced inland of Kahuku, not a
  // second break.
  'velzyland-north-shore': 'velzyland-oahu',
}

export function resolveSpotSlug(slug: string): string {
  return SPOT_SLUG_ALIASES[slug] ?? slug
}
