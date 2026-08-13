import type { Metadata, Viewport } from 'next'
import { Playfair_Display, DM_Sans } from 'next/font/google'
import './globals.css'

// Self-hosted via next/font: fonts are served from this origin with a
// preloaded woff2 and a size-adjusted fallback, replacing the render-blocking
// Google Fonts CSS @import that previously delayed first paint.
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-dm-sans',
  display: 'swap',
})
import { Providers } from '@/components/layout/Providers'
import { Navbar } from '@/components/layout/Navbar'
import { PWAInit } from '@/components/layout/PWAInit'
import { InstallPrompt } from '@/components/layout/InstallPrompt'
import { Footer } from '@/components/layout/Footer'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

// Site URL is read from NEXT_PUBLIC_SITE_URL when set (production custom domain),
// falling back to the Vercel preview URL or local dev. metadataBase makes Next 16
// resolve relative OG image paths against the deployment's real origin.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'WaveFinder – Free Surf Forecast',
  description: 'Real-time surf forecasts for 1,490+ surf spots worldwide. Wave height, 16-day swell outlook, wind, tides, live buoys — free forever.',
  openGraph: {
    title: 'WaveFinder – Free Surf Forecast',
    description: 'Real-time surf forecasts for 1,490+ surf spots worldwide. 16-day swell outlook, wind, tides, live buoys — free forever.',
    url: SITE_URL,
    siteName: 'WaveFinder',
    images: [{ url: '/logo.png', width: 512, height: 512, alt: 'WaveFinder' }],
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'WaveFinder – Free Surf Forecast',
    description: 'Real-time surf forecasts for 1,490+ surf spots worldwide.',
    images: ['/logo.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WaveFinder',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0e4d88',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${playfair.variable} ${dmSans.variable}`}>
      <body className="min-h-full flex flex-col antialiased">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <PWAInit />
          <InstallPrompt />
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
