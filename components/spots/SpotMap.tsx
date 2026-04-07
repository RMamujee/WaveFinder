'use client'

import { useEffect, useRef } from 'react'
import type { SurfSpot } from '@/types/spot'
import type { ConditionRating } from '@/types/forecast'

interface SpotWithRating extends SurfSpot {
  currentRating?: ConditionRating | 'unknown'
  currentWaveHeight?: number | null
  currentPeriod?: number | null
  currentWindSpeed?: number | null
  currentWindDir?: string | null
  wavePower?: number | null
}

interface Props {
  spots: SpotWithRating[]
  centerLat?: number
  centerLng?: number
  zoom?: number
}

const RATING_COLORS: Record<ConditionRating | 'unknown', { bg: string; border: string; text: string }> = {
  poor:    { bg: '#e5e7eb', border: '#9ca3af', text: '#6b7280' },
  fair:    { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  good:    { bg: '#d1fae5', border: '#16a34a', text: '#15803d' },
  epic:    { bg: '#ede9fe', border: '#7c3aed', text: '#6d28d9' },
  unknown: { bg: '#f3f4f6', border: '#d1d5db', text: '#9ca3af' },
}

const RATING_LABELS: Record<ConditionRating | 'unknown', string> = {
  poor: 'Poor', fair: 'Fair', good: 'Good', epic: 'EPIC', unknown: 'No data',
}

const DIFFICULTY_COLOR: Record<string, string> = {
  beginner: '#15803d',
  intermediate: '#b45309',
  advanced: '#b91c1c',
}

// How many spots to show per zoom level
// zoom ≤ 7:  one representative per region (~9 markers)
// zoom 8–9:  up to 30 markers in viewport
// zoom 10+:  all markers in viewport
function selectVisibleSpots(
  spots: SpotWithRating[],
  zoom: number,
  bounds: { north: number; south: number; east: number; west: number } | null
): SpotWithRating[] {
  if (!bounds) return []

  // Expand bounds slightly to avoid pop-in at edges
  const pad = 0.15
  const nb = bounds.north + pad
  const sb = bounds.south - pad
  const eb = bounds.east + pad
  const wb = bounds.west - pad

  const inView = spots.filter(
    (s) => s.lat <= nb && s.lat >= sb && s.lng <= eb && s.lng >= wb
  )

  if (zoom >= 10) return inView

  if (zoom >= 8) {
    // Show up to 35 spots; prefer those with condition data
    const sorted = [...inView].sort((a, b) => {
      const ratingOrder = { epic: 0, good: 1, fair: 2, poor: 3, unknown: 4 }
      const ra = ratingOrder[a.currentRating ?? 'unknown']
      const rb = ratingOrder[b.currentRating ?? 'unknown']
      return ra - rb
    })
    return sorted.slice(0, 35)
  }

  // zoom ≤ 7: one representative per region (best rating)
  const ratingOrder = { epic: 0, good: 1, fair: 2, poor: 3, unknown: 4 }
  const byRegion = new Map<string, SpotWithRating>()
  for (const spot of inView) {
    const existing = byRegion.get(spot.region)
    if (!existing) {
      byRegion.set(spot.region, spot)
    } else {
      const ea = ratingOrder[existing.currentRating ?? 'unknown']
      const sa = ratingOrder[spot.currentRating ?? 'unknown']
      if (sa < ea) byRegion.set(spot.region, spot)
    }
  }
  return [...byRegion.values()]
}

function buildMarkerHtml(spot: SpotWithRating) {
  const rating = spot.currentRating ?? 'unknown'
  const colors = RATING_COLORS[rating]
  const hasWave = spot.currentWaveHeight != null && spot.currentWaveHeight > 0
  const heightFtLabel = hasWave
    ? `${Math.round(spot.currentWaveHeight! * 3.281)}ft`
    : '—'
  const labelFontSize = heightFtLabel.length > 3 ? '8px' : '9px'

  return `
    <div title="${spot.name}" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
      <div style="
        background:${colors.bg};border:2.5px solid ${colors.border};border-radius:50%;
        width:36px;height:36px;display:flex;align-items:center;justify-content:center;
        font-family:'DM Sans',sans-serif;font-size:${labelFontSize};font-weight:800;
        color:${colors.text};box-shadow:0 2px 8px rgba(0,0,0,0.15);
        letter-spacing:-0.3px;line-height:1;
      ">${heightFtLabel}</div>
      <div style="width:2px;height:6px;background:${colors.border};margin-top:1px;"></div>
    </div>
  `
}

function buildTooltipHtml(spot: SpotWithRating) {
  const rating = spot.currentRating ?? 'unknown'
  const colors = RATING_COLORS[rating]
  const hasWave = spot.currentWaveHeight != null && spot.currentWaveHeight > 0
  const heightFt = hasWave ? Math.round(spot.currentWaveHeight! * 3.281) : null
  const heightM = hasWave ? spot.currentWaveHeight!.toFixed(1) : null
  const period = spot.currentPeriod != null ? Math.round(spot.currentPeriod!) : null
  const power = spot.wavePower != null ? Math.round(spot.wavePower!) : null

  const waveSection = hasWave ? `
    <div style="display:flex;gap:12px;margin:8px 0 6px;">
      <div>
        <div style="font-size:10px;color:#8888aa;margin-bottom:1px;">Wave Height</div>
        <div style="font-size:16px;font-weight:700;color:#1a1a2e;font-family:'Playfair Display',serif;">${heightFt}ft</div>
        <div style="font-size:10px;color:#8888aa;">${heightM}m</div>
      </div>
      ${period ? `<div>
        <div style="font-size:10px;color:#8888aa;margin-bottom:1px;">Period</div>
        <div style="font-size:16px;font-weight:700;color:#1a1a2e;font-family:'Playfair Display',serif;">${period}s</div>
      </div>` : ''}
      ${power ? `<div>
        <div style="font-size:10px;color:#8888aa;margin-bottom:1px;">Power</div>
        <div style="font-size:16px;font-weight:700;color:#1a1a2e;font-family:'Playfair Display',serif;">${power}</div>
        <div style="font-size:10px;color:#8888aa;">kW/m</div>
      </div>` : ''}
    </div>
    ${spot.currentWindSpeed != null ? `
      <div style="font-size:11px;color:#6b7280;margin-bottom:6px;">
        💨 ${Math.round(spot.currentWindSpeed!)} km/h ${spot.currentWindDir ?? ''}
      </div>` : ''}
  ` : `<div style="font-size:11px;color:#8888aa;margin:6px 0;font-style:italic;">No live conditions — click for forecast</div>`

  return `
    <div style="font-family:'DM Sans',sans-serif;padding:12px 14px;min-width:180px;">
      <div style="font-size:10px;color:#8888aa;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:2px;">${spot.region}</div>
      <div style="font-size:14px;font-weight:700;color:#1a1a2e;line-height:1.2;">${spot.name}</div>
      <div style="font-size:10px;color:${DIFFICULTY_COLOR[spot.difficulty] ?? '#6b7280'};margin-top:2px;text-transform:capitalize;font-weight:600;">${spot.difficulty}</div>
      ${waveSection}
      <div style="display:inline-flex;align-items:center;background:${colors.bg};border:1.5px solid ${colors.border};color:${colors.text};border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;">${RATING_LABELS[rating]}</div>
      <div style="font-size:10px;color:#8888aa;margin-top:6px;">Click for full forecast →</div>
    </div>
  `
}

function buildPopupHtml(spot: SpotWithRating) {
  const rating = spot.currentRating ?? 'unknown'
  const colors = RATING_COLORS[rating]
  const hasWave = spot.currentWaveHeight != null && spot.currentWaveHeight > 0
  const heightFt = hasWave ? Math.round(spot.currentWaveHeight! * 3.281) : null
  const heightM = hasWave ? spot.currentWaveHeight!.toFixed(1) : null
  const period = spot.currentPeriod != null ? Math.round(spot.currentPeriod!) : null
  const power = spot.wavePower != null ? Math.round(spot.wavePower!) : null
  const heightStr = hasWave ? `${heightM}m (${heightFt}ft)` : '—'

  return `
    <div style="width:210px;padding:14px;font-family:'DM Sans',sans-serif;">
      <div style="font-size:11px;color:#8888aa;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.05em;">${spot.region}</div>
      <div style="font-size:15px;font-weight:600;color:#1a1a2e;margin-bottom:8px;">${spot.name}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div>
          <div style="font-size:13px;font-weight:600;color:#1a1a2e;">${heightStr}</div>
          ${period ? `<div style="font-size:11px;color:#8888aa;">${period}s period${power ? ` · ${power} kW/m` : ''}</div>` : ''}
        </div>
        <div style="background:${colors.bg};border:1.5px solid ${colors.border};color:${colors.text};border-radius:20px;padding:3px 10px;font-size:12px;font-weight:700;">${RATING_LABELS[rating]}</div>
      </div>
      <a href="/spots/${spot.slug}" style="display:block;background:#1b7fcb;color:white;text-align:center;padding:7px 0;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">View Forecast →</a>
    </div>
  `
}

export function SpotMap({ spots, centerLat = 33.7, centerLng = -117.8, zoom = 9 }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)
  const markersRef = useRef<unknown[]>([])
  const leafletRef = useRef<typeof import('leaflet') | null>(null)

  // Initial map setup — runs once
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return

    let L: typeof import('leaflet')

    const init = async () => {
      L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      leafletRef.current = L

      if (mapInstanceRef.current) {
        (mapInstanceRef.current as L.Map).remove()
        mapInstanceRef.current = null
      }

      const map = L.map(mapRef.current!, {
        center: [centerLat, centerLng],
        zoom,
        zoomControl: true,
        scrollWheelZoom: true,
      })

      mapInstanceRef.current = map

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)

      // Redraw markers whenever zoom or pan changes
      const redraw = () => drawMarkers(map, L, spots)
      map.on('zoomend moveend', redraw)

      // Initial draw
      drawMarkers(map, L, spots)
    }

    init().catch(console.error)

    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as L.Map).remove()
        mapInstanceRef.current = null
        markersRef.current = []
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerLat, centerLng, zoom])

  // Re-draw markers when spots data changes (conditions arrive)
  useEffect(() => {
    const map = mapInstanceRef.current
    const L = leafletRef.current
    if (!map || !L) return
    drawMarkers(map as import('leaflet').Map, L, spots)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots.map(s => `${s.id}:${s.currentRating ?? '?'}:${s.currentWaveHeight ?? 0}`).join('|')])

  function drawMarkers(
    map: import('leaflet').Map,
    L: typeof import('leaflet'),
    allSpots: SpotWithRating[]
  ) {
    // Clear existing markers
    for (const m of markersRef.current) {
      (m as import('leaflet').Marker).remove()
    }
    markersRef.current = []

    const currentZoom = map.getZoom()
    const b = map.getBounds()
    const bounds = {
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
    }

    const visible = selectVisibleSpots(allSpots, currentZoom, bounds)

    for (const spot of visible) {
      const icon = L.divIcon({
        className: '',
        html: buildMarkerHtml(spot),
        iconSize: [36, 44],
        iconAnchor: [18, 44],
        popupAnchor: [0, -48],
      })

      const marker = L.marker([spot.lat, spot.lng], { icon })
      marker.bindTooltip(buildTooltipHtml(spot), {
        permanent: false,
        sticky: false,
        direction: 'top',
        offset: [0, -48],
        opacity: 1,
        className: 'spot-hover-tooltip',
      })
      marker.bindPopup(buildPopupHtml(spot), { maxWidth: 230, minWidth: 210 })
      marker.addTo(map)
      markersRef.current.push(marker)
    }

    // Show zoom hint at low zoom
    updateZoomHint(map, L, currentZoom, visible.length, allSpots.length)
  }

  function updateZoomHint(
    map: import('leaflet').Map,
    L: typeof import('leaflet'),
    currentZoom: number,
    shown: number,
    total: number
  ) {
    // Remove old hint
    const old = (map as unknown as Record<string, unknown>)._zoomHint as import('leaflet').Control | undefined
    if (old) old.remove()

    if (currentZoom < 10 && total > shown) {
      const hint = new L.Control({ position: 'bottomright' })
      hint.onAdd = () => {
        const div = L.DomUtil.create('div')
        div.innerHTML = `<div style="background:rgba(255,255,255,0.92);border:1px solid #e5e7eb;border-radius:10px;padding:6px 12px;font-family:'DM Sans',sans-serif;font-size:12px;color:#6b7280;box-shadow:0 2px 8px rgba(0,0,0,0.08);">Showing ${shown} of ${total} spots — zoom in to see more</div>`
        return div
      }
      hint.addTo(map)
      ;(map as unknown as Record<string, unknown>)._zoomHint = hint
    } else {
      ;(map as unknown as Record<string, unknown>)._zoomHint = undefined
    }
  }

  return (
    <div
      ref={mapRef}
      className="h-full w-full"
      style={{ minHeight: '100%' }}
    />
  )
}
