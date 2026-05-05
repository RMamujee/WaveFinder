import type { NextConfig } from "next";

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // unsafe-inline required for Next.js hydration scripts and Leaflet inline styles.
      // unsafe-eval removed — React 19 and Leaflet 1.9 do not require it in production.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://maps.wikimedia.org https://tile.openstreetmap.org https://server.arcgisonline.com https://*.arcgisonline.com https://*.arcgis.com https://*.basemaps.cartocdn.com https://cartodb-basemaps-*.global.ssl.fastly.net https://tiles.openseamap.org https://i.ytimg.com https://*.ytimg.com https://images.windy.com https://*.windy.com",
      "connect-src 'self' https://*.open-meteo.com https://api.open-meteo.com https://www.ndbc.noaa.gov https://tidesandcurrents.noaa.gov https://www.waterqualitydata.us https://server.arcgisonline.com https://*.arcgisonline.com https://*.basemaps.cartocdn.com https://api.windy.com",
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://webcams.windy.com https://*.windy.com https://www.openstreetmap.org",
      "worker-src blob:",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
