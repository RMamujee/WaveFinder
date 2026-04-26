'use client'

import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import type { SurfSpot, ParkingOption } from '@/types/spot'
import type { ConditionRating } from '@/types/forecast'

interface SpotWithRating extends SurfSpot {
  currentRating?: ConditionRating | 'unknown'
  currentWaveHeight?: number | null
  currentPeriod?: number | null
  currentWindSpeed?: number | null
  currentWindDir?: string | null
  wavePower?: number | null
  bottomType?: string | null
}

interface Props {
  spots: SpotWithRating[]
  centerLat?: number
  centerLng?: number
  zoom?: number
  userLocation?: { lat: number; lng: number } | null
  onLocate?: (lat: number, lng: number) => void
}

const RATING_COLORS: Record<ConditionRating | 'unknown', { bg: string; border: string; text: string }> = {
  poor:    { bg: '#fee2e2', border: '#ef4444', text: '#b91c1c' },
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


const BOTTOM_TYPE_META: Record<string, { label: string; bg: string; border: string; text: string }> = {
  sand:   { label: 'Sand Bottom',   bg: '#fef9c3', border: '#ca8a04', text: '#713f12' },
  reef:   { label: 'Reef Break',    bg: '#ffedd5', border: '#c2410c', text: '#7c2d12' },
  rock:   { label: 'Rock Bottom',   bg: '#e2e8f0', border: '#475569', text: '#1e293b' },
  coral:  { label: 'Coral Reef',    bg: '#fce7f3', border: '#be185d', text: '#831843' },
  mixed:  { label: 'Mixed Bottom',  bg: '#dbeafe', border: '#2563eb', text: '#1e3a8a' },
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


function bottomTypeMeta(bottomType?: string | null) {
  return BOTTOM_TYPE_META[bottomType ?? ''] ?? BOTTOM_TYPE_META['mixed']
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
      Wind: ${Math.round(spot.currentWindSpeed! * 0.621371)} mph ${spot.currentWindDir ?? ''}</div>` : ''}
  ` : h === 0 ? `<div style="font-size:11px;color:#8888aa;margin:6px 0;font-style:italic;">Flat — no rideable waves today</div>`
    : `<div style="font-size:11px;color:#8888aa;margin:6px 0;font-style:italic;">No live data — click for forecast</div>`

  return `<div style="font-family:'DM Sans',sans-serif;padding:12px 14px;min-width:180px;">
    <div style="font-size:10px;color:#8888aa;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:2px;">${spot.region}</div>
    <div style="font-size:14px;font-weight:700;color:#1a1a2e;line-height:1.2;">${spot.name}</div>
    <div style="font-size:10px;color:${DIFFICULTY_COLOR[spot.difficulty] ?? '#6b7280'};margin-top:2px;text-transform:capitalize;font-weight:600;">${spot.difficulty}</div>
    ${waveSection}
    <div style="display:inline-flex;align-items:center;background:${colors.bg};border:1.5px solid ${colors.border};
      color:${colors.text};border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;">${RATING_LABELS[rating]}</div>
    <div style="display:inline-flex;align-items:center;background:${bottomTypeMeta(spot.bottomType).bg};border:1px solid ${bottomTypeMeta(spot.bottomType).border};
      color:${bottomTypeMeta(spot.bottomType).text};border-radius:6px;padding:2px 8px;font-size:10px;font-weight:600;margin-left:4px;">${bottomTypeMeta(spot.bottomType).label}</div>
    <div style="font-size:10px;color:#8888aa;margin-top:6px;">Tap for full forecast →</div>
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

  const statsHtml = hasWave ? `
    <div style="display:flex;gap:0;background:#f8fafc;border-radius:10px;overflow:hidden;margin-bottom:10px;border:1px solid #e2e8f0;">
      <div style="flex:1;text-align:center;padding:10px 6px;">
        <div style="font-size:20px;font-weight:800;color:#1a1a2e;line-height:1;">${heightFt}<span style="font-size:11px;font-weight:600;color:#8888aa;">ft</span></div>
        <div style="font-size:9px;font-weight:600;color:#8888aa;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px;">Height</div>
      </div>
      ${period ? `<div style="flex:1;text-align:center;padding:10px 6px;border-left:1px solid #e2e8f0;">
        <div style="font-size:20px;font-weight:800;color:#1a1a2e;line-height:1;">${period}<span style="font-size:11px;font-weight:600;color:#8888aa;">s</span></div>
        <div style="font-size:9px;font-weight:600;color:#8888aa;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px;">Period</div>
      </div>` : ''}
      ${power ? `<div style="flex:1;text-align:center;padding:10px 6px;border-left:1px solid #e2e8f0;">
        <div style="font-size:20px;font-weight:800;color:#1a1a2e;line-height:1;">${power}</div>
        <div style="font-size:9px;font-weight:600;color:#8888aa;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px;">kW/m</div>
      </div>` : ''}
    </div>
    ${spot.currentWindSpeed != null ? `<div style="font-size:12px;color:#6b7280;margin-bottom:10px;">Wind: ${Math.round(spot.currentWindSpeed! * 0.621371)} mph ${spot.currentWindDir ?? ''}</div>` : ''}
  ` : h === 0
    ? `<div style="font-size:13px;color:#8888aa;font-style:italic;margin-bottom:10px;text-align:center;padding:10px;background:#f8fafc;border-radius:10px;">Flat — no rideable waves today</div>`
    : `<div style="font-size:13px;color:#8888aa;font-style:italic;margin-bottom:10px;text-align:center;padding:10px;background:#f8fafc;border-radius:10px;">No live data available</div>`

  return `<div style="width:250px;padding:14px 16px;font-family:'DM Sans',sans-serif;">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px;">
      <div style="min-width:0;">
        <div style="font-size:10px;color:#8888aa;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:1px;">${spot.region}</div>
        <div style="font-size:16px;font-weight:700;color:#1a1a2e;line-height:1.2;word-break:break-word;">${spot.name}</div>
        <div style="font-size:11px;color:${DIFFICULTY_COLOR[spot.difficulty] ?? '#6b7280'};font-weight:600;text-transform:capitalize;margin-top:2px;">${spot.difficulty}</div>
      </div>
      <div style="flex-shrink:0;background:${colors.bg};border:2px solid ${colors.border};color:${colors.text};
        border-radius:20px;padding:4px 10px;font-size:12px;font-weight:700;white-space:nowrap;">${RATING_LABELS[rating]}</div>
    </div>
    ${statsHtml}
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
      <span style="font-size:10px;font-weight:600;color:#8888aa;text-transform:uppercase;letter-spacing:0.05em;">Bottom</span>
      <span style="background:${bottomTypeMeta(spot.bottomType).bg};border:1px solid ${bottomTypeMeta(spot.bottomType).border};
        color:${bottomTypeMeta(spot.bottomType).text};border-radius:6px;padding:3px 10px;font-size:11px;font-weight:700;">
        ${bottomTypeMeta(spot.bottomType).label}
      </span>
    </div>
    <a href="/spots/${spot.slug}" style="display:block;background:#1b7fcb;color:white;text-align:center;
      padding:11px 0;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.01em;">
      View Full Forecast →
    </a>
  </div>`
}

export function SpotMap({ spots, centerLat = 36.5, centerLng = -120.5, zoom = 7, userLocation, onLocate }: Props) {
  const mapRef          = useRef<HTMLDivElement>(null)
  const mapInstance     = useRef<import('leaflet').Map | null>(null)
  const clusterRef      = useRef<unknown>(null)
  const parkingLayerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const seamarkLayerRef = useRef<import('leaflet').TileLayer | null>(null)
  const [seamarkOn, setSeamarkOn] = useState(false)
  const [locating, setLocating] = useState<'idle' | 'loading' | 'located' | 'error'>('idle')

  function handleLocate() {
    if (locating === 'loading') return
    if (!navigator.geolocation) {
      setLocating('error')
      setTimeout(() => setLocating('idle'), 3000)
      return
    }
    setLocating('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating('located')
        onLocate?.(pos.coords.latitude, pos.coords.longitude)
      },
      () => {
        setLocating('error')
        setTimeout(() => setLocating('idle'), 3000)
      },
      { timeout: 10000, maximumAge: 60000 }
    )
  }
  const userMarkerRef   = useRef<import('leaflet').Marker | null>(null)
  // Always holds the latest spots so async Leaflet init reads enriched data
  // even when conditions arrive between when the effect was scheduled and when
  // the async Leaflet imports finish.
  const spotsRef        = useRef<SpotWithRating[]>(spots)
  spotsRef.current      = spots
  // Keep latest userLocation available to the async init closure
  const userLocationRef = useRef(userLocation)
  userLocationRef.current = userLocation
  // Track seamarkOn across async boundaries so the init effect can restore it
  const seamarkOnRef = useRef(seamarkOn)
  seamarkOnRef.current = seamarkOn

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

    // Metres-per-degree constant for coordinate nudging
    const MTRS_PER_DEG = 111_320

    for (const spot of allSpots) {
      const rating = spot.currentRating ?? 'unknown'
      const colors = RATING_COLORS[rating]
      const h = spot.currentWaveHeight
      const label = h == null ? '—' : h === 0 ? 'Flat' : `${Math.round(h * 3.281)}ft`
      const fontSize = label.length > 4 ? '7px' : label.length > 3 ? '8px' : '9px'

      // Nudge the pin 80 m toward shore (opposite of facingDirection) so it sits
      // on the beach rather than at the offshore break.
      const shoreRad  = ((spot.facingDirection + 180) % 360) * (Math.PI / 180)
      const cosLat    = Math.cos(spot.lat * Math.PI / 180)
      const nudgeM    = 80
      const pinLat    = spot.lat + (nudgeM / MTRS_PER_DEG) * Math.cos(shoreRad)
      const pinLng    = spot.lng + (nudgeM / (MTRS_PER_DEG * cosLat)) * Math.sin(shoreRad)

      const icon = L.divIcon({
        className: '',
        html: `<div data-rating="${rating}" title="${spot.name}"
          style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
          <div style="background:${colors.bg};border:2.5px solid ${colors.border};border-radius:50%;
            width:38px;height:38px;display:flex;align-items:center;justify-content:center;
            font-family:'DM Sans',sans-serif;font-size:${fontSize};font-weight:800;color:${colors.text};
            box-shadow:0 2px 8px rgba(0,0,0,0.15);letter-spacing:-0.3px;line-height:1;">${label}</div>
          <div style="width:2px;height:6px;background:${colors.border};margin-top:1px;"></div>
        </div>`,
        iconSize: [38, 46],
        iconAnchor: [19, 46],
        popupAnchor: [0, -50],
      })

      // Place markers at shore-nudged position + ±360° world copies
      for (const lngOffset of [0, 360, -360]) {
        const marker = L.marker([pinLat, pinLng + lngOffset], { icon })
        marker.bindTooltip(tooltipHtml(spot), {
          permanent: false, sticky: false, direction: 'top',
          offset: [0, -48], opacity: 1, className: 'spot-hover-tooltip',
        })
        marker.bindPopup(popupHtml(spot), { maxWidth: 268, minWidth: 250 })
        group.addLayer(marker)
      }
    }

    group.addTo(map)
    clusterRef.current = group

    // Build parking layer and sync visibility
    const parkingLayer = buildParkingLayer(L, allSpots)
    parkingLayerRef.current = parkingLayer
    syncParkingVisibility(map, L, parkingLayer)
  }

  // Place / update the blue "you are here" dot — called both from the init effect
  // (to restore after re-init) and from the userLocation effect (live updates).
  async function applyUserLocation(
    map: import('leaflet').Map,
    L: typeof import('leaflet'),
    pos: { lat: number; lng: number } | null | undefined
  ) {
    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current)
      userMarkerRef.current = null
    }
    if (!pos) return

    const icon = L.divIcon({
      className: '',
      html: `<div style="position:relative;width:22px;height:22px;">
        <div class="user-location-pulse" style="position:absolute;inset:0;border-radius:50%;background:rgba(37,99,235,0.35);pointer-events:none;"></div>
        <div style="position:absolute;inset:0;border-radius:50%;background:#2563eb;border:2.5px solid white;box-shadow:0 2px 10px rgba(37,99,235,0.55);"></div>
      </div>`,
      iconSize:   [22, 22],
      iconAnchor: [11, 11],
    })

    const marker = L.marker([pos.lat, pos.lng], { icon, zIndexOffset: 2000, interactive: false })
    marker.addTo(map)
    userMarkerRef.current = marker
  }

  // Initial map setup
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return
    let cancelled = false

    ;(async () => {
      const L = (await import('leaflet')).default
      await import('leaflet.markercluster')
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
        minZoom: 2,
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

      // Restore user location dot if it was set before re-init
      await applyUserLocation(map, L, userLocationRef.current)

      // Restore ocean features overlay if it was on before re-init
      if (seamarkOnRef.current) {
        seamarkLayerRef.current = L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}',
          { attribution: '&copy; <a href="https://www.esri.com">Esri</a>, Garmin, GEBCO, NOAA NGDC', opacity: 0.8, maxZoom: 18 }
        )
        seamarkLayerRef.current.addTo(map)
      }

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
        seamarkLayerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerLat, centerLng, zoom])

  // Add / remove OpenSeaMap seamark overlay when toggle changes
  useEffect(() => {
    if (!mapInstance.current) return
    ;(async () => {
      const L = (await import('leaflet')).default
      if (!mapInstance.current) return
      if (seamarkOn) {
        if (!seamarkLayerRef.current) {
          seamarkLayerRef.current = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}',
            {
              attribution: '&copy; <a href="https://www.esri.com">Esri</a>, Garmin, GEBCO, NOAA NGDC',
              opacity: 0.8,
              maxZoom: 18,
            }
          )
        }
        if (!mapInstance.current.hasLayer(seamarkLayerRef.current)) {
          seamarkLayerRef.current.addTo(mapInstance.current)
        }
      } else {
        if (seamarkLayerRef.current && mapInstance.current.hasLayer(seamarkLayerRef.current)) {
          mapInstance.current.removeLayer(seamarkLayerRef.current)
        }
      }
    })().catch(console.error)
  }, [seamarkOn])

  // Update cluster when condition data arrives
  useEffect(() => {
    if (!mapInstance.current) return
    ;(async () => {
      const L = (await import('leaflet')).default
      await import('leaflet.markercluster')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const MCG2 = (L as any).MarkerClusterGroup
      if (!mapInstance.current) return
      await rebuildCluster(mapInstance.current, L, MCG2, spotsRef.current)
    })().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots.map(s => `${s.id}:${s.currentRating ?? '?'}:${s.currentWaveHeight ?? 'x'}`).join('|')])

  // Update blue dot and pan map when user location changes
  useEffect(() => {
    if (!mapInstance.current) return
    const map = mapInstance.current
    ;(async () => {
      const L = (await import('leaflet')).default
      if (!mapInstance.current) return
      await applyUserLocation(map, L, userLocation)
      if (userLocation) {
        map.setView(
          [userLocation.lat, userLocation.lng],
          Math.max(map.getZoom(), 12),
          { animate: true }
        )
      }
    })().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation])

  return (
    <div className="relative h-full w-full" style={{ minHeight: '100%' }}>
      <div ref={mapRef} className="h-full w-full" style={{ minHeight: '100%' }} />

      {/* GPS locate button — always visible when map is rendered */}
      <button
        onClick={handleLocate}
        title={locating === 'located' ? 'Re-center on my location' : 'Show my location'}
        className="absolute z-[1000] w-10 h-10 rounded-xl flex items-center justify-center transition-all"
        style={{
          bottom: '120px',
          right: '10px',
          background:   locating === 'located' ? 'var(--ocean-600)' : locating === 'error' ? '#fef2f2' : 'white',
          border:       `2px solid ${locating === 'located' ? 'var(--ocean-600)' : locating === 'error' ? '#fca5a5' : '#bfdbfe'}`,
          color:        locating === 'located' ? 'white' : locating === 'error' ? '#ef4444' : '#2563eb',
          boxShadow:    '0 2px 12px rgba(0,0,0,0.12)',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {locating === 'loading' ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--sand-200)] border-t-[var(--ocean-600)]" />
        ) : locating === 'error' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          </svg>
        ) : (
          <svg width="17" height="17" viewBox="0 0 24 24" fill={locating === 'located' ? 'white' : 'none'} stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="8"/>
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
            <circle cx="12" cy="12" r="2" fill="currentColor"/>
          </svg>
        )}
      </button>

      {/* OpenSeaMap toggle — bottom-right, above Leaflet zoom controls */}
      <button
        onClick={() => setSeamarkOn((v) => !v)}
        title={seamarkOn ? 'Hide ocean features overlay' : 'Show reefs, rocks & shoals (ESRI Ocean)'}
        className="absolute z-[1000] flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all"
        style={{
          bottom: '80px',
          right: '10px',
          background: seamarkOn ? 'var(--ocean-600)' : 'rgba(255,255,255,0.95)',
          color: seamarkOn ? 'white' : 'var(--text-2)',
          border: `1px solid ${seamarkOn ? 'var(--ocean-600)' : 'var(--border)'}`,
          boxShadow: '0 1px 5px rgba(0,0,0,0.2)',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 17l4-8 4 4 4-6 4 10" />
          <path d="M3 20h18" strokeDasharray="2 2" />
        </svg>
        Ocean
      </button>
    </div>
  )
}
