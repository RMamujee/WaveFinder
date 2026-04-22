const BASE = 'https://waterservices.usgs.gov/nwis/iv/'

export interface RiverStation {
  siteId: string
  siteName: string
  dischargeCfs: number  // cubic feet per second; high = elevated runoff risk
  time: string          // ISO
  flowLevel: 'low' | 'moderate' | 'high' | 'flood'
}

function classifyFlow(cfs: number): RiverStation['flowLevel'] {
  // Rough thresholds — real percentile data requires a separate USGS stats call
  if (cfs < 50)   return 'low'
  if (cfs < 500)  return 'moderate'
  if (cfs < 2000) return 'high'
  return 'flood'
}

export async function fetchRiverRunoff(lat: number, lng: number): Promise<RiverStation[]> {
  const delta = 0.5  // ~55 km bounding box
  const params = new URLSearchParams({
    format: 'json',
    bBox: `${(lng - delta).toFixed(4)},${(lat - delta).toFixed(4)},${(lng + delta).toFixed(4)},${(lat + delta).toFixed(4)}`,
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
    const series: any[] = json?.value?.timeSeries ?? []

    return series
      .slice(0, 5)
      .map((s: any) => {
        const vals: any[] = s.values?.[0]?.value ?? []
        const latest = vals[vals.length - 1]
        if (!latest) return null
        const cfs = parseFloat(latest.value)
        if (isNaN(cfs) || cfs < 0) return null
        return {
          siteId: s.sourceInfo?.siteCode?.[0]?.value ?? '',
          siteName: s.sourceInfo?.siteName ?? 'Unknown',
          dischargeCfs: Math.round(cfs),
          time: latest.dateTime ?? '',
          flowLevel: classifyFlow(cfs),
        } satisfies RiverStation
      })
      .filter((r): r is RiverStation => r !== null)
  } catch {
    return []
  }
}
