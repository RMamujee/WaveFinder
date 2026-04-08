'use client'

import { useEffect, useRef } from 'react'
import type { SurfSpot, ParkingOption } from '@/types/spot'
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
  beginner:     '#15803d',
  intermediate: '#b45309',
  advanced:     '#b91c1c',
}

const PARKING_ZOOM_THRESHOLD = 13

function parkingPriceLabel(p: ParkingOption): string {
  if (p.isFree) return 'Free'
  if (p.dailyMax && !p.pricePerHour) return `$${p.dailyMax}/day`
  if (p.pricePerHour) {
    const hr = `$${p.pricePerHour.toFixed(2).replace('.00', '')}/hr`
    return p.dailyMax ? `${hr} (max $${p.dailyMax}/day)` : hr
  }
  return 'Paid'
}

function parkingPopupHtml(p: ParkingOption): string {
  const typeLabel = p.type === 'lot' ? 'Parking Lot' : p.type === 'street' ? 'Street Parking' : p.type === 'structure' ? 'Parking Structure' : 'Roadside Pullout'
  const priceColor = p.isFree ? '#15803d' : '#b45309'
  const timeLimit = p.maxStayHours ? `${p.maxStayHours}hr max stay` : 'No time limit'

  return `<div style="width:200px;padding:12px 14px;font-family:'DM Sans',sans-serif;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
      <div style="background:#1e40af;border-radius:6px;width:26px;height:26px;display:flex;align-items:center;
        justify-content:center;font-size:14px;font-weight:900;color:white;flex-shrink:0;">P</div>
      <div style="font-size:13px;font-weight:700;color:#1a1a2e;line-height:1.2;">${p.name}</div>
    </div>
    <div style="font-size:10px;color:#8888aa;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">${typeLabel}</div>
    <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:11px;color:#6b7280;">Price</span>
        <span style="font-size:12px;font-weight:700;color:${priceColor};">${parkingPriceLabel(p)}</span>
      </div>
      ${p.hours ? `<div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:11px;color:#6b7280;">Hours</span>
        <span style="font-size:11px;font-weight:600;color:#374151;">${p.hours}</span>
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:11px;color:#6b7280;">Time limit</span>
        <span style="font-size:11px;font-weight:600;color:#374151;">${timeLimit}</span>
      </div>
    </div>
    ${p.notes ? `<div style="font-size:10px;color:#6b7280;font-style:italic;border-top:1px solid #f3f4f6;padding-top:6px;">${p.notes}</div>` : ''}
  </div>`
}

function tooltipHtml(spot: SpotWithRating): string {
  const rating = spot.currentRating ?? 'unknown'
  const colors = RATING_COLORS[rating]
  const h = spot.currentWaveHeight
  const hasWave = h !== null && h !== undefined && h > 0
  const heightFt = hasWave ? Math.round(h! * 3.281) : null
  const heightM  = hasWave ? h!.toFixed(1) : null
  const period   = spot.currentPeriod != null ? Math.round(spot.currentPeriod!) : null
  const power    = spot.wavePower != null ? Math.round(spot.wavePower!) : null

  const waveSection = hasWave ? `
    <div style="display:flex;gap:12px;margin:8px 0 6px;">
      <div>
        <div style="font-size:10px;color:#8888aa;margin-bottom:1px;">Wave Height</div>
        <div style="font-size:16px;font-weight:700;color:#1a1a2e;font-family:'Playfair Display',serif;">${heightFt}ft</div>
        <div style="font-size:10px;color:#8888aa;">${heightM}m</div>
      </div>
      ${period ? `<div><div style="font-size:10px;color:#8888aa;margin-bottom:1px;">Period</div>
        <div style="font-size:16px;font-weight:700;color:#1a1a2e;font-family:'Playfair Display',serif;">${period}s</div></div>` : ''}
      ${power ? `<div><div style="font-size:10px;color:#8888aa;margin-bottom:1px;">Power</div>
        <div style="font-size:16px;font-weight:700;color:#1a1a2e;font-family:'Playfair Display',serif;">${power}</div>
        <div style="font-size:10px;color:#8888aa;">kW/m</div></div>` : ''}
    </div>
    ${spot.currentWindSpeed != null ? `<div style="font-size:11px;color:#6b7280;margin-bottom:6px;">
      💨 ${Math.round(spot.currentWindSpeed! * 0.621371)} mph ${spot.currentWindDir ?? ''}</div>` : ''}
  ` : h === 0 ? `<div style="font-size:11px;color:#8888aa;margin:6px 0;font-style:italic;">Flat — no rideable waves today</div>`
    : `<div style="font-size:11px;color:#8888aa;margin:6px 0;font-style:italic;">No live data — click for forecast</div>`

  return `<div style="font-family:'DM Sans',sans-serif;padding:12px 14px;min-width:180px;">
    <div style="font-size:10px;color:#8888aa;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:2px;">${spot.region}</div>
    <div style="font-size:14px;font-weight:700;color:#1a1a2e;line-height:1.2;">${spot.name}</div>
    <div style="font-size:10px;color:${DIFFICULTY_COLOR[spot.difficulty] ?? '#6b7280'};margin-top:2px;text-transform:capitalize;font-weight:600;">${spot.difficulty}</div>
    ${waveSection}
    <div style="display:inline-flex;align-items:center;background:${colors.bg};border:1.5px solid ${colors.border};
      color:${colors.text};border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;">${RATING_LABELS[rating]}</div>
    <div style="font-size:10px;color:#8888aa;margin-top:6px;">Click for full forecast →</div>
  </div>`
}

function popupHtml(spot: SpotWithRating): string {
  const rating = spot.currentRating ?? 'unknown'
  const colors = RATING_COLORS[rating]
  const h = spot.currentWaveHeight
  const hasWave = h !== null && h !== undefined && h > 0
  const heightFt = hasWave ? Math.round(h! * 3.281) : null
  const heightM  = hasWave ? h!.toFixed(1) : null
  const period   = spot.currentPeriod != null ? Math.round(spot.currentPeriod!) : null
  const power    = spot.wavePower != null ? Math.round(spot.wavePower!) : null
  const heightStr = hasWave ? `${heightM}m (${heightFt}ft)` : h === 0 ? 'Flat' : '—'

  return `<div style="width:210px;padding:14px;font-family:'DM Sans',sans-serif;">
    <div style="font-size:11px;color:#8888aa;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.05em;">${spot.region}</div>
    <div style="font-size:15px;font-weight:600;color:#1a1a2e;margin-bottom:8px;">${spot.name}</div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <div>
        <div style="font-size:13px;font-weight:600;color:#1a1a2e;">${heightStr}</div>
        ${period ? `<div style="font-size:11px;color:#8888aa;">${period}s period${power ? ` · ${power} kW/m` : ''}</div>` : ''}
      </div>
      <div style="background:${colors.bg};border:1.5px solid ${colors.border};color:${colors.text};
        border-radius:20px;padding:3px 10px;font-size:12px;font-weight:700;">${RATING_LABELS[rating]}</div>
    </div>
    <a href="/spots/${spot.slug}" style="display:block;background:#1b7fcb;color:white;text-align:center;
      padding:7px 0;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">View Forecast →</a>
  </div>`
}

export function SpotMap({ spots, centerLat = 36.5, centerLng = -120.5, zoom = 7 }: Props) {
  const mapRef         = useRef<HTMLDivElement>(null)
  const mapInstance    = useRef<import('leaflet').Map | null>(null)
  const clusterRef     = useRef<unknown>(null)
  const parkingLayerRef = useRef<import('leaflet').LayerGroup | null>(null)
  // Always holds the latest spots so async Leaflet init reads enriched data
  // even when conditions arrive between when the effect was scheduled and when
  // the async Leaflet imports finish.
  const spotsRef       = useRef<SpotWithRating[]>(spots)
  spotsRef.current     = spots

  // Show or hide parking layer based on current zoom level
  function syncParkingVisibility(map: import('leaflet').Map, L: typeof import('leaflet'), parkingLayer: import('leaflet').LayerGroup) {
    if (map.getZoom() >= PARKING_ZOOM_THRESHOLD) {
      if (!map.hasLayer(parkingLayer)) parkingLayer.addTo(map)
    } else {
      if (map.hasLayer(parkingLayer)) map.removeLayer(parkingLayer)
    }
  }

  // Build parking layer from current spots data
  function buildParkingLayer(
    L: typeof import('leaflet'),
    allSpots: SpotWithRating[]
  ): import('leaflet').LayerGroup {
    const layer = L.layerGroup()

    for (const spot of allSpots) {
      const options = spot.parkingOptions as ParkingOption[] | null | undefined
      if (!options?.length) continue

      for (const p of options) {
        const isFree = p.isFree
        const icon = L.divIcon({
          className: '',
          html: `<div title="${p.name}" style="
            background:${isFree ? '#1e40af' : '#374151'};
            border:2px solid ${isFree ? '#93c5fd' : '#9ca3af'};
            border-radius:6px;width:22px;height:22px;
            display:flex;align-items:center;justify-content:center;
            font-family:'DM Sans',sans-serif;font-size:12px;font-weight:900;color:white;
            box-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:pointer;">P</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
          popupAnchor: [0, -14],
        })
        const marker = L.marker([p.lat, p.lng], { icon })
        marker.bindPopup(parkingPopupHtml(p), { maxWidth: 220, minWidth: 200 })
        layer.addLayer(marker)
      }
    }

    return layer
  }

  // Build / rebuild the cluster layer whenever spots data changes
  async function rebuildCluster(
    map: import('leaflet').Map,
    L: typeof import('leaflet'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MCG: any,
    allSpots: SpotWithRating[]
  ) {
    // Remove old cluster group
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current as import('leaflet').Layer)
    }
    // Remove old parking layer
    if (parkingLayerRef.current) {
      map.removeLayer(parkingLayerRef.current)
    }

    const group = new MCG({
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster: { getChildCount: () => number; getAllChildMarkers: () => Array<{ options: { icon: { options: { html: string } } } }> }) => {
        const count = cluster.getChildCount()
        // Pick the best rating among children for cluster color
        const ratingOrder: Record<string, number> = { epic: 0, good: 1, fair: 2, poor: 3, unknown: 4 }
        let bestRating: ConditionRating | 'unknown' = 'unknown'
        try {
          cluster.getAllChildMarkers().forEach((m) => {
            const html = m.options?.icon?.options?.html ?? ''
            const match = html.match(/data-rating="([^"]+)"/)
            if (match) {
              const r = match[1] as ConditionRating | 'unknown'
              if ((ratingOrder[r] ?? 4) < (ratingOrder[bestRating] ?? 4)) bestRating = r
            }
          })
        } catch { /* ignore */ }
        const c = RATING_COLORS[bestRating]
        return L.divIcon({
          className: '',
          html: `<div style="background:${c.bg};border:3px solid ${c.border};border-radius:50%;
            width:44px;height:44px;display:flex;align-items:center;justify-content:center;
            font-family:'DM Sans',sans-serif;font-size:13px;font-weight:800;color:${c.text};
            box-shadow:0 3px 12px rgba(0,0,0,0.2);cursor:pointer;">${count}</div>`,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        })
      },
    })

    for (const spot of allSpots) {
      const rating = spot.currentRating ?? 'unknown'
      const colors = RATING_COLORS[rating]
      const h = spot.currentWaveHeight
      const label = h == null ? '—' : h === 0 ? 'Flat' : `${Math.round(h * 3.281)}ft`
      const fontSize = label.length > 4 ? '7px' : label.length > 3 ? '8px' : '9px'

      const icon = L.divIcon({
        className: '',
        html: `<div data-rating="${rating}" title="${spot.name}"
          style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
          <div style="background:${colors.bg};border:2.5px solid ${colors.border};border-radius:50%;
            width:36px;height:36px;display:flex;align-items:center;justify-content:center;
            font-family:'DM Sans',sans-serif;font-size:${fontSize};font-weight:800;color:${colors.text};
            box-shadow:0 2px 8px rgba(0,0,0,0.15);letter-spacing:-0.3px;line-height:1;">${label}</div>
          <div style="width:2px;height:6px;background:${colors.border};margin-top:1px;"></div>
        </div>`,
        iconSize: [36, 44],
        iconAnchor: [18, 44],
        popupAnchor: [0, -48],
      })

      const marker = L.marker([spot.lat, spot.lng], { icon })
      marker.bindTooltip(tooltipHtml(spot), {
        permanent: false, sticky: false, direction: 'top',
        offset: [0, -48], opacity: 1, className: 'spot-hover-tooltip',
      })
      marker.bindPopup(popupHtml(spot), { maxWidth: 230, minWidth: 210 })
      group.addLayer(marker)
    }

    group.addTo(map)
    clusterRef.current = group

    // Build parking layer and sync visibility
    const parkingLayer = buildParkingLayer(L, allSpots)
    parkingLayerRef.current = parkingLayer
    syncParkingVisibility(map, L, parkingLayer)
  }

  // Initial map setup
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return
    let cancelled = false

    ;(async () => {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      await import('leaflet.markercluster/dist/MarkerCluster.css')
      await import('leaflet.markercluster/dist/MarkerCluster.Default.css')
      await import('leaflet.markercluster') // registers L.MarkerClusterGroup as side-effect
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const MarkerClusterGroup = (L as any).MarkerClusterGroup

      if (cancelled || !mapRef.current) return

      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
        clusterRef.current = null
        parkingLayerRef.current = null
      }

      const map = L.map(mapRef.current, {
        center: [centerLat, centerLng],
        zoom,
        zoomControl: true,
        scrollWheelZoom: true,
        worldCopyJump: true,
      })
      mapInstance.current = map

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)

      // Use spotsRef so we get the most recent enriched data — conditions may
      // have arrived (synchronous cache hit) while we were awaiting Leaflet imports.
      await rebuildCluster(map, L, MarkerClusterGroup, spotsRef.current)

      // Show/hide parking markers on zoom
      map.on('zoomend', () => {
        if (parkingLayerRef.current) {
          syncParkingVisibility(map, L, parkingLayerRef.current)
        }
      })
    })().catch(console.error)

    return () => {
      cancelled = true
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
        clusterRef.current = null
        parkingLayerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerLat, centerLng, zoom])

  // Update cluster when condition data arrives
  useEffect(() => {
    if (!mapInstance.current) return
    ;(async () => {
      const L = (await import('leaflet')).default
      await import('leaflet.markercluster')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const MarkerClusterGroup = (L as any).MarkerClusterGroup
      if (!mapInstance.current) return
      await rebuildCluster(mapInstance.current, L, MarkerClusterGroup, spots)
    })().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots.map(s => `${s.id}:${s.currentRating ?? '?'}:${s.currentWaveHeight ?? 'x'}`).join('|')])

  return <div ref={mapRef} className="h-full w-full" style={{ minHeight: '100%' }} />
}
