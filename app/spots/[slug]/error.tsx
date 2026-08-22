'use client'

// Route-level boundary: without it, a throw from any optional side panel
// escalated to the root boundary and replaced the entire forecast page.
export default function SpotError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-7xl px-5 py-16">
      <div className="rounded-2xl p-8 text-center" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
        <p className="text-sm font-semibold" style={{ color: '#b91c1c' }}>
          Something went wrong loading this spot.
        </p>
        <p className="text-xs mt-1" style={{ color: '#ef4444' }}>
          The forecast data may be temporarily unavailable.
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          style={{ background: 'white', border: '1px solid #fecaca', color: '#b91c1c' }}
        >
          Try again
        </button>
      </div>
    </div>
  )
}
