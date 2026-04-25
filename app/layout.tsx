import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/components/layout/Providers'
import { Navbar } from '@/components/layout/Navbar'
import { PWAInit } from '@/components/layout/PWAInit'
import { InstallPrompt } from '@/components/layout/InstallPrompt'

export const metadata: Metadata = {
  title: 'WaveFinder – Free Surf Forecast',
  description: 'Real-time surf forecasts powered by NOAA buoys and Open-Meteo. Wave height, swell period, wind, tides, and live conditions for every California surf spot — free forever.',
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
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col antialiased">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <PWAInit />
          <InstallPrompt />
        </Providers>
      </body>
    </html>
  )
}
