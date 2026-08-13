import { LiveMapHero } from '@/components/home/LiveMapHero'
import { SURF_SPOTS_SEED } from '@/lib/spots-data'

export default async function HomePage() {
  const spotCount = SURF_SPOTS_SEED.length

  return (
    <div style={{ background: 'var(--sand-50)' }}>

      {/* ── Hero: live map ────────────────────────────────────────────── */}
      <LiveMapHero spotCount={spotCount} />

    </div>
  )
}
