import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { LiveMapHero } from '@/components/home/LiveMapHero'

export default async function HomePage() {
  const spotCount = await prisma.surfSpot.count().catch(() => 0)

  return (
    <div style={{ background: 'var(--sand-50)' }}>

      {/* ── Hero: live map takes center stage ──────────────────────── */}
      <LiveMapHero spotCount={spotCount} />

      {/* ── Live Conditions Strip ─────────────────────────────────────── */}
      <section style={{ background: 'var(--ocean-800)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="mx-auto max-w-6xl px-5 py-5">
          <div className="flex flex-wrap items-center gap-8">
            <div className="flex items-center gap-2 shrink-0">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Live Data
              </span>
            </div>
            {[
              { icon: '🌊', label: 'Wave height + swell period from offshore buoys' },
              { icon: '💨', label: 'Offshore vs onshore wind detection' },
              { icon: '⚡', label: 'Wave power index (kW/m)' },
              { icon: '🌊', label: 'Tides from NOAA CO-OPS stations' },
              { icon: '⏰', label: 'Best session time windows' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span style={{ fontSize: '14px' }}>{item.icon}</span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section
        className="py-24 px-5 text-center relative overflow-hidden"
        style={{ background: 'linear-gradient(140deg, var(--ocean-900) 0%, var(--ocean-700) 50%, #0e6b8f 100%)' }}
      >
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full" style={{ background: 'radial-gradient(circle, rgba(77,191,202,0.15) 0%, transparent 70%)' }} />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full" style={{ background: 'radial-gradient(circle, rgba(27,127,203,0.2) 0%, transparent 70%)' }} />
        {/* Wave svg */}
        <div className="pointer-events-none absolute inset-0">
          <svg viewBox="0 0 1440 100" className="absolute bottom-0" fill="none">
            <path d="M0,50 C360,90 720,10 1080,50 C1260,70 1380,40 1440,50 L1440,100 L0,100 Z" fill="rgba(255,255,255,0.04)" />
          </svg>
        </div>
        <div className="relative mx-auto max-w-xl">
          <div className="text-5xl mb-6">🏄</div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 700, color: 'white', lineHeight: 1.2 }}>
            Never miss the perfect session again.
          </h2>
          <p className="mt-4 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Save your home breaks, track live conditions, and get session recommendations —
            powered by government ocean data, forever free.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-2xl px-8 py-3.5 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-lg"
              style={{ background: 'white', color: 'var(--ocean-700)', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
            >
              Create free account
            </Link>
            <Link
              href="/spots"
              className="rounded-2xl px-7 py-3.5 text-sm font-semibold transition-all hover:-translate-y-0.5"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              Browse spots →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Data sources ─────────────────────────────────────────────── */}
      <section className="py-10 px-5" style={{ background: 'white', borderTop: '1px solid var(--border)' }}>
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: 'var(--text-3)' }}>
            Trusted Data Sources
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6" style={{ color: 'var(--text-3)' }}>
            {[
              { name: 'NOAA NDBC Buoys', icon: '📡' },
              { name: 'Open-Meteo Marine API', icon: '🌊' },
              { name: 'NOAA CO-OPS Tides', icon: '🌊' },
              { name: 'OpenStreetMap', icon: '🗺️' },
            ].map((s, i, a) => (
              <span key={s.name} className="flex items-center gap-6">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <span>{s.icon}</span>
                  <span>{s.name}</span>
                </span>
                {i < a.length - 1 && <span style={{ color: 'var(--border)' }}>·</span>}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
