import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { SpotForecastView } from './SpotForecastView'
import type { Metadata } from 'next'
import type { SurfSpot } from '@/types/spot'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const spot = await prisma.surfSpot.findUnique({ where: { slug } })
  if (!spot) return {}
  return {
    title: `${spot.name} Surf Forecast – WaveFinder`,
    description: `7-day surf forecast for ${spot.name}, ${spot.region}. Wave height, swell period, wind, and tides.`,
  }
}

export default async function SpotPage({ params }: Props) {
  const { slug } = await params
  const spot = await prisma.surfSpot.findUnique({ where: { slug } })

  if (!spot) notFound()

  return <SpotForecastView spot={spot as SurfSpot} />
}
