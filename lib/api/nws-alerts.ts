const NWS_BASE = 'https://api.weather.gov'

const HEADERS = {
  'User-Agent': 'WaveFinder/1.0 (surf-forecast-app; contact: heyrahil@gmail.com)',
  'Accept': 'application/geo+json',
}

const SURF_EVENTS = new Set([
  'High Surf Advisory',
  'High Surf Warning',
  'Beach Hazards Statement',
  'Rip Current Statement',
  'Coastal Flood Advisory',
  'Coastal Flood Warning',
  'Coastal Flood Watch',
  'Tsunami Advisory',
  'Tsunami Warning',
  'Tsunami Watch',
  'Special Marine Warning',
  'Marine Weather Statement',
  'Gale Warning',
  'Storm Warning',
])

export interface NWSAlert {
  id: string
  headline: string
  description: string
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown'
  urgency: 'Immediate' | 'Expected' | 'Future' | 'Past' | 'Unknown'
  event: string
  onset: string
  expires: string
  instruction: string | null
}

export async function fetchCoastalAlerts(lat: number, lng: number): Promise<NWSAlert[]> {
  try {
    const res = await fetch(
      `${NWS_BASE}/alerts/active?point=${lat.toFixed(4)},${lng.toFixed(4)}&status=actual`,
      {
        headers: HEADERS,
        next: { revalidate: 900 },
        signal: AbortSignal.timeout(10000),
      }
    )
    // NWS returns 404 for non-US coordinates — not an error, just no coverage
    if (!res.ok) return []

    const json = await res.json()
    const features: unknown[] = json?.features ?? []

    return features
      .map((f: unknown) => (f as { properties?: Record<string, unknown> }).properties ?? {})
      .filter((p) => SURF_EVENTS.has(String(p.event ?? '')))
      .map((p) => ({
        id: String(p.id ?? Math.random()),
        headline: String(p.headline ?? p.event ?? ''),
        description: String(p.description ?? '').slice(0, 600),
        severity: (p.severity as NWSAlert['severity']) ?? 'Unknown',
        urgency: (p.urgency as NWSAlert['urgency']) ?? 'Unknown',
        event: String(p.event ?? ''),
        onset: String(p.onset ?? ''),
        expires: String(p.expires ?? ''),
        instruction: p.instruction ? String(p.instruction).slice(0, 300) : null,
      }))
  } catch {
    return []
  }
}
