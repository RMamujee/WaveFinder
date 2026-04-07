import { prisma } from '@/lib/prisma'

export const revalidate = 3600

async function getLeaderboard() {
  const [sessionCounts, waveData, spotData] = await Promise.all([
    // Most sessions
    prisma.surfSession.groupBy({
      by: ['userId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
    // Biggest waves
    prisma.surfSession.groupBy({
      by: ['userId'],
      _max: { waveHeightFt: true },
      where: { waveHeightFt: { not: null, gt: 0 } },
      orderBy: { _max: { waveHeightFt: 'desc' } },
      take: 10,
    }),
    // Most unique spots (raw SQL for COUNT DISTINCT)
    prisma.$queryRaw<{ userId: string; uniqueSpots: bigint }[]>`
      SELECT "userId", COUNT(DISTINCT "spotSlug")::int AS "uniqueSpots"
      FROM "SurfSession"
      WHERE "spotSlug" IS NOT NULL
      GROUP BY "userId"
      ORDER BY "uniqueSpots" DESC
      LIMIT 10
    `,
  ])

  // Collect all userIds and fetch names
  const allIds = [
    ...new Set([
      ...sessionCounts.map((r) => r.userId),
      ...waveData.map((r) => r.userId),
      ...spotData.map((r) => r.userId),
    ]),
  ]

  const users = await prisma.user.findMany({
    where: { id: { in: allIds } },
    select: { id: true, name: true },
  })
  const nameMap = new Map(users.map((u) => [u.id, u.name ?? 'Surfer']))

  const firstN = (name: string) => name.split(' ')[0]

  return {
    sessions: sessionCounts.map((r, i) => ({
      rank: i + 1,
      name: firstN(nameMap.get(r.userId) ?? 'Surfer'),
      value: r._count.id,
      label: r._count.id === 1 ? 'session' : 'sessions',
    })),
    waves: waveData
      .filter((r) => r._max.waveHeightFt !== null)
      .map((r, i) => ({
        rank: i + 1,
        name: firstN(nameMap.get(r.userId) ?? 'Surfer'),
        value: Math.round((r._max.waveHeightFt ?? 0) * 10) / 10,
        label: 'ft',
      })),
    spots: spotData.map((r, i) => ({
      rank: i + 1,
      name: firstN(nameMap.get(r.userId) ?? 'Surfer'),
      value: Number(r.uniqueSpots),
      label: Number(r.uniqueSpots) === 1 ? 'spot' : 'spots',
    })),
  }
}

function Medal({ rank }: { rank: number }) {
  if (rank === 1) return <span style={{ fontSize: 18 }}>🥇</span>
  if (rank === 2) return <span style={{ fontSize: 18 }}>🥈</span>
  if (rank === 3) return <span style={{ fontSize: 18 }}>🥉</span>
  return <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3)', minWidth: 20, textAlign: 'center', display: 'inline-block' }}>{rank}</span>
}

function Board({ title, icon, rows, unit }: { title: string; icon: string; rows: { rank: number; name: string; value: number; label: string }[]; unit?: string }) {
  if (!rows.length) return (
    <div style={{ background: 'white', borderRadius: 20, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', margin: '0 0 4px' }}>{icon} {title}</p>
      </div>
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No sessions logged yet</div>
    </div>
  )

  const max = rows[0].value

  return (
    <div style={{ background: 'white', borderRadius: 20, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', background: 'var(--sand-50)' }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ocean-500)', margin: 0 }}>{icon} {title}</p>
      </div>
      <div style={{ padding: '8px 0' }}>
        {rows.map((r) => (
          <div key={r.rank} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: r.rank < rows.length ? '1px solid var(--border)' : 'none' }}>
            <Medal rank={r.rank} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: r.rank <= 3 ? 700 : 500, color: 'var(--text)', fontSize: 14, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</p>
              {/* Progress bar */}
              <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: 'var(--sand-100)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, background: r.rank === 1 ? 'var(--ocean-500)' : r.rank === 2 ? 'var(--seafoam)' : 'var(--sand-400)', width: `${(r.value / max) * 100}%`, transition: 'width 0.5s' }} />
              </div>
            </div>
            <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15, margin: 0, whiteSpace: 'nowrap' }}>
              {r.value}<span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400, marginLeft: 3 }}>{r.label}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function LeaderboardPage() {
  const { sessions, waves, spots } = await getLeaderboard()
  const totalSessions = sessions.reduce((s, r) => s + r.value, 0)

  return (
    <div style={{ background: 'var(--sand-50)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px 32px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ocean-500)', margin: '0 0 8px' }}>Community</p>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 36, fontWeight: 700, color: 'var(--text)', margin: 0, lineHeight: 1.15 }}>Leaderboard</h1>
          <p style={{ color: 'var(--text-2)', marginTop: 10, fontSize: 15 }}>
            {totalSessions.toLocaleString()} sessions logged by the WaveFinder community.{' '}
            <a href="/sessions" style={{ color: 'var(--ocean-600)', fontWeight: 600, textDecoration: 'none' }}>Log yours →</a>
          </p>
        </div>
      </div>

      {/* Boards */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <Board title="Most Sessions" icon="📅" rows={sessions} />
          <Board title="Biggest Waves" icon="🌊" rows={waves} unit="ft" />
          <Board title="Explorer" icon="🗺️" rows={spots} />
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12, marginTop: 28 }}>
          Leaderboard updates hourly · Only shows first names · <a href="/sessions" style={{ color: 'var(--ocean-600)' }}>Log a session to appear</a>
        </p>
      </div>
    </div>
  )
}
