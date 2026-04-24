import type { SVGProps } from 'react'

export type IconName =
  | 'buoy' | 'wave' | 'tide' | 'map' | 'surfer' | 'pin'
  | 'star' | 'wind' | 'sun' | 'moon' | 'compass' | 'temp'
  | 'partlyCloudy' | 'beach' | 'board' | 'log' | 'gear'

// Each entry is one SVG d-string (multiple subpaths separated by M are valid).
const PATHS: Record<IconName, string> = {
  buoy:
    'M12 2v2 ' +
    'M9.5 8a2.5 2.5 0 0 1 5 0v3a2.5 2.5 0 0 1-5 0V8z ' +
    'M12 14v3 ' +
    'M5 20c2-2 4.5-2 7-1 2.5-1 5.5-1 7 1',
  wave:
    'M2 12c1.5-3 4-4.5 6.5-4.5S13 9 15.5 9 20 6 22 3 ' +
    'M2 18c1.5-3 4-4.5 6.5-4.5S13 15 15.5 15 20 12 22 9',
  tide:
    'M12 5v14 M9 8l3-3 3 3 M9 16l3 3 3-3 M3 12h4 M17 12h4',
  map:
    'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z M9 3v15 M15 6v15',
  surfer:
    'M12 4.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z ' +
    'M10 7l2-2 2 1.5 2-1 1.5 2-2 2.5v3l-3 4H9l1.5-4v-3L10 7z ' +
    'M4 19c2-1.5 5-2 8-1.5 3-.5 6 0 8 1.5',
  pin:
    'M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z ' +
    'M12 11.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z',
  star:
    'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  wind:
    'M9.59 4.59A2 2 0 1 1 11 8H2 ' +
    'M10.59 19.41A2 2 0 1 0 14 16H2 ' +
    'M15.73 3.73A2.5 2.5 0 1 1 19.5 12H2',
  sun:
    'M12 3v2 M12 19v2 ' +
    'M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 ' +
    'M3 12h2 M19 12h2 ' +
    'M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42 ' +
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  moon:
    'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  compass:
    'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z ' +
    'M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z',
  temp:
    'M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z',
  partlyCloudy:
    'M12 4a4 4 0 0 1 3.46 6A4 4 0 1 1 14 18H7a5 5 0 1 1 1.84-9.65A4 4 0 0 1 12 4z',
  beach:
    'M2 20h20 ' +
    'M12 4C9 7 6 10 6 16h12c0-6-3-9-6-12z ' +
    'M9 20v-1 M15 20v-1',
  board:
    'M7 19L17 5 ' +
    'M17 5c1.5-1.5 3-.5 2 1.5 ' +
    'M7 19l-2 3 1-3',
  log:
    'M4 2h10l4 4v16H4V2z M14 2v4h4 M8 10h8 M8 14h8 M8 18h5',
  gear:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z ' +
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 ' +
    '1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06 ' +
    'a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09 ' +
    'A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06 ' +
    'A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 ' +
    '1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9 ' +
    '1.65 1.65 0 0 0 21 10h-.09a1.65 1.65 0 0 0-1.51 1z',
}

interface Props extends SVGProps<SVGSVGElement> {
  name: IconName
  size?: number
  strokeWidth?: number
}

export function Icon({ name, size = 20, strokeWidth = 1.6, ...svgProps }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...svgProps}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
