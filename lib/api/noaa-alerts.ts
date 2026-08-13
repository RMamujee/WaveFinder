const NWS_BASE = 'https://api.weather.gov'

// NWS requires a descriptive User-Agent with contact info
const HEADERS = {
  'User-Agent': 'WaveFinder/1.0 (heyrahil@gmail.com)',
  'Accept': 'application/geo+json',
}

export type AlertSeverity = 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown'

export interface NWSAlert {
  id: string
  event: string
  headline: string
  description: string
  severity: AlertSeverity
  effective: string
  expires: string
}

// Only show alerts a surfer cares about
const SURF_RELEVANT_EVENTS = new Set([
  'High Surf Advisory',
  'High Surf Warning',
  'Coastal Flood Advisory',
  'Coastal Flood Watch',
  'Coastal Flood Warning',
  'Coastal Flood Statement',
  'Rip Current Statement',
  'Beach Hazards Statement',
  'Special Marine Warning',
  'Hurricane Watch',
  'Hurricane Warning',
  'Tropical Storm Watch',
  'Tropical Storm Warning',
  'Tsunami Watch',
  'Tsunami Warning',
  'Tsunami Advisory',
])

export async function fetchSurfAlerts(lat: number, lng: number): Promise<NWSAlert[]> {
  try {
    const res = await fetch(
      `${NWS_BASE}/alerts/active?point=${lat.toFixed(4)},${lng.toFixed(4)}`,
      { headers: HEADERS, next: { revalidate: 1800 } }
    )

    // NWS returns 404 for non-US coordinates — treat as no alerts
    if (!res.ok) return []

    const data = await res.json()
    const features: unknown[] = data?.features ?? []

    return features
      .map((f: unknown) => {
        const p = (f as { properties: Record<string, unknown> }).properties
        return {
          id: String(p.id ?? ''),
          event: String(p.event ?? ''),
          headline: String(p.headline ?? p.event ?? ''),
          description: String(p.description ?? ''),
          severity: (p.severity as AlertSeverity) ?? 'Unknown',
          effective: String(p.effective ?? ''),
          expires: String(p.expires ?? ''),
        }
      })
      .filter((a) => SURF_RELEVANT_EVENTS.has(a.event))
  } catch {
    return []
  }
}
