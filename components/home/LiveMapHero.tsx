'use client'

import { useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { WaveLoader } from '@/components/layout/WaveLoader'
import { Icon } from '@/components/ui/Icon'
import type { SurfSpot } from '@/types/spot'
import type { ConditionRating } from '@/types/forecast'

interface SpotWithRating extends SurfSpot {
  currentRating?: ConditionRating | 'unknown'
  currentWaveHeight?: number | null
  currentPeriod?: number | null
  currentWindSpeed?: number | null
  wavePower?: number | null
}

const SpotMap = dynamic(
  () => import('@/components/spots/SpotMap').then((m) => m.SpotMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center" style={{ background: 'var(--sand-50)' }}>
        <WaveLoader compact label="Loading live map…" />
      </div>
    ),
  }
)

interface Props {
  spotCount: number
}

export function LiveMapHero({ spotCount }: Props) {
  const { data: baseSpots = [] } = useQuery<SpotWithRating[]>({
    queryKey: ['spots-home-base'],
    queryFn: () => fetch('/api/spots').then((r) => r.json()),
    staleTime: 30 * 60 * 1000,
  })

  const { data: enrichedSpots } = useQuery<SpotWithRating[]>({
    queryKey: ['spots-home-conditions'],
    queryFn: () => fetch('/api/spots?withConditions=true').then((r) => r.json()),
    staleTime: 30 * 60 * 1000,
    enabled: baseSpots.length > 0,
  })

  const spots = enrichedSpots ?? baseSpots

  return (
    <section
      className="flex flex-col lg:flex-row h-[90svh] lg:h-[calc(100svh-var(--navbar-height,57px))] min-h-[500px]"
    >
      {/* ── Left: text panel (desktop only) ──────────────────────────── */}
      <div
        className="hidden lg:flex shrink-0 flex-col justify-center px-10 w-[400px] border-r"
        style={{ background: 'white', borderColor: 'var(--border)', zIndex: 2 }}
      >
        <div
          className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-5 w-fit"
          style={{ background: 'rgba(27,127,203,0.08)', border: '1px solid rgba(27,127,203,0.18)' }}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" style={{ flexShrink: 0 }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--ocean-700)' }}>
            {spotCount}+ live spots
          </span>
        </div>

        <h1
          style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: 'clamp(32px, 4vw, 54px)',
            fontWeight: 700,
            lineHeight: 1.08,
            color: 'var(--text)',
            letterSpacing: '-0.02em',
            marginBottom: '28px',
          }}
        >
          Find your
          <br />
          <span style={{ color: 'var(--ocean-600)', fontStyle: 'italic' }}>perfect wave.</span>
        </h1>

        <Link
          href="/spots"
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 hover:-translate-y-0.5 w-fit"
          style={{ background: 'var(--ocean-600)', boxShadow: '0 4px 16px rgba(27,127,203,0.35)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          Browse spots
        </Link>

        {/* Trusted sources + credit */}
        <div className="mt-8 pt-7 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-3)' }}>
            Trusted Data Sources
          </p>
          <div className="flex flex-col gap-1.5 mb-5">
            {[
              { name: 'NOAA NDBC Buoys',      iconName: 'buoy' as const },
              { name: 'Open-Meteo Marine API', iconName: 'wave' as const },
              { name: 'NOAA CO-OPS Tides',    iconName: 'tide' as const },
              { name: 'OpenStreetMap',         iconName: 'map'  as const },
            ].map((s) => (
              <span key={s.name} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-3)' }}>
                <Icon name={s.iconName} size={14} style={{ color: 'var(--text-3)' }} />
                <span>{s.name}</span>
              </span>
            ))}
          </div>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            Made by{' '}
            <a
              href="https://www.linkedin.com/in/rmamujee"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold hover:underline"
              style={{ color: 'var(--ocean-600)' }}
            >
              Rahil Mamujee
            </a>
          </p>
        </div>
      </div>

      {/* ── Map ───────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        {/* Live conditions chip */}
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full px-4 py-1.5 pointer-events-none"
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>Live conditions</span>
          <Link
            href="/spots"
            className="text-xs font-semibold pointer-events-auto"
            style={{ color: 'var(--ocean-600)' }}
          >
            Open full map →
          </Link>
        </div>

        {/* Mobile: bottom overlay — Browse Spots + credits */}
        <div
          className="absolute bottom-0 left-0 right-0 z-10 lg:hidden flex flex-col items-center gap-3 px-5 pb-6 pt-12"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.32) 0%, transparent 100%)' }}
        >
          <Link
            href="/spots"
            className="inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'var(--ocean-600)', boxShadow: '0 4px 24px rgba(27,127,203,0.5)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            Browse Spots
          </Link>

          <div className="flex flex-wrap justify-center gap-x-4 gap-y-0.5" style={{ maxWidth: 'calc(100vw - 32px)', wordBreak: 'break-word' }}>
            {['NOAA NDBC', 'Open-Meteo', 'NOAA Tides', 'OpenStreetMap'].map((s) => (
              <span key={s} className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>{s}</span>
            ))}
          </div>

          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Made by{' '}
            <a
              href="https://www.linkedin.com/in/rmamujee"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold"
              style={{ color: 'rgba(255,255,255,0.9)' }}
            >
              Rahil Mamujee
            </a>
          </p>
        </div>

        <SpotMap
          spots={spots}
          centerLat={35.5}
          centerLng={-120.5}
          zoom={6}
        />
      </div>
    </section>
  )
}
