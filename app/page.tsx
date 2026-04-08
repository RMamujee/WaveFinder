import { prisma } from '@/lib/prisma'
import { LiveMapHero } from '@/components/home/LiveMapHero'

export default async function HomePage() {
  const spotCount = await prisma.surfSpot.count().catch(() => 0)

  return (
    <div style={{ background: 'var(--sand-50)' }}>

      {/* ── Hero: live map ────────────────────────────────────────────── */}
      <LiveMapHero spotCount={spotCount} />

    </div>
  )
}
