import { app, BrowserWindow, clipboard, ClipboardItem, dialog, ipcMain, shell } from 'electron'
import { writeFile } from 'fs/promises'
import os from 'os'
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
  lastResume,
  profileStats,
  setCompleted,
  toggleFavorite,
  unlockedAchievements,
  updateSource
} from './db/games'
import { runAllScanners } from './scanners'
import { dbRecovery } from './db'
import { installGame, launchGame } from './launcher'
import { loadSettings, saveSettings } from './settings'
import { onSession } from './sessions'
import { ensureDetails, trailerFor, zoneColorFor } from './meta'
import { windowState } from './window'
import { syncSteamAchievements } from './achievements'
import { monitor } from './monitor'
import { closeHeavyProcesses, launcherMemory } from './perfmode'
import { activeProfileId, createProfile, getProfile, listProfiles, needsPick, pickImage, removeProfile, selectProfile, updateProfile } from './profiles'
import { communityFor } from './community'
import { friendLibrary, listFriends, myLibrary, tagsFor } from './steamWeb'
import { startEnrichment } from './enrich'
import { pruneResume, resumeEnded, resumeStarted } from './resume'
import { testAchievementPopup, unwatchAchievements, watchAchievements } from './notifier'
import { changelog, checkNow, getUpdateStatus, installNow, openPortableDownload } from './updater'
import { loadStore, searchStore } from './storefront'
import { reviewsFor, workshopFor } from './steamExtra'
import { detectEmulators, EMULATORS, loadEmuConfig, pickEmuPath, refreshEmuGames, saveEmuConfig, suggestCloudDir, syncSaves } from './emulators'
import { emuCounts, lastPlayedGameId, saveApiOwned, saveSteamOwners, steamOwnershipInfo } from './db/games'
import { apiOwnedGames, listSteamAccounts } from './steamAccounts'
import { CDN as STEAM_CDN } from './scanners/steam'
import type { DetectedGame } from './scanners'

export interface WindowHost {
  getWindow(): BrowserWindow | null
  gameStarted(performanceMode: boolean): void
  /** Marca que o app vai fechar de verdade (não só esconder na bandeja). */
  prepareQuit(): void
}

let scanning: Promise<ScanResult> | null = null

export function broadcast(ev: MainEvent): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('nexus:event', ev)
  }
}

/** Conta Steam do perfil ativo (null = perfil antigo, vê tudo; '' = sem Steam). */
export function currentSteamAccount(): string | null {
  const id = activeProfileId()
  return id == null ? null : (getProfile(id)?.steamAccount ?? null)
}

function apiGame(g: { appid: string; name: string; icon: string | null }): DetectedGame {
  return {
    platform: 'steam',
    platformId: g.appid,
    title: g.name,
    installDir: null,
    exePath: null,
    launchUri: `steam://rungameid/${g.appid}`,
    coverUrl: `${STEAM_CDN}/${g.appid}/library_600x900.jpg`,
    bannerUrl: `${STEAM_CDN}/${g.appid}/library_hero.jpg`,
    logoUrl: `${STEAM_CDN}/${g.appid}/logo.png`,
    iconUrl: g.icon,
    installed: false
  }
}

