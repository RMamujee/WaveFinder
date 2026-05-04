import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const spots = await prisma.surfSpot.findMany({
    select: { slug: true, createdAt: true },
  }).catch(() => [])

  const now = new Date()

  return [
    { url: SITE_URL,                         priority: 1.0, changeFrequency: 'daily',  lastModified: now },
    { url: `${SITE_URL}/spots`,              priority: 0.9, changeFrequency: 'hourly', lastModified: now },
    { url: `${SITE_URL}/regions`,            priority: 0.8, changeFrequency: 'daily',  lastModified: now },
    { url: `${SITE_URL}/best-spots`,         priority: 0.8, changeFrequency: 'hourly', lastModified: now },
    { url: `${SITE_URL}/compare`,            priority: 0.7, changeFrequency: 'monthly',lastModified: now },
    { url: `${SITE_URL}/timeline`,           priority: 0.7, changeFrequency: 'hourly', lastModified: now },
    { url: `${SITE_URL}/gear`,               priority: 0.6, changeFrequency: 'monthly',lastModified: now },
    { url: `${SITE_URL}/pricing`,            priority: 0.7, changeFrequency: 'monthly',lastModified: now },
    { url: `${SITE_URL}/privacy`,            priority: 0.3, changeFrequency: 'yearly', lastModified: now },
    { url: `${SITE_URL}/terms`,              priority: 0.3, changeFrequency: 'yearly', lastModified: now },
    ...spots.map((s) => ({
      url: `${SITE_URL}/spots/${s.slug}`,
      priority: 0.7,
      changeFrequency: 'hourly' as const,
      lastModified: s.createdAt ?? now,
    })),
  ]
}
