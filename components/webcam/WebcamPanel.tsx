'use client'

import { useState, useEffect } from 'react'

interface Props {
  webcamUrl?: string | null
  webcamType?: string | null
  spotName: string
  lat: number
  lng: number
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)
  return match?.[1] ?? null
}

function RefreshingImage({ src }: { src: string }) {
  const [key, setKey] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setKey((k) => k + 1), 30000)
    return () => clearInterval(timer)
  }, [])
  // eslint-disable-next-line @next/next/no-img-element
  return <img key={key} src={src} alt="Live cam" className="h-full w-full object-cover" />
}

export function WebcamPanel({ webcamUrl, webcamType, spotName, lat, lng }: Props) {
  const hasCamera = webcamType !== 'none' && webcamUrl

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'white' }}>
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', background: 'var(--sand-50)' }}>
        <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>
          {hasCamera ? 'Live Cam' : 'Map View'}
        </span>
        {hasCamera && (
          <span className="flex items-center gap-1 text-xs" style={{ color: '#16a34a' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        )}
      </div>

      <div className="aspect-video">
        {webcamType === 'youtube' && webcamUrl ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${getYouTubeId(webcamUrl)}?autoplay=1&mute=1&controls=0`}
            title={`${spotName} live cam`}
            className="h-full w-full border-0"
            allow="autoplay; encrypted-media"
          />
        ) : webcamType === 'image' && webcamUrl ? (
          <RefreshingImage src={webcamUrl} />
        ) : (
          <iframe
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}`}
            title={`Map of ${spotName}`}
            className="h-full w-full border-0"
            loading="lazy"
          />
        )}
      </div>
    </div>
  )
}
