import type { SVGProps } from 'react'

export type WFIconName =
  | 'buoy' | 'wave' | 'tide' | 'map' | 'pin' | 'star' | 'starFilled'
  | 'surfer' | 'wind' | 'sun' | 'moon' | 'compass' | 'temp'
  | 'search' | 'menu' | 'close' | 'chevronRight' | 'chevronLeft' | 'chevronDown'
  | 'arrowRight' | 'filter' | 'bell' | 'user' | 'settings' | 'layers'
  | 'list' | 'grid' | 'clock' | 'calendar' | 'bookmark' | 'share'
  | 'log' | 'board' | 'trend' | 'droplet'

const PATHS: Record<WFIconName, React.ReactNode> = {
  buoy: <><path d="M12 3v3"/><circle cx="12" cy="3" r=".7" fill="currentColor" stroke="none"/><path d="M9 6h6l1.5 4h-9z"/><path d="M10.5 10c-1 2-1.2 4-.5 6h4c.7-2 .5-4-.5-6"/><path d="M3 19c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0"/></>,
  wave: <><path d="M3 14c2-2 3.5-2 5.5 0s3.5 2 5.5 0 3.5-2 5.5 0"/><path d="M3 10c2-2 3.5-2 5.5 0s3.5 2 5.5 0 3.5-2 5.5 0" opacity=".55"/></>,
  tide: <><path d="M3 16c3-4 6-4 9 0s6 4 9 0"/><path d="M3 12c3-4 6-4 9 0s6 4 9 0" opacity=".5"/></>,
  map: <><path d="M3 6.5 9 4l6 2 6-2.5V17l-6 2.5-6-2-6 2.5z"/><path d="M9 4v14"/><path d="M15 6v14"/></>,
  pin: <><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/></>,
  star: <><path d="M12 3.5 14.5 9l6 .6-4.6 4 1.4 5.9-5.3-3.2-5.3 3.2 1.4-5.9-4.6-4 6-.6z"/></>,
  starFilled: <><path d="M12 3.5 14.5 9l6 .6-4.6 4 1.4 5.9-5.3-3.2-5.3 3.2 1.4-5.9-4.6-4 6-.6z" fill="currentColor"/></>,
  surfer: <><circle cx="15" cy="5.5" r="1.4"/><path d="M13 9l-2 3 2 1.5-1.5 3"/><path d="M17 8l-2 2.5 1.5 2"/><path d="M4 18c3-2 6-2 9 0s6 2 9 0"/></>,
  wind: <><path d="M4 10h11a3 3 0 1 0-3-3"/><path d="M4 14h15a3 3 0 1 1-3 3"/><path d="M4 18h6"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4"/></>,
  moon: <><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></>,
  compass: <><circle cx="12" cy="12" r="9"/><path d="m15 9-2 6-4 1 1-4z" fill="currentColor" fillOpacity=".15"/></>,
  temp: <><path d="M12 3a2 2 0 0 0-2 2v9.5a4 4 0 1 0 4 0V5a2 2 0 0 0-2-2z"/><circle cx="12" cy="17" r="1.6" fill="currentColor" stroke="none"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  close: <><path d="M18 6 6 18M6 6l12 12"/></>,
  chevronRight: <><path d="m9 6 6 6-6 6"/></>,
  chevronLeft: <><path d="m15 6-6 6 6 6"/></>,
  chevronDown: <><path d="m6 9 6 6 6-6"/></>,
  arrowRight: <><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></>,
  filter: <><path d="M3 5h18"/><path d="M6 12h12"/><path d="M10 19h4"/></>,
  bell: <><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2 2 0 0 0 4 0"/></>,
  user: <><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M16.9 16.9l1.4 1.4M5.6 18.4l1.4-1.4M16.9 7.1l1.4-1.4"/></>,
  layers: <><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r=".8" fill="currentColor"/><circle cx="4" cy="12" r=".8" fill="currentColor"/><circle cx="4" cy="18" r=".8" fill="currentColor"/></>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></>,
  bookmark: <><path d="M6 4h12v17l-6-4-6 4z"/></>,
  share: <><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 11 7.6-3.8M8.2 13l7.6 3.8"/></>,
  log: <><path d="M5 4h13a2 2 0 0 1 2 2v14H5z"/><path d="M5 4v16"/><path d="M9 9h8M9 13h8M9 17h5"/></>,
  board: <><path d="M12 3c-3.5 0-5 4-5 9s1.5 9 5 9 5-2 5-9-1.5-9-5-9z"/><path d="M10 18h4"/></>,
  trend: <><path d="M3 17l5-5 4 4 8-8"/><path d="M14 8h6v6"/></>,
  droplet: <><path d="M12 3s7 7 7 12a7 7 0 1 1-14 0c0-5 7-12 7-12z"/></>,
}

interface IconProps extends SVGProps<SVGSVGElement> {
  name: WFIconName
  size?: number
  strokeWidth?: number
}

export function Icon({ name, size = 20, strokeWidth = 1.6, ...rest }: IconProps) {
  const paths = PATHS[name]
  if (!paths) return null
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths}
    </svg>
  )
}
