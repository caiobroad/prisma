import { app, Menu, Tray, type BrowserWindow } from 'electron'
import { makeAppIcon } from './icon'

let tray: Tray | null = null

export function createTray(getWindow: () => BrowserWindow | null, onScan: () => void): Tray {
  if (tray) return tray
  tray = new Tray(makeAppIcon(32))
  tray.setToolTip('Prisma')
  const menu = Menu.buildFromTemplate([
    { label: 'Abrir Prisma', click: () => showWindow(getWindow()) },
    { label: 'Sincronizar bibliotecas', click: onScan },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() }
  ])
  tray.setContextMenu(menu)
  tray.on('click', () => showWindow(getWindow()))
  return tray
}

export function showWindow(win: BrowserWindow | null): void {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}
