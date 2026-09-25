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
export const IconDrive = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3.5" y="13" width="17" height="6.5" rx="2" />
    <path d="M5.5 13 8 5.5h8l2.5 7.5" />
    <path d="M16.5 16.2h.01M13.5 16.2h.01" />
  </svg>
)
export const IconShelf = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3.5 20h17" />
    <rect x="5" y="6" width="3.2" height="14" rx="0.8" />
    <rect x="9.6" y="4" width="3.2" height="16" rx="0.8" />
    <path d="m15 8.2 3-.8 2.6 12-3 .6z" />
  </svg>
)
export const IconResume = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M4 4v4h4" />
    <path d="m10.5 9.2 4.2 2.8-4.2 2.8z" />
  </svg>
)
export const IconUsers = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
    <path d="M15.5 5.6a3.2 3.2 0 0 1 0 6M17 14.2c1.9.5 3.1 2.1 3.5 4.8" />
  </svg>
)
export const IconUser = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="8.5" r="3.6" />
    <path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6" />
  </svg>
)
export const IconHeart = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 19.5s-7.5-4.4-7.5-9.7A4.3 4.3 0 0 1 12 7.1a4.3 4.3 0 0 1 7.5 2.7c0 5.3-7.5 9.7-7.5 9.7z" />
  </svg>
)
export const IconRadar = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 12 17.5 6.5" />
    <circle cx="16" cy="14.5" r="0.9" fill="currentColor" />
  </svg>
)
export const IconTrophy = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 20.5h8M12 16.5v4M7 4h10v5a5 5 0 0 1-10 0z" />
    <path d="M17 5.5h3v1.6a3 3 0 0 1-3 3M7 5.5H4v1.6a3 3 0 0 0 3 3" />
  </svg>
)
export const IconShare = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 4v11M7.5 8.5 12 4l4.5 4.5" />
    <path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" />
  </svg>
)
export const IconCopy = (p: P) => (
  <svg {...base} {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2.2" />
    <path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
  </svg>
)
export const IconCheck = (p: P) => (
  <svg {...base} {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)
export const IconPalette = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 1.9-1 1.4-2.1-.6-1.2.1-2.4 1.5-2.4h1.7a3.9 3.9 0 0 0 3.9-3.9c0-4.8-3.8-8.6-8.5-8.6z" />
    <circle cx="7.8" cy="11" r="1" fill="currentColor" />
    <circle cx="10.5" cy="7.4" r="1" fill="currentColor" />
    <circle cx="15" cy="7.8" r="1" fill="currentColor" />
  </svg>
)
export const IconHistory = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
    <path d="M4.5 4.5v3.8h3.8M12 8.5V12l2.5 1.6" />
  </svg>
)
export const IconFilter = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 5.5h16l-6.2 7.3v5.4l-3.6 1.8v-7.2z" />
  </svg>
)
export const IconThermo = (p: P) => (
  <svg {...base} {...p}>
    <path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a3.8 3.8 0 1 0 4 0z" />
    <path d="M12 16.5v-6" />
  </svg>
)
export const IconCamera = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2L9 5h6l1.3 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
    <circle cx="12" cy="12.8" r="3.3" />
  </svg>
)
export const IconEdit = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4.5 19.5h4l10-10a2.8 2.8 0 0 0-4-4l-10 10z" />
    <path d="m13.5 6.5 4 4" />
  </svg>
)
export const IconExternal = (p: P) => (
  <svg {...base} {...p}>
    <path d="M13.5 4.5h6v6M19.5 4.5 11 13" />
    <path d="M17.5 14v4a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V8A1.5 1.5 0 0 1 6 6.5h4" />
  </svg>
)
export const IconSwitch = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4.5 8.5h13l-3.5-3.5M19.5 15.5h-13l3.5 3.5" />
  </svg>
)
export const IconRotate = (p: P) => (
  <svg {...base} {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.5 4.5v4.2h-4.2" />
  </svg>
)
export const IconStore = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 8.5h14l-1 11a1.5 1.5 0 0 1-1.5 1.4h-9A1.5 1.5 0 0 1 6 19.5z" />
    <path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" />
  </svg>
)
export const IconModes = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </svg>
)
export const IconClose = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)
export const IconChat = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-8l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z" />
  </svg>
)
export const IconWrench = (p: P) => (
  <svg {...base} {...p}>
    <path d="M14.5 5.2a4.5 4.5 0 0 0-5.3 6L4.5 16a2 2 0 0 0 2.8 2.8l4.8-4.7a4.5 4.5 0 0 0 6-5.3l-2.8 2.7-2.6-.5-.5-2.6z" />
  </svg>
)
export const IconThumb = ({ down, ...p }: P & { down?: boolean }) => (
  <svg {...base} {...p} style={{ transform: down ? 'rotate(180deg)' : undefined, ...(p.style ?? {}) }}>
    <path d="M7.5 10.5v9h-3v-9zM7.5 10.5 11 4a2 2 0 0 1 2.8 2.3l-.8 3.2h5.5a2 2 0 0 1 2 2.4l-1.3 6.2a2 2 0 0 1-2 1.6H7.5" />
  </svg>
)
export const IconSparkles = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 3.5l1.8 4.7 4.7 1.8-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.8zM18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
  </svg>
)
/** Portátil retrô (Emulação). */
export const IconRetro = (p: P) => (
  <svg {...base} {...p}>
    <rect x="6" y="2.8" width="12" height="18.4" rx="2" />
    <rect x="8.4" y="5.2" width="7.2" height="5.6" rx="0.8" />
    <path d="M9.6 14v3M8.1 15.5h3" />
    <circle cx="14.9" cy="14.6" r="0.9" />
    <circle cx="13.3" cy="16.6" r="0.9" />
  </svg>
)