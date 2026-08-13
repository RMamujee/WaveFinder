import Link from 'next/link'

export function Footer() {
  return (
    <footer
      className="mt-auto border-t"
      style={{ background: 'var(--sand-50)', borderColor: 'var(--border)' }}
    >
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <p className="text-sm font-bold mb-3" style={{ color: 'var(--text)', fontFamily: 'var(--font-playfair), serif' }}>
              WaveFinder
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>
              Free surf forecasts for 1,490+ spots worldwide. Built with public data from NOAA and Open-Meteo.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-3)' }}>
              Product
            </p>
            <ul className="space-y-2 text-xs">
              <li><Link href="/spots"     className="hover:underline" style={{ color: 'var(--text-2)' }}>All spots</Link></li>
              <li><Link href="/best-spots" className="hover:underline" style={{ color: 'var(--text-2)' }}>Best now</Link></li>
              <li><Link href="/compare"   className="hover:underline" style={{ color: 'var(--text-2)' }}>Compare</Link></li>
              <li><Link href="/timeline"  className="hover:underline" style={{ color: 'var(--text-2)' }}>Timeline</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-3)' }}>
              Legal
            </p>
            <ul className="space-y-2 text-xs">
              <li><Link href="/privacy" className="hover:underline" style={{ color: 'var(--text-2)' }}>Privacy</Link></li>
              <li><Link href="/terms"   className="hover:underline" style={{ color: 'var(--text-2)' }}>Terms of Service</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-3)' }}>
              Data sources
            </p>
            <ul className="space-y-2 text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>
              <li>
                Weather data by{' '}
                <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--text-2)' }}>
                  Open-Meteo
                </a>{' '}
                (CC-BY 4.0)
              </li>
              <li>
                Tides &amp; buoys by{' '}
                <a href="https://www.ndbc.noaa.gov/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--text-2)' }}>
                  NOAA
                </a>{' '}
                (public domain, not endorsed)
              </li>
              <li>
                Maps from{' '}
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--text-2)' }}>
                  OpenStreetMap
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-3)' }}>
          <p>© {new Date().getFullYear()} WaveFinder. Forecasts are advisory — always check local conditions before paddling out.</p>
          <p>
            Made by{' '}
            <a href="https://www.linkedin.com/in/rmamujee" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: 'var(--ocean-600)' }}>
              Rahil Mamujee
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
