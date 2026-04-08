import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: '#0e4d88',
          borderRadius: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* WaveFinder logo — matches the Navbar WaveFinderLogo SVG */}
        <svg width="144" height="112" viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Wave 1 — ocean blue */}
          <path
            d="M2 14 C5 9 8 7.5 11 10 C14 12.5 16 8 19 7 C22 6 25 8 28 10 C30 11.2 32 12 34 12"
            stroke="#7ec0f5"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Wave 2 — seafoam */}
          <path
            d="M2 20 C5 16 8 15 11 17 C14 19 16 15.5 19 14.5 C22 13.5 25 15.5 28 17 C30 18 32 18.5 34 18.5"
            stroke="#4dbfca"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.85"
          />
          {/* Fin */}
          <path
            d="M22 10 L20 16"
            stroke="#7ec0f5"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.7"
          />
          {/* Sun — coral with white center */}
          <circle cx="34" cy="7" r="3" fill="#e07a5f" opacity="0.95" />
          <circle cx="34" cy="7" r="1.5" fill="white" />
        </svg>
      </div>
    ),
    { width: 180, height: 180 },
  )
}
