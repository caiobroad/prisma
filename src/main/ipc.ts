import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { basename } from 'path'
import type { LaunchOptions, MainEvent, ManualGameInput, ScanResult, Settings } from '@shared/types'
import {
  addManualGame,
  allSessions,
  getGame,
  listAchievements,
  listGames,
  listSessions,
  listSources,
  mergeScan,
  recentSessions,
  removeGame,
  removeNotGames,
  toggleFavorite,
  unlockedAchievements,
  updateSource
} from './db/games'
import { runAllScanners } from './scanners'
import { installGame, launchGame } from './launcher'
import { loadSettings, saveSettings } from './settings'
import { onSession } from './sessions'
import { ensureDetails, trailerFor, zoneColorFor } from './meta'
import { windowState } from './window'
import { syncSteamAchievements } from './achievements'
import { monitor } from './monitor'
import { closeHeavyProcesses, launcherMemory } from './perfmode'

export interface WindowHost {
  getWindow(): BrowserWindow | null
  gameStarted(performanceMode: boolean): void
}

let scanning: Promise<ScanResult> | null = null

export function broadcast(ev: MainEvent): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('nexus:event', ev)
  }
}

export function scanLibraries(): Promise<ScanResult> {
  if (scanning) return scanning
  scanning = (async () => {
    const t0 = Date.now()
    broadcast({ type: 'scan:started' })
    const results = await runAllScanners()
    let added = 0
    let updated = 0
    let removed = 0
    for (const [platform, r] of Object.entries(results)) {
      const p = platform as keyof typeof results
      if (p !== 'manual' && r.ok) {
        const m = mergeScan(p, r.games)
        added += m.added
        updated += m.updated
        removed += m.removed + removeNotGames(p, r.notGames ?? [])
      }
      updateSource({ platform: p, count: r.games.length, lastScan: Date.now(), detail: r.detail, ok: r.ok })
    }
    await syncSteamAchievements().catch(() => 0)
    const result: ScanResult = { sources: listSources(), added, updated, removed, durationMs: Date.now() - t0 }
    broadcast({ type: 'scan:finished', result })
    return result
  })().finally(() => {
    scanning = null
  })
  return scanning
}

