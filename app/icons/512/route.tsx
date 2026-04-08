import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: '#0e4d88',
          borderRadius: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="410" height="320" viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M2 14 C5 9 8 7.5 11 10 C14 12.5 16 8 19 7 C22 6 25 8 28 10 C30 11.2 32 12 34 12"
            stroke="#7ec0f5"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2 20 C5 16 8 15 11 17 C14 19 16 15.5 19 14.5 C22 13.5 25 15.5 28 17 C30 18 32 18.5 34 18.5"
            stroke="#4dbfca"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.85"
          />
          <path
            d="M22 10 L20 16"
            stroke="#7ec0f5"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.7"
          />
          <circle cx="34" cy="7" r="3" fill="#e07a5f" opacity="0.95" />
          <circle cx="34" cy="7" r="1.5" fill="white" />
        </svg>
      </div>
    ),
    { width: 512, height: 512 },
  )
}
