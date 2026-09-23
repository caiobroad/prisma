import { app, BrowserWindow, globalShortcut, protocol, net } from 'electron'
import { pathToFileURL } from 'url'
import { createMainWindow } from './window'
import { createTray, showWindow } from './tray'
import { broadcast, registerIpc, scanLibraries, type WindowHost } from './ipc'
import { closeDb } from './db'
import { closeDanglingSessions } from './db/games'
import { applySystemSettings, loadSettings } from './settings'
import { anyRunning, finishAll, onSession } from './sessions'
import { monitor } from './monitor'
import { setLauncherPriority } from './perfmode'
import type { Settings } from '@shared/types'


// Orçamento de memória da GPU do launcher: o Chromium dimensiona caches de textura e de
// imagens decodificadas pela VRAM disponível (6 GB numa RTX = cache enorme). Um launcher
// não precisa disso; com estes limites ele devolve memória em vez de acumular.
app.commandLine.appendSwitch('force-gpu-mem-available-mb', '384')
app.commandLine.appendSwitch('force-gpu-mem-discardable-limit-mb', '96')

let mainWindow: BrowserWindow | null = null
let quitting = false
let scanTimer: NodeJS.Timeout | null = null
let hibernateTimer: NodeJS.Timeout | null = null
let currentShortcut = ''
/** Janela destruída para liberar memória; recriada ao voltar. */
let hibernated = false
/** O que fazer quando o jogo fechar. */
let gameMode: 'none' | 'minimized' | 'hibernated' = 'none'

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showMain())
}

protocol.registerSchemesAsPrivileged([{ scheme: 'cover', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true, stream: true } }])

function ensureWindow(opts: { hidden?: boolean; returning?: boolean } = {}): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow
  hibernated = false
  const win = createMainWindow(!!opts.hidden, (state) => broadcast({ type: 'window:state', state }), opts.returning ? 'return' : undefined)
  win.on('close', (e) => {
    if (!quitting && loadSettings().minimizeToTray) {
      e.preventDefault()
      win.hide()
    }
  })
  win.on('hide', () => scheduleHibernate())
  win.on('show', () => cancelHibernate())
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })
  mainWindow = win
  return win
}

function showMain(): void {
  const w = ensureWindow()
  showWindow(w)
}

/** Destrói a janela (o renderer é o que mais consome memória). Bandeja, sessões e monitor seguem vivos. */
function hibernate(): void {
  cancelHibernate()
  if (!mainWindow || mainWindow.isDestroyed()) return
  hibernated = true
  const w = mainWindow
  mainWindow = null
  w.destroy()
}

/** Escondida na bandeja por 3 minutos: libera a memória do renderer. */
function scheduleHibernate(): void {
  cancelHibernate()
  hibernateTimer = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) hibernate()
  }, 3 * 60_000)
}

function cancelHibernate(): void {
  if (hibernateTimer) clearTimeout(hibernateTimer)
  hibernateTimer = null
}

const host: WindowHost = {
  getWindow: () => (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null),
  gameStarted(performanceMode) {
    if (performanceMode) {
      gameMode = 'hibernated'
      setLauncherPriority(true)
      // Deixa a animação de saída terminar antes de liberar a memória.
      setTimeout(() => {
        if (anyRunning() || gameMode === 'hibernated') hibernate()
      }, 2500)
    } else {
      gameMode = 'minimized'
      setTimeout(() => mainWindow?.minimize(), 700)
    }
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId('app.prisma.launcher')

  protocol.handle('cover', (req) => {
    const p = decodeURIComponent(req.url.replace(/^cover:\/\/(local\/)?/, ''))
    return net.fetch(pathToFileURL(p).toString())
  })

  closeDanglingSessions()
  const settings = loadSettings()
  applySystemSettings(settings)
  monitor.setPresentMon(settings.presentMonPath)

  ensureWindow({ hidden: process.argv.includes('--hidden') })

  registerIpc(host, (s) => applyRuntimeSettings(s))
  createTray(
    () => ensureWindow(),
    () => void scanLibraries()
  )
  applyRuntimeSettings(settings)

  // Jogo fechou: volta ao launcher com a transição de retorno.
  onSession((ev) => {
    if (ev.type !== 'ended' || anyRunning()) return
    setLauncherPriority(false)
    if (gameMode === 'hibernated' || hibernated) {
      const w = ensureWindow({ returning: true })
      w.once('ready-to-show', () => showWindow(w))
    } else if (gameMode === 'minimized' && mainWindow?.isMinimized()) {
      showWindow(mainWindow)
    }
    gameMode = 'none'
  })

  if (settings.syncOnOpen) void scanLibraries()
  scanTimer = setInterval(() => {
    if (!anyRunning()) void scanLibraries()
  }, 30 * 60 * 1000)

  app.on('activate', () => showMain())
})

function applyRuntimeSettings(s: Settings): void {
  monitor.setPresentMon(s.presentMonPath)
  if (s.globalShortcut !== currentShortcut) {
    if (currentShortcut) globalShortcut.unregister(currentShortcut)
    currentShortcut = ''
    if (s.globalShortcut) {
      try {
        if (globalShortcut.register(s.globalShortcut, () => toggleWindow())) currentShortcut = s.globalShortcut
      } catch {
        /* combinação inválida ou ocupada */
      }
    }
  }
}

function toggleWindow(): void {
  if (mainWindow && mainWindow.isVisible() && mainWindow.isFocused()) mainWindow.hide()
  else showMain()
}

app.on('before-quit', () => {
  quitting = true
})

app.on('will-quit', () => {
  if (scanTimer) clearInterval(scanTimer)
  cancelHibernate()
  globalShortcut.unregisterAll()
  finishAll()
  monitor.stopAll()
  closeDb()
})

app.on('window-all-closed', () => {
  // Continua residente na bandeja (inclusive com a janela hibernada).
  if (!loadSettings().minimizeToTray && !hibernated) app.quit()
})
