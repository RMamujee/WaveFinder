import type { NextConfig } from "next";
import { SPOT_SLUG_ALIASES } from "./lib/spots/spot-aliases";

const isDev = process.env.NODE_ENV !== 'production'

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
      // unsafe-eval is DEVELOPMENT ONLY: Next's dev runtime and React's dev build
      // both need eval, and without it every page load logs "eval() is not
      // supported in this environment" and then fails hydration — React throws
      // the server tree away and re-renders the whole page on the client.
      // Production never gets it; React 19 and Leaflet 1.9 do not need eval there.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
      // Fonts are self-hosted via next/font — no Google Fonts origins needed.
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://maps.wikimedia.org https://tile.openstreetmap.org https://server.arcgisonline.com https://*.arcgisonline.com https://*.arcgis.com https://*.basemaps.cartocdn.com https://tiles.openseamap.org",
      "connect-src 'self' https://*.open-meteo.com https://api.open-meteo.com https://www.ndbc.noaa.gov https://tidesandcurrents.noaa.gov https://www.waterqualitydata.us https://server.arcgisonline.com https://*.arcgisonline.com https://*.basemaps.cartocdn.com",
      "frame-src 'self'",
      // 'self' is required for /sw.js. Without it the service worker was
      // blocked from ever registering — and PWAInit swallows the failure with
      // .catch(() => {}), so the precache and cache-first static handling in
      // public/sw.js had simply never run.
      "worker-src 'self' blob:",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      // Clickjacking defence for browsers that honour CSP over X-Frame-Options
      // (and the only one of the two that survives a nested-frame chain).
      "frame-ancestors 'self'",
      // Nothing in the app posts to a third party; pinning form targets stops a
      // markup injection from exfiltrating a form submission.
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["recharts", "date-fns"],
  },
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
  // Spot pages are fully prerendered with dynamicParams=false, so a retired
  // slug would hard-404 rather than fall through. Redirect the duplicates that
  // were merged away to the record that replaced them.
  async redirects() {
    return Object.entries(SPOT_SLUG_ALIASES).map(([from, to]) => ({
      source: `/spots/${from}`,
      destination: `/spots/${to}`,
      permanent: true,
    }))
  },
}

export default nextConfig
