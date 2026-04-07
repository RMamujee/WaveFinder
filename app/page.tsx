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

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section className="py-24 px-5" style={{ background: 'white', borderTop: '1px solid var(--border)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--ocean-500)' }}>
              Built for surfers
            </p>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, color: 'var(--text)' }}>
              Everything you need at the beach
            </h2>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-3)', maxWidth: '460px', margin: '12px auto 0' }}>
              Accurate data from government sensors, surfable ratings, and smart recommendations — no guesswork.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 12 C4,7 7,5 10,8 C13,11 16,6 19,6 C22,6 23,8 23,8"/>
                    <path d="M2 17 C4,13 7,12 10,14 C13,16 16,13 19,13 C22,13 23,14 23,14"/>
                  </svg>
                ),
                title: '7-Day Wave Forecast',
                desc: 'Open-Meteo marine model updated hourly. Wave height, dominant period, swell height, and direction in metric and imperial.',
                accent: 'var(--ocean-500)',
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                ),
                title: 'Best Session Windows',
                desc: 'Dawn patrol, morning, midday, afternoon, evening — each rated for your spot\'s swell direction and wind exposure.',
                accent: 'var(--sunset)',
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/>
                    <path d="M9.6 4.6A2 2 0 1 1 11 8H2"/>
                    <path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
                  </svg>
                ),
                title: 'Wind Analysis',
                desc: 'Offshore vs onshore detection per spot. Know if it\'s glassy, cross-shore, or blown out before you drive to the beach.',
                accent: 'var(--seafoam)',
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <line x1="12" y1="2" x2="12" y2="5"/>
                    <line x1="12" y1="19" x2="12" y2="22"/>
                    <line x1="2" y1="12" x2="5" y2="12"/>
                    <line x1="19" y1="12" x2="22" y2="12"/>
                  </svg>
                ),
                title: 'Live NOAA Buoy Data',
                desc: 'Real readings from NDBC buoys every 30 minutes. Wave height, period, direction, water temperature, and wind at the buoy.',
                accent: '#3a9de8',
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                ),
                title: 'Wave Power Index',
                desc: 'Know the energy behind each swell. Wave power (kW/m) tells you if it\'s a gentle longboard day or an expert-only pounding shorebreak.',
                accent: 'var(--coral)',
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                ),
                title: 'Full California Coast',
                desc: `${spotCount}+ spots from Point Arena to San Diego — every county, every break. Interactive map with live conditions on every pin.`,
                accent: 'var(--kelp)',
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl p-6 transition-all hover:shadow-md hover:-translate-y-0.5"
                style={{ border: '1px solid var(--border)', background: 'var(--sand-50)' }}
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl mb-4"
                  style={{ background: `${f.accent}15`, border: `1px solid ${f.accent}25`, color: f.accent }}
                >
                  {f.icon}
                </div>
                <h3 className="font-semibold mb-1.5" style={{ color: 'var(--text)', fontFamily: 'DM Sans, sans-serif' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────── */}
      <section className="py-20 px-5" style={{ background: 'var(--sand-50)', borderTop: '1px solid var(--border)' }}>
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 700, color: 'var(--text)' }}>
              Real data. Zero guesswork.
            </h2>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-3)' }}>
              WaveFinder pulls from the same sensors the Coast Guard and NOAA use.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Pick your spot',
                desc: 'Browse the interactive map or search by name. Every spot shows live conditions from the nearest NOAA buoy.',
                icon: '📍',
              },
              {
                step: '02',
                title: 'Check conditions',
                desc: 'Wave height in feet and meters, swell period, wave power, wind speed and direction, plus the 7-day forecast.',
                icon: '📊',
              },
              {
                step: '03',
                title: 'Pick the right window',
                desc: 'Our session rating tells you exactly when to go — dawn patrol, morning, or afternoon — based on tides, wind, and swell direction.',
                icon: '⏰',
              },
            ].map((s) => (
              <div
                key={s.step}
                className="rounded-2xl p-6"
                style={{ background: 'white', border: '1px solid var(--border)' }}
              >
                <div className="text-3xl mb-4">{s.icon}</div>
                <div className="text-xs font-bold mb-1" style={{ color: 'var(--ocean-400)', letterSpacing: '0.1em' }}>{s.step}</div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text)', fontSize: '15px' }}>{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{s.desc}</p>
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
