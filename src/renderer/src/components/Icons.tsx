import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
} as const

export const IconHome = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 11 12 4l8 7v9H4z" />
    <path d="M10 20v-6h4v6" />
  </svg>
)
export const IconGrid = (p: P) => (
  <svg {...base} {...p}>
    <rect x="4" y="4" width="7" height="7" rx="2" />
    <rect x="13" y="4" width="7" height="7" rx="2" />
    <rect x="4" y="13" width="7" height="7" rx="2" />
    <rect x="13" y="13" width="7" height="7" rx="2" />
  </svg>
)
export const IconClock = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l3 2" />
  </svg>
)
export const IconStar = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base} {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="m12 4 2.4 5 5.6.7-4.1 3.8 1.1 5.5-5-2.8-5 2.8 1.1-5.5L4 9.7l5.6-.7z" />
  </svg>
)
export const IconSettings = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
  </svg>
)
export const IconPlus = (p: P) => (
  <svg {...base} strokeWidth={2} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const IconSearch = (p: P) => (
  <svg {...base} strokeWidth={2.2} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)
export const IconPlay = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M7 4v16l13-8z" />
  </svg>
)
export const IconDownload = (p: P) => (
  <svg {...base} strokeWidth={2} {...p}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
)
export const IconRefresh = (p: P) => (
  <svg {...base} {...p}>
    <path d="M20 12a8 8 0 1 1-2.3-5.7" />
    <path d="M20 4v5h-5" />
  </svg>
)
export const IconFolder = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
)
export const IconTrash = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
)
export const IconBack = (p: P) => (
  <svg {...base} strokeWidth={2} {...p}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
)
export const IconSpark = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
  </svg>
)
export const IconGauge = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4.5 17a8 8 0 1 1 15 0" />
    <path d="M12 13l4-5" />
    <circle cx="12" cy="13" r="1.4" fill="currentColor" />
  </svg>
)
export const IconGamepad = (p: P) => (
  <svg {...base} {...p}>
    <path d="M7 8h10a4 4 0 0 1 3.9 4.9l-.8 3.6a2.2 2.2 0 0 1-3.8 1L14.5 15h-5l-1.8 2.5a2.2 2.2 0 0 1-3.8-1l-.8-3.6A4 4 0 0 1 7 8z" />
    <path d="M8 11v3M6.5 12.5h3" />
    <circle cx="15.5" cy="11.5" r=".8" fill="currentColor" />
    <circle cx="17.5" cy="13.2" r=".8" fill="currentColor" />
  </svg>
)
export const IconSun = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </svg>
)
export const IconMoon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </svg>
)
export const IconTimeline = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 4v16" />
    <circle cx="6" cy="7" r="2" />
    <circle cx="6" cy="17" r="2" />
    <path d="M10 7h9M10 12h6M10 17h8" />
  </svg>
)
/* Controles de janela, no traço fino do Windows 11. */
export const IconWinMin = (p: P) => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1} {...p}>
    <path d="M1.5 6h9" />
  </svg>
)
export const IconWinMax = (p: P) => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1} {...p}>
    <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" />
  </svg>
)
export const IconWinRestore = (p: P) => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1} {...p}>
    <rect x="1.5" y="3.5" width="7" height="7" rx="1.2" />
    <path d="M3.5 3.5V2.7c0-.7.5-1.2 1.2-1.2h4.6c.7 0 1.2.5 1.2 1.2v4.6c0 .7-.5 1.2-1.2 1.2h-.8" />
  </svg>
)
export const IconWinClose = (p: P) => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1} {...p}>
    <path d="M2 2l8 8M10 2l-8 8" />
  </svg>
)
export const IconFullscreen = (p: P) => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1} {...p}>
    <path d="M1.5 4.5v-3h3M7.5 1.5h3v3M10.5 7.5v3h-3M4.5 10.5h-3v-3" />
  </svg>
)
export const IconExitFullscreen = (p: P) => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1} {...p}>
    <path d="M4.5 1.5v3h-3M10.5 4.5h-3v-3M7.5 10.5v-3h3M1.5 7.5h3v3" />
  </svg>
)
