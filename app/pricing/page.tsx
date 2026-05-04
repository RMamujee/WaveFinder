import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Pricing — WaveFinder',
  description: 'Simple, friendly pricing. Free forever for the core forecasts. Pro unlocks sync, alerts, and history.',
}

const FREE_FEATURES = [
  '1,490+ surf spots worldwide',
  '16-day swell forecast',
  'Live NOAA buoys & tides',
  '7-day chart history',
  'Spot search, compare, and timeline',
  'Sessions & gear logged on this device',
]

const PRO_FEATURES = [
  'Everything in Free',
  'Cross-device sync (sessions, saved spots, gear)',
  'Unlimited swell alerts via email & push',
  'Extended history — 90 days at every spot',
  'Best-spots-for-you recommendations',
  'Ad-free experience, forever',
  'Early access to new features',
]

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
      <div className="text-center mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--ocean-600)' }}>
          Pricing
        </p>
        <h1
          className="text-3xl sm:text-5xl font-bold mb-4"
          style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)', letterSpacing: '-0.02em' }}
        >
          Free forever.{' '}
          <span style={{ color: 'var(--ocean-600)', fontStyle: 'italic' }}>Pro when you want it.</span>
        </h1>
        <p className="text-sm sm:text-base max-w-xl mx-auto" style={{ color: 'var(--text-2)' }}>
          The forecast itself stays free. Pro adds cross-device sync and unlimited alerts for the price of a coffee a month.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 max-w-3xl mx-auto">
        <PlanCard
          name="Free"
          price="$0"
          cadence="forever"
          features={FREE_FEATURES}
          ctaLabel="Just start surfing"
          ctaHref="/spots"
          highlight={false}
        />
        <PlanCard
          name="Pro"
          price="$2.99"
          cadence="per month"
          annualNote="or $24/yr — save 33%"
          features={PRO_FEATURES}
          ctaLabel="Coming soon"
          ctaHref="/spots"
          highlight={true}
        />
      </div>

      <p className="text-center mt-10 text-xs" style={{ color: 'var(--text-3)' }}>
        Pro launches soon. Want to be first in line?{' '}
        <Link href="/spots" className="font-semibold hover:underline" style={{ color: 'var(--ocean-600)' }}>
          Use the free version
        </Link>
        {' '}and we&rsquo;ll email you when Pro is live.
      </p>
    </div>
  )
}

interface PlanCardProps {
  name: string
  price: string
  cadence: string
  annualNote?: string
  features: string[]
  ctaLabel: string
  ctaHref: string
  highlight: boolean
}

function PlanCard({ name, price, cadence, annualNote, features, ctaLabel, ctaHref, highlight }: PlanCardProps) {
  return (
    <div
      className="rounded-3xl p-7 flex flex-col"
      style={{
        background: 'white',
        border: highlight ? '2px solid var(--ocean-500)' : '1px solid var(--border)',
        boxShadow: highlight ? '0 12px 32px rgba(27,127,203,0.18)' : '0 2px 12px rgba(0,0,0,0.04)',
      }}
    >
      <div className="flex items-baseline justify-between mb-4">
        <h2
          className="text-xl font-bold"
          style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}
        >
          {name}
        </h2>
        {highlight && (
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'var(--ocean-50)', color: 'var(--ocean-700)' }}
          >
            Most popular
          </span>
        )}
      </div>

      <div className="mb-5">
        <span className="text-4xl font-bold" style={{ color: 'var(--text)' }}>{price}</span>
        {' '}
        <span className="text-sm" style={{ color: 'var(--text-3)' }}>{cadence}</span>
        {annualNote && (
          <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{annualNote}</p>
        )}
      </div>

      <ul className="space-y-2.5 mb-7 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-2)' }}>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: 'var(--ocean-600)', marginTop: 3, flexShrink: 0 }}
            >
              <path d="m5 12 5 5L20 7" />
            </svg>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href={ctaHref}
        className="block text-center rounded-xl px-5 py-3 text-sm font-semibold transition hover:opacity-90"
        style={{
          background: highlight ? 'var(--ocean-600)' : 'var(--sand-100)',
          color: highlight ? 'white' : 'var(--text-2)',
          border: highlight ? 'none' : '1px solid var(--border)',
        }}
      >
        {ctaLabel}
      </Link>
    </div>
  )
}