export function scanLibraries(): Promise<ScanResult> {
  if (scanning) return scanning
  scanning = (async () => {
    const t0 = Date.now()
    broadcast({ type: 'scan:started' })
    const [results, api] = await Promise.all([runAllScanners(), apiOwnedGames().catch(() => [])])
    let added = 0
    let updated = 0
    let removed = 0
    const steam = results.steam
    if (steam?.ok) {
      // Jogos que só a Steam Web API conhece (nunca jogados nem instalados neste PC).
      const seen = new Set(steam.games.map((g) => g.platformId))
      for (const a of api) {
        for (const g of a.games) {
          if (seen.has(g.appid)) continue
          seen.add(g.appid)
          steam.games.push(apiGame(g))
        }
        saveApiOwned(a.account, a.games)
      }
      saveSteamOwners(steam.owners ?? [])
    }
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
    await syncSteamAchievements(undefined, currentSteamAccount()).catch(() => 0)
    try {
      const [ea, er] = refreshEmuGames()
      added += ea
      removed += er
    } catch {
      /* pastas de ROMs inacessíveis */
    }
    startEnrichment(
      (done, total) => broadcast({ type: 'enrich:progress', done, total }),
      () => broadcast({ type: 'games:changed' })
    )
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

  ipcMain.handle('games:list', () => listGames(currentSteamAccount()))
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
  ipcMain.handle('games:setCompleted', (_e, id: number, v: boolean) => setCompleted(id, v))
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
  ipcMain.handle('games:sessions', (_e, id: number, limit?: number) => listSessions(id, limit ?? 20, activeProfileId()))
  ipcMain.handle('games:recentSessions', (_e, limit?: number) => recentSessions(limit ?? 12, activeProfileId()))
  ipcMain.handle('games:resume', (_e, id: number) => lastResume(id, activeProfileId()))
  ipcMain.handle('games:community', (_e, id: number) => communityFor(id))
  ipcMain.handle('games:sources', () => listSources())

  ipcMain.handle('timeline:data', () => ({ sessions: allSessions(activeProfileId()), achievements: unlockedAchievements() }))

  ipcMain.handle('profiles:list', () => listProfiles())
  ipcMain.handle('profiles:needsPick', () => needsPick())
  ipcMain.handle('profiles:active', () => {
    const id = activeProfileId()
    return id == null ? null : getProfile(id)
  })
  ipcMain.handle('profiles:select', (_e, id: number) => {
    const before = currentSteamAccount()
    selectProfile(id)
    const s = loadSettings()
    onSettings(s)
    // Outra conta Steam: as conquistas lidas do disco passam a ser as dela.
    if (currentSteamAccount() !== before) void syncSteamAchievements(undefined, currentSteamAccount()).then(() => broadcast({ type: 'games:changed' }))
    return s
  })
  ipcMain.handle('profiles:create', (_e, nickname: string, steamAccount?: string) => createProfile(nickname, steamAccount ?? ''))
  ipcMain.handle('profiles:update', (_e, id: number, patch: Parameters<typeof updateProfile>[1]) => {
    const p = updateProfile(id, patch)
    if (patch.steamAccount !== undefined && id === activeProfileId()) {
      void syncSteamAchievements(undefined, currentSteamAccount()).then(() => broadcast({ type: 'games:changed' }))
      if (p.steamAccount) void scanLibraries()
    }
    return p
  })
  ipcMain.handle('profiles:remove', (_e, id: number) => removeProfile(id))
  ipcMain.handle('profiles:stats', (_e, id: number) => {
    const p = getProfile(id)
    return profileStats(id, !!p?.steamLinked, 12, p?.steamAccount ?? null)
  })
  ipcMain.handle('steam:accounts', () => listSteamAccounts())
  ipcMain.handle('steam:libraryInfo', async () => {
    const account = currentSteamAccount()
    if (account === '') return null
    const all = await listSteamAccounts()
    // Perfil de antes da escolha de conta: vê todas; o aviso pede para escolher.
    if (account == null) return { account: null, multi: all.length > 1, complete: false, known: 0, unset: true }
    const info = steamOwnershipInfo(account)
    const acc = all.find((a) => a.accountId === account) ?? null
    return { account: acc, multi: info.accounts > 1, complete: info.complete, known: info.known, unset: false }
  })
  ipcMain.handle('profiles:pickImage', (_e, kind: 'avatar' | 'banner') => pickImage(getWindow(), kind))

  ipcMain.handle('friends:list', () => listFriends())
  ipcMain.handle('friends:library', (_e, id: string) => friendLibrary(id))
  ipcMain.handle('friends:myLibrary', () => myLibrary())
  ipcMain.handle('tags:for', (_e, appids: string[]) => tagsFor(appids))

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
    const keyChanged = patch.steamApiKey !== undefined && patch.steamApiKey !== loadSettings().steamApiKey
    const s = saveSettings(patch)
    onSettings(s)
    // Chave nova da Steam Web API: busca a lista completa de jogos da conta.
    if (keyChanged && s.steamApiKey) void scanLibraries()
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
  ipcMain.on('shell:openExternal', (_e, url: string) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url)
  })
  ipcMain.handle('shell:saveImage', async (_e, dataUrl: string, name: string) => {
    const win = getWindow()
    const opts: Electron.SaveDialogOptions = {
      title: 'Salvar imagem',
      defaultPath: name.replace(/[\\/:*?"<>|]+/g, '') + '.png',
      filters: [{ name: 'PNG', extensions: ['png'] }]
    }
    const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (r.canceled || !r.filePath) return false
    await writeFile(r.filePath, Buffer.from(dataUrl.split(',')[1] ?? '', 'base64'))
    return true
  })
  ipcMain.on('shell:copyImage', (_e, dataUrl: string) => {
    const png = new Blob([Buffer.from(dataUrl.split(',')[1] ?? '', 'base64')], { type: 'image/png' })
    void clipboard.write([new ClipboardItem({ 'image/png': png })]).catch(() => undefined)
  })
  ipcMain.on('achievement:test', () => testAchievementPopup())
  ipcMain.handle('update:status', () => getUpdateStatus())
  ipcMain.handle('update:changelog', (_e, v: string) => changelog(v))
  ipcMain.handle('store:load', (_e, force?: boolean) => loadStore(!!force))
  ipcMain.handle('store:search', (_e, term: string) => searchStore(term))
  ipcMain.handle('games:reviews', (_e, id: number) => reviewsFor(id))
  ipcMain.handle('games:workshop', (_e, id: number) => workshopFor(id))
  ipcMain.handle('games:lastPlayed', () => {
    const id = lastPlayedGameId(currentSteamAccount())
    return id == null ? null : { gameId: id, resume: lastResume(id, activeProfileId()) }
  })
  const emuInfo = () => ({
    config: loadEmuConfig(),
    emulators: EMULATORS.map((e) => ({ id: e.id, name: e.name, systems: e.systems })),
    counts: emuCounts(),
    suggestedCloud: suggestCloudDir()
  })
  const emuChanged = (): void => {
    refreshEmuGames()
    broadcast({ type: 'games:changed' })
  }
  ipcMain.handle('emulators:info', () => emuInfo())
  ipcMain.handle('emulators:set', (_e, patch: Parameters<typeof saveEmuConfig>[0]) => {
    saveEmuConfig(patch)
    emuChanged()
    return emuInfo()
  })
  ipcMain.handle('emulators:detect', () => {
    detectEmulators()
    return emuInfo()
  })
  ipcMain.handle('emulators:pick', async (_e, kind: 'exe' | 'dir', target: string) => {
    const title = kind === 'exe' ? `Escolher o executável do ${EMULATORS.find((e) => e.id === target)?.name ?? 'emulador'}` : target === 'cloud' ? 'Escolher a pasta da nuvem para os saves' : 'Escolher a pasta dos jogos'
    const p = await pickEmuPath(getWindow(), kind, title)
    if (p) {
      if (kind === 'exe') saveEmuConfig({ exes: { [target]: p } })
      else if (target === 'cloud') saveEmuConfig({ cloudDir: p })
      else saveEmuConfig({ romDirs: { [target]: p } })
      emuChanged()
    }
    return emuInfo()
  })
  ipcMain.handle('emulators:rescan', () => {
    const [found, removed] = refreshEmuGames()
    broadcast({ type: 'games:changed' })
    return { found, removed }
  })
  ipcMain.handle('update:check', () => checkNow())
  ipcMain.handle('update:install', () => installNow(host.prepareQuit))
  ipcMain.on('update:openDownload', () => openPortableDownload())
  ipcMain.handle('app:dbRecovery', () => {
    const r = dbRecovery
    return r ? { restored: !!r.restoredFrom, when: r.restoredFrom ? r.restoredFrom.replace(/^.*prisma-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2}).*$/, '$3/$2 $4:$5') : null } : null
  })
  ipcMain.handle('app:system', () => ({ ramGb: Math.round(os.totalmem() / 1024 ** 3) }))

  ipcMain.handle('app:version', () => ({ app: app.getVersion(), electron: process.versions.electron, node: process.versions.node }))
  ipcMain.handle('app:memory', () => launcherMemory())

  onSession((ev) => {
    if (ev.type === 'started') {
      broadcast({ type: 'session:started', gameId: ev.gameId })
      resumeStarted(ev.sessionId)
      void syncSteamAchievements([ev.gameId], currentSteamAccount()).finally(() =>
        watchAchievements(ev.game, (achievement) => broadcast({ type: 'achievement:unlocked', achievement, gameTitle: ev.game.title }))
      )
    } else {
      unwatchAchievements(ev.gameId)
      // Jogo de emulador: manda os saves novos para a pasta da nuvem.
      if (ev.game.emuSystem) syncSaves(ev.game, 'push')
      // Conquistas e screenshot da sessão que acabou de terminar: Timeline e Smart Resume.
      void Promise.all([syncSteamAchievements([ev.gameId], currentSteamAccount()).catch(() => 0), resumeEnded(ev.sessionId, ev.game, ev.startedAt)]).finally(() => {
        broadcast({ type: 'session:ended', gameId: ev.gameId, durationSeconds: ev.durationSeconds })
      })
    }
  })

  pruneResume()
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
