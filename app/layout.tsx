import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/layout/Providers'
import { Navbar } from '@/components/layout/Navbar'
import { PWAInit } from '@/components/layout/PWAInit'

export const metadata: Metadata = {
  title: 'WaveFinder – Free Surf Forecast',
  description: 'Real-time surf forecasts powered by NOAA buoys and Open-Meteo. Wave height, swell period, wind, tides, and live conditions for every California surf spot — free forever.',
  themeColor: '#0e4d88',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WaveFinder',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full antialiased">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <PWAInit />
        </Providers>
      </body>
    </html>
  )
}
