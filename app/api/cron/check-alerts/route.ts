import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendAlertEmail } from '@/lib/email'
import { format } from 'date-fns'

export const maxDuration = 60

export async function GET(req: Request) {
  // Verify this is called by Vercel Cron or with the correct secret
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get all active alerts that haven't fired today
  const alerts = await prisma.spotAlert.findMany({
    where: {
      active: true,
      OR: [
        { lastSentAt: null },
        { lastSentAt: { lt: today } },
      ],
    },
  })

  if (!alerts.length) return NextResponse.json({ sent: 0 })

  // Deduplicate spots to fetch
  const uniqueSpotIds = [...new Set(alerts.map((a) => a.spotId))]
  const spots = await prisma.surfSpot.findMany({
    where: { id: { in: uniqueSpotIds } },
    select: { id: true, slug: true, lat: true, lng: true, name: true },
  })
  const spotMap = new Map(spots.map((s) => [s.id, s]))

  let sent = 0

  for (const alert of alerts) {
    const spot = spotMap.get(alert.spotId)
    if (!spot) continue

    try {
      // Fetch the forecast for this spot
      const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
      const res = await fetch(`${base}/api/forecast/${spot.slug}`)
      if (!res.ok) continue
      const data = await res.json()

      const forecast: { date: string; dominantRating: string; maxWaveHeight: number; avgPeriod: number; hours: { wind: { speed: number; directionLabel: string } }[] }[] = data.forecast ?? []

      // Check today and tomorrow
      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const tomorrowStr = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')

      const matchingDay = forecast.find(
        (d) =>
          (d.date === todayStr || d.date === tomorrowStr) &&
          (alert.minRating === 'good'
            ? d.dominantRating === 'good' || d.dominantRating === 'epic'
            : d.dominantRating === 'epic')
      )

      if (!matchingDay) continue

      const waveH = `${Math.round(matchingDay.maxWaveHeight * 3.281)}ft (${matchingDay.maxWaveHeight}m)`
      const period = `${matchingDay.avgPeriod}s`
      const wind = matchingDay.hours[0]
        ? `${Math.round(matchingDay.hours[0].wind.speed)} km/h ${matchingDay.hours[0].wind.directionLabel}`
        : '—'

      await sendAlertEmail({
        to: alert.email,
        spotName: alert.spotName,
        rating: matchingDay.dominantRating,
        waveHeight: waveH,
        period,
        wind,
        date: matchingDay.date === todayStr ? 'Today' : 'Tomorrow',
        slug: spot.slug,
      })

      await prisma.spotAlert.update({
        where: { id: alert.id },
        data: { lastSentAt: new Date() },
      })

      sent++
    } catch {
      // Continue with next alert if one fails
    }
  }

  return NextResponse.json({ sent, checked: alerts.length })
}
