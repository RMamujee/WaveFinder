import React from 'react'

export type IconName =
  | 'buoy' | 'wave' | 'tide' | 'map' | 'surfer'
  | 'pin'  | 'star' | 'wind' | 'sun' | 'moon'
  | 'compass' | 'temp'

// Monoline 24×24 paths — strokeLinecap="round" strokeLinejoin="round" throughout
const PATHS: Record<IconName, React.ReactNode> = {
  buoy: (
    <>
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="9.5" y1="2" x2="14.5" y2="2" />
      <circle cx="12" cy="11" r="4" />
      <path d="M7 17q5 3 10 0" />
      <path d="M5 20q7 4 14 0" />
    </>
  ),
  wave: (
    <>
      <path d="M2 11c1.5-4 3.5-4 5.5 0s4 4 5.5 0 4-4 5.5 0 1.5 4 3.5 0" />
      <path d="M2 17c1.5-4 3.5-4 5.5 0s4 4 5.5 0 4-4 5.5 0 1.5 4 3.5 0" />
    </>
  ),
  tide: (
    <>
      <path d="M2 15c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
      <path d="M2 10c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
      <polyline points="17 3 20 6 23 3" />
      <line x1="20" y1="6" x2="20" y2="9" />
    </>
  ),
  map: (
    <>
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </>
  ),
  surfer: (
    <>
      <circle cx="14" cy="4.5" r="1.5" />
      <path d="M14 6l-3 4.5 2.5 1.5L12 16" />
      <path d="M14 6l1.5 5-2 2.5" />
      <path d="M3 20c3.5-2 6-2 9-0.5s5.5 2 9 0.5" />
    </>
  ),
  pin: (
    <>
      <path d="M21 10c0 6-9 13-9 13S3 16 3 10a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  star: (
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  ),
  wind: (
    <>
      <path d="M9.59 4.59A2 2 0 1 1 11 8H2" />
      <path d="M10.59 19.41A2 2 0 1 0 12 16H2" />
      <path d="M15.73 8.27A2.5 2.5 0 1 1 17.5 12H2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2"  x2="12" y2="5"  />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="4.22" y1="4.22"  x2="6.34" y2="6.34"  />
      <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
      <line x1="2"  y1="12" x2="5"  y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.22"  y1="19.78" x2="6.34"  y2="17.66" />
      <line x1="17.66" y1="6.34"  x2="19.78" y2="4.22"  />
    </>
  ),
  moon: (
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </>
  ),
  temp: (
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
  ),
}

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName
  size?: number
  strokeWidth?: number
}

export function Icon({ name, size = 20, strokeWidth = 1.6, ...svgProps }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...svgProps}
    >
      {PATHS[name]}
    </svg>
  )
}