export function registerIpc(host: WindowHost, onSettings: (s: Settings) => void): void {
  const getWindow = host.getWindow

  ipcMain.handle('games:list', () => listGames())
  ipcMain.handle('games:scan', () => scanLibraries())
  ipcMain.handle('games:launch', async (_e, id: number, opts?: LaunchOptions) => {
    const g = getGame(id)
    if (!g) return { ok: false, message: 'Jogo não encontrado' }
    const perf = !!opts?.performanceMode
    if (perf && g.installed) {
      const closed = await closeHeavyProcesses(loadSettings().heavyProcesses)
      if (closed.length) broadcast({ type: 'perf:closed', names: closed })
    }
    const r = await launchGame(g)
    if (r.ok && r.started) host.gameStarted(perf)
    return r
  })
  ipcMain.handle('games:install', async (_e, id: number) => {
    const g = getGame(id)
    if (!g) return { ok: false, message: 'Jogo não encontrado' }
    return installGame(g)
  })
  ipcMain.handle('games:toggleFavorite', (_e, id: number) => toggleFavorite(id))
  ipcMain.handle('games:remove', (_e, id: number) => {
    removeGame(id)
  })
  ipcMain.handle('games:details', (_e, id: number) => ensureDetails(id))
  ipcMain.handle('games:trailer', (_e, id: number) => trailerFor(id))
  ipcMain.handle('games:zoneColor', (_e, id: number) => zoneColorFor(id))
  ipcMain.handle('games:achievements', (_e, id: number) => listAchievements(id))
  ipcMain.handle('games:addManual', async (_e, input: ManualGameInput) => {
    const icon = await extractIcon(input.exePath)
    const g = addManualGame(input.title.trim() || basename(input.exePath, '.exe'), input.exePath, icon)
    broadcast({ type: 'games:changed' })
    return g
  })
  ipcMain.handle('games:pickExecutable', async () => {
    const win = getWindow()
    const opts: Electron.OpenDialogOptions = {
      title: 'Escolher executável do jogo',
      properties: ['openFile'],
      filters: [
        { name: 'Executáveis e atalhos', extensions: ['exe', 'lnk', 'bat', 'cmd'] },
        { name: 'Todos os arquivos', extensions: ['*'] }
      ]
    }
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (r.canceled || !r.filePaths[0]) return null
    let path = r.filePaths[0]
    if (path.toLowerCase().endsWith('.lnk')) {
      try {
        const link = shell.readShortcutLink(path)
        if (link.target) path = link.target
      } catch {
        /* atalho ilegível: usa o próprio .lnk */
      }
    }
    return { path, title: prettyTitle(basename(path).replace(/\.(exe|lnk|bat|cmd)$/i, '')) }
  })
  ipcMain.handle('games:sessions', (_e, id: number, limit?: number) => listSessions(id, limit))
  ipcMain.handle('games:recentSessions', (_e, limit?: number) => recentSessions(limit))
  ipcMain.handle('games:sources', () => listSources())

  ipcMain.handle('timeline:data', () => ({ sessions: allSessions(), achievements: unlockedAchievements() }))

  // Monitor: cada tela aberta conta como um "observador"; a janela destruída libera os seus.
  const watching = new WeakMap<Electron.WebContents, number>()
  ipcMain.on('perf:watch', (e, on: boolean) => {
    const n = watching.get(e.sender) ?? 0
    if (on) {
      if (n === 0) e.sender.once('destroyed', () => {
        for (let i = 0; i < (watching.get(e.sender) ?? 0); i++) monitor.watch(false)
      })
      watching.set(e.sender, n + 1)
      monitor.watch(true)
    } else if (n > 0) {
      watching.set(e.sender, n - 1)
      monitor.watch(false)
    }
  })
  ipcMain.handle('perf:last', () => monitor.latest())
  monitor.onSample((sample) => {
    const w = getWindow()
    if (w && w.isVisible() && !w.isMinimized()) w.webContents.send('nexus:event', { type: 'perf:sample', sample } satisfies MainEvent)
  })

  ipcMain.handle('settings:get', () => loadSettings())
  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => {
    const s = saveSettings(patch)
    onSettings(s)
    return s
  })

  ipcMain.on('window:minimize', () => getWindow()?.minimize())
  ipcMain.on('window:toggleMaximize', () => {
    const w = getWindow()
    if (!w) return
    if (w.isFullScreen()) w.setFullScreen(false)
    else if (w.isMaximized()) w.unmaximize()
    else w.maximize()
  })
  ipcMain.on('window:toggleFullscreen', () => {
    const w = getWindow()
    if (w) w.setFullScreen(!w.isFullScreen())
  })
  ipcMain.on('window:close', () => getWindow()?.close())
  ipcMain.handle('window:state', () => {
    const w = getWindow()
    return w ? windowState(w) : { maximized: false, fullscreen: false }
  })

  ipcMain.handle('shell:openPath', (_e, p: string) => shell.openPath(p).then(() => undefined))
  ipcMain.on('shell:showInFolder', (_e, p: string) => shell.showItemInFolder(p))

  ipcMain.handle('app:version', () => ({ app: app.getVersion(), electron: process.versions.electron, node: process.versions.node }))
  ipcMain.handle('app:memory', () => launcherMemory())

  onSession((ev) => {
    if (ev.type === 'started') broadcast({ type: 'session:started', gameId: ev.gameId })
    else {
      // Conquistas da sessão que acabou de terminar aparecem na Timeline.
      void syncSteamAchievements([ev.gameId]).finally(() => {
        broadcast({ type: 'session:ended', gameId: ev.gameId, durationSeconds: ev.durationSeconds })
      })
    }
  })
}

async function extractIcon(exePath: string): Promise<string | null> {
  try {
    const img = await app.getFileIcon(exePath, { size: 'large' })
    return img.isEmpty() ? null : img.toDataURL()
  } catch {
    return null
  }
}

function prettyTitle(s: string): string {
  return s
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
