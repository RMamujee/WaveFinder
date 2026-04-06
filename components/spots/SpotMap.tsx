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

export function SpotMap({ spots, centerLat = 33.7, centerLng = -117.8, zoom = 9 }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return

    let map: unknown
    let L: typeof import('leaflet')

    const init = async () => {
      L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      if (mapInstanceRef.current) {
        (mapInstanceRef.current as L.Map).remove()
      }

      map = L.map(mapRef.current!, {
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
      }).addTo(map as L.Map)

      for (const spot of spots) {
        const rating = spot.currentRating ?? 'unknown'
        const colors = RATING_COLORS[rating]

        // Show wave height in feet on the pin; fall back to "—" when no live data
        const hasWave = spot.currentWaveHeight != null && spot.currentWaveHeight > 0
        const heightFtLabel = hasWave
          ? `${Math.round(spot.currentWaveHeight! * 3.281)}ft`
          : '—'
        // Smaller font for longer strings (e.g. "12ft" vs "3ft")
        const labelFontSize = heightFtLabel.length > 3 ? '8px' : '9px'

        const icon = L.divIcon({
          className: '',
          html: `
            <div class="spot-marker" title="${spot.name}" style="
              display:flex;
              flex-direction:column;
              align-items:center;
              cursor:pointer;
            ">
              <div style="
                background:${colors.bg};
                border:2.5px solid ${colors.border};
                border-radius:50%;
                width:36px;
                height:36px;
                display:flex;
                align-items:center;
                justify-content:center;
                font-family:'DM Sans',sans-serif;
                font-size:${labelFontSize};
                font-weight:800;
                color:${colors.text};
                box-shadow:0 2px 8px rgba(0,0,0,0.15);
                transition:transform 0.15s ease;
                letter-spacing:-0.3px;
                line-height:1;
              ">${heightFtLabel}</div>
              <div style="
                width:2px;
                height:6px;
                background:${colors.border};
                margin-top:1px;
              "></div>
            </div>
          `,
          iconSize: [36, 44],
          iconAnchor: [18, 44],
          popupAnchor: [0, -48],
        })

        // ── Hover tooltip ──────────────────────────────────────────────────────
        const heightFt = hasWave ? Math.round(spot.currentWaveHeight! * 3.281) : null
        const heightM  = hasWave ? spot.currentWaveHeight!.toFixed(1) : null
        const period   = spot.currentPeriod != null ? Math.round(spot.currentPeriod!) : null
        const power    = spot.wavePower != null ? Math.round(spot.wavePower!) : null

        const waveSection = hasWave ? `
          <div style="display:flex;gap:12px;margin:8px 0 6px;">
            <div>
              <div style="font-size:10px;color:#8888aa;margin-bottom:1px;">Wave Height</div>
              <div style="font-size:16px;font-weight:700;color:#1a1a2e;font-family:'Playfair Display',serif;">
                ${heightFt}ft
              </div>
              <div style="font-size:10px;color:#8888aa;">${heightM}m</div>
            </div>
            ${period ? `
            <div>
              <div style="font-size:10px;color:#8888aa;margin-bottom:1px;">Period</div>
              <div style="font-size:16px;font-weight:700;color:#1a1a2e;font-family:'Playfair Display',serif;">${period}s</div>
            </div>` : ''}
            ${power ? `
            <div>
              <div style="font-size:10px;color:#8888aa;margin-bottom:1px;">Power</div>
              <div style="font-size:16px;font-weight:700;color:#1a1a2e;font-family:'Playfair Display',serif;">${power}</div>
              <div style="font-size:10px;color:#8888aa;">kW/m</div>
            </div>` : ''}
          </div>
          ${spot.currentWindSpeed != null ? `
          <div style="font-size:11px;color:#6b7280;margin-bottom:6px;">
            💨 ${Math.round(spot.currentWindSpeed!)} km/h ${spot.currentWindDir ?? ''}
          </div>` : ''}
        ` : `
          <div style="font-size:11px;color:#8888aa;margin:6px 0;font-style:italic;">
            No live conditions — click for forecast
          </div>
        `

        const tooltipHtml = `
          <div style="
            font-family:'DM Sans',sans-serif;
            padding:12px 14px;
            min-width:180px;
          ">
            <div style="font-size:10px;color:#8888aa;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:2px;">
              ${spot.region}
            </div>
            <div style="font-size:14px;font-weight:700;color:#1a1a2e;line-height:1.2;">
              ${spot.name}
            </div>
            <div style="font-size:10px;color:${DIFFICULTY_COLOR[spot.difficulty] ?? '#6b7280'};margin-top:2px;text-transform:capitalize;font-weight:600;">
              ${spot.difficulty}
            </div>
            ${waveSection}
            <div style="
              display:inline-flex;
              align-items:center;
              background:${colors.bg};
              border:1.5px solid ${colors.border};
              color:${colors.text};
              border-radius:20px;
              padding:3px 10px;
              font-size:11px;
              font-weight:700;
            ">${RATING_LABELS[rating]}</div>
            <div style="font-size:10px;color:#8888aa;margin-top:6px;">Click for full forecast →</div>
          </div>
        `

        const marker = L.marker([spot.lat, spot.lng], { icon })

        // Bind hover tooltip
        marker.bindTooltip(tooltipHtml, {
          permanent: false,
          sticky: false,
          direction: 'top',
          offset: [0, -48],
          opacity: 1,
          className: 'spot-hover-tooltip',
        })

        // Bind click popup (more detailed, with link)
        const heightStr = hasWave
          ? `${heightM}m (${heightFt}ft)`
          : '—'

        const popupHtml = `
          <div style="
            width:210px;
            padding:14px;
            font-family:'DM Sans',sans-serif;
          ">
            <div style="font-size:11px;color:#8888aa;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.05em;">
              ${spot.region}
            </div>
            <div style="font-size:15px;font-weight:600;color:#1a1a2e;margin-bottom:8px;">
              ${spot.name}
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
              <div>
                <div style="font-size:13px;font-weight:600;color:#1a1a2e;">${heightStr}</div>
                ${period ? `<div style="font-size:11px;color:#8888aa;">${period}s period${power ? ` · ${power} kW/m` : ''}</div>` : ''}
              </div>
              <div style="
                background:${colors.bg};
                border:1.5px solid ${colors.border};
                color:${colors.text};
                border-radius:20px;
                padding:3px 10px;
                font-size:12px;
                font-weight:700;
              ">${RATING_LABELS[rating]}</div>
            </div>
            <a href="/spots/${spot.slug}" style="
              display:block;
              background:#1b7fcb;
              color:white;
              text-align:center;
              padding:7px 0;
              border-radius:8px;
              font-size:13px;
              font-weight:600;
              text-decoration:none;
            ">View Forecast →</a>
          </div>
        `

        marker.bindPopup(popupHtml, { maxWidth: 230, minWidth: 210 })
        marker.addTo(map as L.Map)
      }
    }

    init().catch(console.error)

    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as L.Map).remove()
        mapInstanceRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots.length, centerLat, centerLng, zoom])

  return (
    <div
      ref={mapRef}
      className="h-full w-full"
      style={{ minHeight: '100%' }}
    />
  )
}
