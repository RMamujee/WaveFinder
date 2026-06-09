'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

interface Props {
  lat: number
  lng: number
  spotName: string
  facingDirection?: number
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
      if (cancelled || !mapRef.current) return

      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }

      const metersPerDeg = 111_320
      const shoreRad = ((facingDirection + 180) % 360) * (Math.PI / 180)
      const cosLat   = Math.cos(lat * Math.PI / 180)

      const centerNudgeM = 150
      const centerLat = lat + (centerNudgeM / metersPerDeg) * Math.cos(shoreRad)
      const centerLng = lng + (centerNudgeM / (metersPerDeg * cosLat)) * Math.sin(shoreRad)

      const markerNudgeM = 30
      const shLat = lat + (markerNudgeM / metersPerDeg) * Math.cos(shoreRad)
      const shLng = lng + (markerNudgeM / (metersPerDeg * cosLat)) * Math.sin(shoreRad)

      const map = L.map(mapRef.current, {
        center: [centerLat, centerLng],
        zoom: zoom + 1,
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
      })
      mapInstance.current = map

      setTimeout(() => map.invalidateSize(), 150)

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

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, maxNativeZoom: 18, opacity: 0.75, crossOrigin: true }
      ).addTo(map)

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
        .bindPopup(`<strong style="font-family:var(--font-dm-sans),sans-serif">${spotName}</strong>`)
    })().catch(console.error)

    return () => {
      cancelled = true
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [lat, lng, spotName, facingDirection, zoom])

  return <div ref={mapRef} style={{ height: '100%', width: '100%', minHeight: '280px' }} />
}
