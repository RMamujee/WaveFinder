const BASE = 'https://waterservices.usgs.gov/nwis/iv/'

export interface RiverStation {
  siteId: string
  siteName: string
  dischargeCfs: number  // cubic feet per second; high = elevated runoff risk
  time: string          // ISO
  flowLevel: 'low' | 'moderate' | 'high' | 'flood'
  distanceKm: number
}

// A gauge is only relevant if its outflow could plausibly reach this beach.
// The old 0.5° box (~55 km) handed Malibu the Los Angeles River, Piru Creek and
// Sespe Creek — 36-56 km away and draining to entirely different coastlines.
export const MAX_STATION_KM = 25

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (d: number) => d * (Math.PI / 180)
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function classifyFlow(cfs: number): RiverStation['flowLevel'] {
  // Rough thresholds — real percentile data requires a separate USGS stats call
  if (cfs < 50)   return 'low'
  if (cfs < 500)  return 'moderate'
  if (cfs < 2000) return 'high'
  return 'flood'
}

export async function fetchRiverRunoff(lat: number, lng: number): Promise<RiverStation[]> {
  // Bounding box that circumscribes MAX_STATION_KM; the corners reach further
  // than the radius, so the haversine filter below is what actually caps it.
  const latDelta = MAX_STATION_KM / 111
  const lngDelta = MAX_STATION_KM / (111 * Math.max(0.05, Math.cos(lat * Math.PI / 180)))
  const params = new URLSearchParams({
    format: 'json',
    bBox: `${(lng - lngDelta).toFixed(4)},${(lat - latDelta).toFixed(4)},${(lng + lngDelta).toFixed(4)},${(lat + latDelta).toFixed(4)}`,
    parameterCd: '00060',  // Streamflow in cubic feet per second
    siteType: 'ST',
    siteStatus: 'active',
  })

  try {
    const res = await fetch(`${BASE}?${params}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(12000),
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return []
    const json = await res.json()
    const series: unknown[] = json?.value?.timeSeries ?? []

    return series
      .map((entry: unknown) => {
        const s = entry as {
          sourceInfo?: {
            siteName?: string
            siteCode?: { value?: string }[]
            geoLocation?: { geogLocation?: { latitude?: number; longitude?: number } }
          }
          values?: { value?: { value?: string; dateTime?: string }[] }[]
        }
        const vals = s.values?.[0]?.value ?? []
        const latest = vals[vals.length - 1]
        if (!latest) return null
        const cfs = parseFloat(latest.value ?? '')
        if (isNaN(cfs) || cfs < 0) return null
        const geo = s.sourceInfo?.geoLocation?.geogLocation
        if (geo?.latitude == null || geo?.longitude == null) return null
        const distanceKm = haversineKm(lat, lng, geo.latitude, geo.longitude)
        if (distanceKm > MAX_STATION_KM) return null
        return {
          siteId: s.sourceInfo?.siteCode?.[0]?.value ?? '',
          siteName: s.sourceInfo?.siteName ?? 'Unknown',
          dischargeCfs: Math.round(cfs),
          time: latest.dateTime ?? '',
          flowLevel: classifyFlow(cfs),
          distanceKm: Math.round(distanceKm * 10) / 10,
        } satisfies RiverStation
      })
      .filter((r): r is RiverStation => r !== null)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 5)
  } catch {
    return []
  }
}
