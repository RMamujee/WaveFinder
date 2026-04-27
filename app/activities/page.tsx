import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'
import type { WFIconName } from '@/components/ui/Icon'
import { ACTIVITY_META, type WaterActivity } from '@/types/spot'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Water Activities – WaveFind',
  description: 'Find the best spots for surfing, fishing, boating, jet skiing, spearfishing, bodysurfing, parasailing, and paddleboarding.',
}

const ACTIVITY_DESC: Record<WaterActivity, string> = {
  surfing:        'Live wave height, swell period, wind & tide forecasts',
  fishing:        'Best fishing spots, tidal charts & water temp',
  boating:        'Marina access, depth charts & weather windows',
  jetski:         'Calm water zones, launch ramps & wind conditions',
  spearfishing:   'Visibility, depth, current & marine life data',
  bodysurfing:    'Shore break forecasts & sand bottom spots',
  parasailing:    'Wind speed windows & safe launch beaches',
  paddleboarding: 'Flat water conditions, tides & scenic routes',
}

const ACTIVITIES: WaterActivity[] = [
  'surfing', 'fishing', 'boating', 'jetski',
  'spearfishing', 'bodysurfing', 'parasailing', 'paddleboarding'
]

export default function ActivitiesPage() {
  return (
    <div style={{ background: 'var(--sand-50)', minHeight: '100vh' }}>
      <div className="mx-auto max-w-5xl px-5 py-12">
        <div className="mb-10 text-center">
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px,5vw,48px)', fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, marginBottom: 12 }}>
            Every water activity,<br /><span style={{ color: 'var(--ocean-600)', fontStyle: 'italic' }}>one platform.</span>
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: 15, maxWidth: 480, margin: '0 auto' }}>
            Real-time conditions, spot discovery, and forecasts for everything you do on the water.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {ACTIVITIES.map((act) => {
            const meta = ACTIVITY_META[act]
            return (
              <Link
                key={act}
                href={`/spots?activity=${act}`}
                style={{ textDecoration: 'none' }}
              >
                <div
                  className="rounded-2xl p-5 flex flex-col gap-3 transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer h-full"
                  style={{ background: 'white', border: '1.5px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: meta.bg }}
                  >
                    <Icon name={meta.icon as WFIconName} size={22} style={{ color: meta.color }} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 3 }}>{meta.label}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>{ACTIVITY_DESC[act]}</p>
                  </div>
                  <div className="mt-auto pt-2 flex items-center gap-1" style={{ color: meta.color }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Find spots</span>
                    <Icon name="arrowRight" size={12} />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
