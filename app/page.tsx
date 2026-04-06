import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export default async function HomePage() {
  const spotCount = await prisma.surfSpot.count().catch(() => 0)

  return (
    <div style={{ background: 'var(--sand-50)' }}>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ minHeight: '90vh', display: 'flex', alignItems: 'center' }}>

        {/* Multi-layer ocean gradient */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(150deg, #e8f4fd 0%, #f5ede2 40%, #e0f2f8 75%, #d6efe8 100%)',
        }} />

        {/* Decorative depth circles */}
        <div className="absolute top-0 right-0 h-[600px] w-[600px] rounded-full pointer-events-none" style={{
          background: 'radial-gradient(circle, rgba(27,127,203,0.07) 0%, transparent 65%)',
          transform: 'translate(30%, -30%)',
        }} />
        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full pointer-events-none" style={{
          background: 'radial-gradient(circle, rgba(77,191,202,0.09) 0%, transparent 65%)',
          transform: 'translate(-30%, 30%)',
        }} />
        <div className="absolute top-1/2 left-1/3 h-[300px] w-[300px] rounded-full pointer-events-none" style={{
          background: 'radial-gradient(circle, rgba(233,196,106,0.06) 0%, transparent 65%)',
          transform: 'translate(-50%, -50%)',
        }} />

        {/* Animated wave layers at bottom */}
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
          <svg viewBox="0 0 1440 220" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
            <path
              d="M0,120 C120,160 240,80 360,120 C480,160 600,80 720,110 C840,140 960,70 1080,110 C1200,150 1320,100 1440,120 L1440,220 L0,220 Z"
              fill="rgba(27,127,203,0.06)"
              style={{ animation: 'wave-drift 10s ease-in-out infinite' }}
            />
            <path
              d="M0,140 C180,100 360,180 540,140 C720,100 900,175 1080,140 C1200,120 1320,155 1440,140 L1440,220 L0,220 Z"
              fill="rgba(77,191,202,0.09)"
              style={{ animation: 'wave-drift 14s ease-in-out infinite reverse' }}
            />
            <path
              d="M0,165 C200,140 400,190 600,165 C800,140 1050,185 1200,165 C1300,155 1380,170 1440,165 L1440,220 L0,220 Z"
              fill="rgba(27,127,203,0.13)"
            />
          </svg>
        </div>

        {/* Decorative wave compass graphic */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none hidden lg:block" style={{ opacity: 0.12 }}>
          <svg width="440" height="440" viewBox="0 0 440 440" fill="none">
            <circle cx="220" cy="220" r="200" stroke="#1b7fcb" strokeWidth="1" strokeDasharray="6 4" />
            <circle cx="220" cy="220" r="140" stroke="#4dbfca" strokeWidth="1" strokeDasharray="4 3" />
            <circle cx="220" cy="220" r="80" stroke="#1b7fcb" strokeWidth="1.5" />
            {/* Compass cross */}
            <line x1="220" y1="20" x2="220" y2="420" stroke="#1b7fcb" strokeWidth="0.8" opacity="0.5" />
            <line x1="20" y1="220" x2="420" y2="220" stroke="#1b7fcb" strokeWidth="0.8" opacity="0.5" />
            {/* N/S/E/W labels */}
            <text x="220" y="15" textAnchor="middle" fill="#1b7fcb" fontSize="14" fontWeight="bold" fontFamily="Playfair Display, serif">N</text>
            <text x="220" y="438" textAnchor="middle" fill="#1b7fcb" fontSize="14" fontWeight="bold" fontFamily="Playfair Display, serif">S</text>
            <text x="432" y="225" textAnchor="middle" fill="#1b7fcb" fontSize="14" fontWeight="bold" fontFamily="Playfair Display, serif">E</text>
            <text x="8" y="225" textAnchor="middle" fill="#1b7fcb" fontSize="14" fontWeight="bold" fontFamily="Playfair Display, serif">W</text>
            {/* Wave lines inside */}
            <path d="M100,220 C120,205 140,235 160,220 C180,205 200,230 220,220 C240,210 260,230 280,220 C300,210 320,230 340,220" stroke="#4dbfca" strokeWidth="2" fill="none" />
            <path d="M100,240 C120,225 140,255 160,240 C180,225 200,250 220,240 C240,230 260,250 280,240 C300,230 320,250 340,240" stroke="#1b7fcb" strokeWidth="1.5" fill="none" opacity="0.7" />
            {/* Finder dot */}
            <circle cx="220" cy="220" r="8" fill="#e07a5f" />
            <circle cx="220" cy="220" r="4" fill="white" />
          </svg>
        </div>

        {/* Content */}
        <div className="relative mx-auto max-w-6xl w-full px-5 py-20">
          <div className="max-w-2xl animate-float">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium mb-6 animate-float-delay-1"
              style={{ background: 'rgba(27,127,203,0.1)', border: '1px solid rgba(27,127,203,0.2)', color: 'var(--ocean-700)' }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Powered by NOAA &amp; Open-Meteo — always free
            </div>

            <h1
              className="animate-float-delay-1"
              style={{
                fontFamily: 'Playfair Display, serif',
                fontSize: 'clamp(40px, 6vw, 72px)',
                fontWeight: 700,
                lineHeight: 1.05,
                color: 'var(--text)',
                letterSpacing: '-0.02em',
              }}
            >
              Find your
              <br />
              <span style={{ color: 'var(--ocean-600)', fontStyle: 'italic' }}>perfect wave.</span>
            </h1>

            <p
              className="mt-5 text-lg leading-relaxed animate-float-delay-2"
              style={{ color: 'var(--text-2)', maxWidth: '520px' }}
            >
              Real surf forecasts from NOAA ocean buoys and Open-Meteo wave models.
              Wave height, swell period, power index, wind, tides, and live conditions —
              covering the entire California coast. No subscription, no paywall.
            </p>

            {/* CTA buttons */}
            <div className="mt-8 flex flex-wrap gap-3 animate-float-delay-3">
              <Link
                href="/spots"
                className="inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-sm font-semibold text-white transition-all hover:opacity-90 hover:-translate-y-0.5"
                style={{ background: 'var(--ocean-600)', boxShadow: '0 4px 20px rgba(27,127,203,0.35)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                Find your spot
              </Link>
              <Link
                href="/spots"
                className="inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold transition-all hover:-translate-y-0.5"
                style={{
                  background: 'white',
                  border: '1.5px solid var(--border)',
                  color: 'var(--text)',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
                }}
              >
                🗺️ Live Map
              </Link>
            </div>

            {/* Stats row */}
            <div className="mt-10 flex flex-wrap gap-8 animate-float-delay-4">
              {[
                { value: `${spotCount}+`, label: 'surf spots', icon: '📍' },
                { value: 'NOAA', label: 'live buoys', icon: '📡' },
                { value: '7-day', label: 'forecast', icon: '🌊' },
                { value: '100%', label: 'free forever', icon: '✓' },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2.5">
                  <span style={{ fontSize: '18px' }}>{s.icon}</span>
                  <div>
                    <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ocean-700)', fontFamily: 'Playfair Display, serif', lineHeight: 1.1 }}>
                      {s.value}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

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
