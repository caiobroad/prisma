import { BrowserWindow, screen, shell, type Rectangle } from 'electron'
import { join } from 'path'
import { makeAppIcon } from './icon'
import { getSetting, setSetting } from './db/games'
import type { WindowState } from '@shared/types'

export const WINDOW = { width: 1600, height: 900, minWidth: 1100, minHeight: 680 }

interface SavedBounds extends Rectangle {
  maximized?: boolean
}

function savedBounds(): SavedBounds | null {
  try {
    const raw = getSetting('windowBounds')
    if (!raw) return null
    const b = JSON.parse(raw) as SavedBounds
    // Só reaproveita se ainda couber em algum monitor conectado.
    const visible = screen.getAllDisplays().some((d) => {
      const a = d.workArea
      return b.x + 100 < a.x + a.width && b.x + b.width - 100 > a.x && b.y >= a.y - 10 && b.y + 60 < a.y + a.height
    })
    return visible && b.width >= WINDOW.minWidth && b.height >= WINDOW.minHeight ? b : null
  } catch {
    return null
  }
}

/** 1600×900 por padrão; em telas menores ocupa 92% da área útil, centralizada. */
function defaultBounds(): Rectangle {
  const { workArea } = screen.getPrimaryDisplay()
  const width = Math.min(WINDOW.width, Math.round(workArea.width * 0.92))
  const height = Math.min(WINDOW.height, Math.round(workArea.height * 0.92))
  return {
    width,
    height,
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2)
  }
}

export function windowState(win: BrowserWindow): WindowState {
  return { maximized: win.isMaximized(), fullscreen: win.isFullScreen() }
}

export function createMainWindow(startHidden: boolean, onState: (s: WindowState) => void, hash?: string): BrowserWindow {
  const saved = savedBounds()
  const bounds = saved ?? defaultBounds()
  const win = new BrowserWindow({
    ...bounds,
    minWidth: WINDOW.minWidth,
    minHeight: WINDOW.minHeight,
    show: false,
    frame: false,
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    roundedCorners: true,
    backgroundColor: '#07090F',
    title: 'Prisma',
    icon: makeAppIcon(64),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
      // O som da introdução toca antes do primeiro clique.
      autoplayPolicy: 'no-user-gesture-required',
      // Com a janela em segundo plano, o Chromium reduz timers e para de pintar.
      backgroundThrottling: true
    }
  })
  win.setMenuBarVisibility(false)

  win.once('ready-to-show', () => {
    if (saved?.maximized) win.maximize()
    if (!startHidden) win.show()
  })

  const emit = (): void => onState(windowState(win))
  win.on('maximize', emit)
  win.on('unmaximize', emit)
  win.on('enter-full-screen', emit)
  win.on('leave-full-screen', emit)

  // Guarda posição e tamanho para a próxima abertura.
  let t: NodeJS.Timeout | null = null
  const persist = (): void => {
    if (t) clearTimeout(t)
    t = setTimeout(() => {
      if (win.isDestroyed() || win.isFullScreen() || win.isMinimized()) return
      const b = win.getNormalBounds()
      setSetting('windowBounds', JSON.stringify({ ...b, maximized: win.isMaximized() }))
    }, 400)
  }
  win.on('resize', persist)
  win.on('move', persist)
  win.on('maximize', persist)
  win.on('unmaximize', persist)

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] + (hash ? `#${hash}` : ''))
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), hash ? { hash } : undefined)
  }
  return win
}
