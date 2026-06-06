'use client'

import { useState } from 'react'
import { CheckoutButton } from './CheckoutButton'

type Plan = 'monthly' | 'annual'

// Display-only pricing (the authoritative amounts live in the Stripe prices).
const PLAN_DISPLAY: Record<Plan, { label: string; price: string; cadence: string; note: string }> = {
  monthly: { label: 'Monthly', price: '$1.49', cadence: '/mo', note: 'Billed monthly' },
  annual: { label: 'Annual', price: '$10', cadence: '/yr', note: 'Billed yearly — save 44%' },
}

export function ProPlanCard({ proFeatures, trialDays }: { proFeatures: string[]; trialDays: number }) {
  const [plan, setPlan] = useState<Plan>('annual')
  const display = PLAN_DISPLAY[plan]

  return (
    <div
      className="rounded-3xl p-7 flex flex-col"
      style={{
        background: 'white',
        border: '2px solid var(--ocean-500)',
        boxShadow: '0 12px 32px rgba(27,127,203,0.18)',
      }}
    >
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
          Pro
        </h2>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'var(--ocean-50)', color: 'var(--ocean-700)' }}>
          Most popular
        </span>
      </div>

      {/* Monthly / Annual toggle */}
      <div className="flex gap-1 p-1 mb-5 rounded-xl" style={{ background: 'var(--sand-100)', border: '1px solid var(--border)' }}>
        {(['monthly', 'annual'] as Plan[]).map((p) => {
          const active = plan === p
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPlan(p)}
              aria-pressed={active}
              className="flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition"
              style={
                active
                  ? { background: 'white', color: 'var(--ocean-700)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
                  : { background: 'transparent', color: 'var(--text-3)' }
              }
            >
              {PLAN_DISPLAY[p].label}
              {p === 'annual' && (
                <span className="ml-1" style={{ color: 'var(--ocean-600)' }}>
                  · save 44%
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mb-5">
        <span className="text-4xl font-bold" style={{ color: 'var(--text)' }}>
          {display.price}
        </span>{' '}
        <span className="text-sm" style={{ color: 'var(--text-3)' }}>
          {display.cadence}
        </span>
        <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
          {trialDays}-day free trial · {display.note}
        </p>
      </div>

      <ul className="space-y-2.5 mb-7 flex-1">
        {proFeatures.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-2)' }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: 'var(--ocean-600)', marginTop: 3, flexShrink: 0 }}
            >
              <path d="m5 12 5 5L20 7" />
            </svg>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <CheckoutButton plan={plan} />
    </div>
  )
}
