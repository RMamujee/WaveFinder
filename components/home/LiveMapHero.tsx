'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import { WaveLoader } from '@/components/layout/WaveLoader'
import { HeroBackdrop } from '@/components/home/HeroBackdrop'
import { Icon } from '@/components/ui/Icon'
import type { MapBounds } from '@/components/spots/SpotMap'
import type { SurfSpot } from '@/types/spot'
import type { ConditionRating } from '@/types/forecast'

interface SpotWithRating extends SurfSpot {
  currentRating?: ConditionRating | 'unknown'
  currentWaveHeight?: number | null
  currentFaceHeight?: number | null
  currentPeriod?: number | null
  currentWindSpeed?: number | null
  wavePower?: number | null
}

const SpotMap = dynamic(
  () => import('@/components/spots/SpotMap').then((m) => m.SpotMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full relative overflow-hidden" style={{ background: 'var(--ocean-50)' }}>
        <HeroBackdrop style={{ position: 'absolute', inset: 0 }} />
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 1 }}>
          <WaveLoader compact label="Loading live map…" />
        </div>
      </div>
    ),
  }
)

interface Props {
  spotCount: number
}

// Viewport → query key. Rounded outward to whole degrees and padded by one, so
// nudging the map re-uses the cached payload instead of commissioning a new
// Open-Meteo sweep, and pins just off-screen are already coloured when they pan
// in. Quantising is what makes "conditions follow the viewport" affordable.
const BBOX_PAD_DEG = 1

function bboxParam(b: MapBounds): string {
  const lo = (n: number) => Math.floor(n) - BBOX_PAD_DEG
  const hi = (n: number) => Math.ceil(n) + BBOX_PAD_DEG
  // Wrap longitudes into [-180, 180]: Leaflet reports bounds past the edge of
  // the world after a dateline pan, and -182 vs 178 are the same geography but
  // two distinct CDN cache keys — each one a fresh origin fan-out. The server
  // matches a wrapped box (minLng > maxLng) as a union of two spans.
  const wrapLng = (n: number) => ((((n + 180) % 360) + 360) % 360) - 180
  const minLng = lo(b.minLng)
  const maxLng = hi(b.maxLng)
  const wide = maxLng - minLng >= 360
  return [
    Math.max(lo(b.minLat), -90),
    wide ? -180 : wrapLng(minLng),
    Math.min(hi(b.maxLat), 90),
    wide ? 180 : wrapLng(maxLng),
  ].join(',')
}

