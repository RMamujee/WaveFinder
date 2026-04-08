import { prisma } from '@/lib/prisma'
import { LiveMapHero } from '@/components/home/LiveMapHero'

export default async function HomePage() {
  const spotCount = await prisma.surfSpot.count().catch(() => 0)

  return (
    <div style={{ background: 'var(--sand-50)' }}>

      {/* ── Hero: live map ────────────────────────────────────────────── */}
      <LiveMapHero spotCount={spotCount} />

      {/* ── Data sources + credits ────────────────────────────────────── */}
      <section className="py-10 px-5" style={{ background: 'white', borderTop: '1px solid var(--border)' }}>
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: 'var(--text-3)' }}>
            Trusted Data Sources
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 mb-7" style={{ color: 'var(--text-3)' }}>
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
      </section>

    </div>
  )
}
