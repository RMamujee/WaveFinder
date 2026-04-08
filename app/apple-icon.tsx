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
          borderRadius: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="148" height="110" viewBox="0 0 148 110" fill="none">
          {/* Wave 1 */}
          <path
            d="M4 48 C17 35 30 32 43 41 C56 50 64 34 77 30 C90 26 103 32 116 38 C122 41 130 44 144 46"
            stroke="#7ec0f5"
            strokeWidth="9"
            strokeLinecap="round"
          />
          {/* Wave 2 */}
          <path
            d="M4 70 C17 57 30 55 43 63 C56 71 64 57 77 53 C90 49 103 55 116 61 C122 64 130 67 144 68"
            stroke="#4dbfca"
            strokeWidth="7"
            strokeLinecap="round"
            opacity="0.85"
          />
          {/* Sun */}
          <circle cx="122" cy="22" r="13" fill="#e07a5f" />
          <circle cx="122" cy="22" r="6.5" fill="white" />
        </svg>
      </div>
    ),
    { width: 180, height: 180 },
  )
}