export function LiveMapHero({ spotCount }: Props) {
  // Slim payload: marker-essential fields only (~70% smaller than full)
  // so the map can render pins as soon as possible on mobile.
  const { data: baseSpots = [], isLoading: spotsLoading } = useQuery<SpotWithRating[]>({
    queryKey: ['spots-home-base'],
    queryFn: () => fetch('/api/spots?slim=true').then((r) => r.json()),
    staleTime: 30 * 60 * 1000,
  })

  const [bbox, setBbox] = useState<string | null>(null)
  const handleBoundsChange = useCallback((b: MapBounds) => {
    setBbox((prev) => {
      const next = bboxParam(b)
      return prev === next ? prev : next
    })
  }, [])

  // Deliberately NOT gated on baseSpots: the conditions payload is a complete
  // marker projection, so it does not need the base list to render. Chaining it
  // behind one made time-to-coloured-map the SUM of both requests — measured
  // against production at 2.8 s + 4.3 s cold, i.e. ~7 s of grey "No data" pins
  // — where running them together costs only the slower of the two.
  //
  // Scoped to the viewport (`bbox`). Asking for all ~1,500 spots on Earth cost
  // ~2,388 Open-Meteo calls per sweep against a 5,000/hour allowance, so the
  // fan-out was refused outright and the map rendered entirely grey while spot
  // pages — one location each — kept working. See the header on parseBbox in
  // app/api/spots/route.ts.
  const { data: enrichedSpots, isLoading: conditionsLoading, dataUpdatedAt } = useQuery<SpotWithRating[]>({
    queryKey: ['spots-home-conditions', bbox],
    queryFn: () => fetch(`/api/spots?withConditions=true&bbox=${bbox}`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    }),
    enabled: bbox !== null,
    staleTime: 5 * 60 * 1000,
    // Hold the previous viewport's ratings on screen while the new one loads —
    // a pan must not repaint the map grey.
    placeholderData: keepPreviousData,
    // Keep an open tab live: nothing else in the app refetches (focus-refetch
    // is globally off), so without this a 6am map showed 6am ratings at noon
    // under the "Live conditions" badge. 5 min matches the om:cond cache TTL.
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  })

  // MERGED onto the base list, not substituted for it. The conditions payload
  // now covers only the viewport, so replacing the list wholesale would delete
  // every off-screen pin. Spots outside the box keep their marker and simply
  // carry no rating until they are panned into view — invisible in practice,
  // since the box is padded past the edge of the screen, and harmless in
  // clusters, where an `unknown` child never wins the cluster's colour.
  const spots = useMemo(() => {
    // `undefined` = not loaded yet; a successful `[]` (viewport with no spots)
    // is a real answer — treating it as "missing" made keepPreviousData repaint
    // every pin grey after a pan over open ocean.
    if (!Array.isArray(enrichedSpots)) return baseSpots
    const condMap = new Map(enrichedSpots.map((s) => [s.id, s]))
    return baseSpots.map((s) => {
      const cond = condMap.get(s.id)
      return cond ? { ...s, ...cond } : s
    })
  }, [baseSpots, enrichedSpots])
  const conditionsPending = spotsLoading || conditionsLoading || bbox === null

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
            fontFamily: 'var(--font-playfair), serif',
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
        {/* Live conditions chip — doubles as the loading indicator while the
            slim pins and then the live-conditions payload stream in.
            z-[1000], not z-10: Leaflet's own map pane is z-index 400, so this
            was painting UNDERNEATH the map. Every status this surface reports —
            "Loading live conditions…", the updated-at time — was invisible, which
            is why a stalled map looked like a map that simply never loaded.
            The controls inside SpotMap already use z-[1000] for this reason. */}
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 rounded-full px-4 py-1.5 pointer-events-none"
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
          }}
        >
          {conditionsPending ? (
            <>
              <svg
                className="animate-spin"
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="var(--ocean-600)" strokeWidth="3" strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
                <path d="M21 12a9 9 0 0 0-9-9" />
              </svg>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>
                {spotsLoading ? 'Loading spots…' : 'Loading live conditions…'}
              </span>
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>
                Live conditions
                {dataUpdatedAt > 0 && (
                  <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>
                    {' '}· updated {new Date(dataUpdatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                )}
              </span>
            </>
          )}
          <Link
            href="/spots"
            className="text-xs font-semibold pointer-events-auto"
            style={{ color: 'var(--ocean-600)' }}
          >
            Open full map →
          </Link>
        </div>

        {/* Mobile: single primary CTA — sources/credit moved to /spots footer.
            Same z-index correction as the chip above. */}
        <div
          className="absolute bottom-0 left-0 right-0 z-[1000] lg:hidden flex justify-center px-5 pb-6 pt-10"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.28) 0%, transparent 100%)' }}
        >
          <Link
            href="/spots"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'var(--ocean-600)', boxShadow: '0 4px 24px rgba(27,127,203,0.45)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            Browse {spotCount}+ spots
          </Link>
        </div>

        <SpotMap
          spots={spots}
          centerLat={35.5}
          centerLng={-120.5}
          zoom={6}
          onBoundsChange={handleBoundsChange}
        />

        {/* Keep the loader up until the first pins exist — otherwise the map
            chunk can finish before the spots fetch and show an empty ocean */}
        {spotsLoading && (
          <div
            className="absolute inset-0 z-[5] flex items-center justify-center"
            style={{ background: 'var(--sand-50)' }}
          >
            <WaveLoader compact label="Loading live map…" />
          </div>
        )}
      </div>
    </section>
  )
}
