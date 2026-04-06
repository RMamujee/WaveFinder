import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/layout/Providers'
import { Navbar } from '@/components/layout/Navbar'

export const metadata: Metadata = {
  title: 'WaveFinder – Free Surf Forecast',
  description: 'Real-time surf forecasts powered by NOAA buoys and Open-Meteo. Wave height, swell period, wind, tides, and live conditions for every California surf spot — free forever.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full antialiased">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
