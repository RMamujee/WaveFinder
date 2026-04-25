'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { WindyWebcam } from '@/lib/api/windy-webcams'

interface Props {
  slug: string
}

export function WindyWebcamsPanel({ slug }: Props) {
  const [active, setActive] = useState<WindyWebcam | null>(null)

  const { data: webcams = [], isLoading } = useQuery<WindyWebcam[]>({
    queryKey: ['webcams', slug],
    queryFn: () => fetch(`/api/webcams/${slug}`).then((r) => r.json()),
    staleTime: 60 * 60 * 1000,
  })

  if (isLoading || webcams.length === 0) return null

  return (
    <>
      <h2
        className="mb-2 font-semibold text-sm"
        style={{ color: 'var(--text-2)', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.03em', textTransform: 'uppercase' }}
      >
        Nearby Live Cams
      </h2>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
      >
        {webcams.map((cam) => (
          <button
            key={cam.webcamId}
            onClick={() => setActive(cam)}
            className="group relative rounded-xl overflow-hidden text-left transition-all"
            style={{ border: '1px solid var(--border)', background: 'var(--sand-100)', aspectRatio: '16/9' }}
          >
            {cam.thumbnail ? (
              <img
                src={cam.thumbnail}
                alt={cam.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--text-3)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="m15 10 4.553-2.069A1 1 0 0 1 21 8.87v6.26a1 1 0 0 1-1.447.894L15 14M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                </svg>
              </div>
            )}

            {/* Overlay on hover */}
            <div
              className="absolute inset-0 flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }}
            >
              <p className="text-white text-xs font-semibold truncate leading-tight">{cam.title}</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {cam.source === 'youtube'
                  ? '▶ YouTube Live'
                  : `${cam.city ? `${cam.city} · ` : ''}${cam.distanceKm} km away`}
              </p>
            </div>

            {/* Play icon */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div
                className="rounded-full flex items-center justify-center"
                style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.9)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#1b7fcb">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Player modal */}
      {active && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setActive(null)}
        >
          <div
            className="relative w-full max-w-3xl rounded-2xl overflow-hidden"
            style={{ background: '#000', aspectRatio: '16/9' }}
            onClick={(e) => e.stopPropagation()}
          >
            {active.playerEmbedUrl ? (
              <iframe
                src={active.playerEmbedUrl}
                title={active.title}
                className="w-full h-full border-0"
                allowFullScreen
              />
            ) : (
              <img src={active.previewUrl || active.thumbnail} alt={active.title} className="w-full h-full object-cover" />
            )}

            <button
              onClick={() => setActive(null)}
              className="absolute top-3 right-3 rounded-full flex items-center justify-center"
              style={{ width: 32, height: 32, background: 'rgba(0,0,0,0.6)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="absolute bottom-0 left-0 right-0 px-4 py-3" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
              <p className="text-white text-sm font-semibold">{active.title}</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {active.source === 'youtube'
                ? 'YouTube Live Stream'
                : `${active.city ? `${active.city} · ` : ''}${active.distanceKm} km from spot · ${active.source === 'osm' ? 'OpenStreetMap' : 'Windy'}`}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
