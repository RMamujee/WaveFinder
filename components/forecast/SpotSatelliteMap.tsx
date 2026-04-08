'use client'

import { useEffect, useRef } from 'react'

interface Props {
  lat: number
  lng: number
  spotName: string
  facingDirection?: number  // degrees — used to nudge marker to the shoreline
  zoom?: number
}

export function SpotSatelliteMap({ lat, lng, spotName, facingDirection = 180, zoom = 15 }: Props) {
  const mapRef      = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<import('leaflet').Map | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return
    let cancelled = false

    ;(async () => {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      if (cancelled || !mapRef.current) return

      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }

      const map = L.map(mapRef.current, {
        center: [lat, lng],
        zoom,
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
      })
      mapInstance.current = map

      // Force correct sizing after container renders
      setTimeout(() => map.invalidateSize(), 100)

      // ── Esri World Imagery (satellite) — free, no API key ──────────────────
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '© Esri, Maxar, Earthstar Geographics',
          maxZoom: 19,
          maxNativeZoom: 18,
          tileSize: 256,
          crossOrigin: true,
        }
      ).addTo(map)

      // ── Subtle labels overlay (roads/place names over satellite) ───────────
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, maxNativeZoom: 18, opacity: 0.75, crossOrigin: true }
      ).addTo(map)

      // ── Nudge marker ~40 m toward shore (opposite of facingDirection) ──────
      // facingDirection = direction the beach faces (toward ocean).
      // Shoreline is in the opposite direction from the break.
      const shoreRad = ((facingDirection + 180) % 360) * (Math.PI / 180)
      const metersPerDeg = 111_320
      const nudgeM = 40
      const shLat = lat + (nudgeM / metersPerDeg) * Math.cos(shoreRad)
      const shLng = lng + (nudgeM / (metersPerDeg * Math.cos(lat * Math.PI / 180))) * Math.sin(shoreRad)

      // ── Custom surf-pin marker ─────────────────────────────────────────────
      const icon = L.divIcon({
        className: '',
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div style="
              background:#1b7fcb;
              border:3px solid white;
              border-radius:50% 50% 50% 0;
              width:22px;height:22px;
              transform:rotate(-45deg);
              box-shadow:0 2px 10px rgba(0,0,0,0.5);
            "></div>
          </div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 22],
        popupAnchor: [0, -26],
      })

      L.marker([shLat, shLng], { icon })
        .addTo(map)
        .bindPopup(`<strong style="font-family:DM Sans,sans-serif">${spotName}</strong>`)
    })().catch(console.error)

    return () => {
      cancelled = true
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [lat, lng, spotName, facingDirection, zoom])

  return <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
}
