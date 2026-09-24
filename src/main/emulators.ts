import { dialog, type BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { basename, dirname, extname, join } from 'path'
import type { EmuConfig, EmuSystemId, Game } from '@shared/types'
import { EMU_SYSTEMS } from '@shared/types'
import { getSetting, setSetting, syncEmuGames } from './db/games'
import { trackChild } from './sessions'

/**
 * Emuladores de console. O Prisma não emula nada: usa os emuladores que você instalou,
 * encontra os jogos nas pastas de ROMs de cada sistema, abre cada um direto no emulador
 * certo e conta o tempo como qualquer outro jogo. Os saves podem ir para uma pasta de nuvem
 * (OneDrive, Google Drive, Dropbox...): antes de abrir, traz o que for mais novo de lá;
 * ao fechar, manda o que mudou.
 */
interface EmulatorDef {
  id: string
  name: string
  systems: EmuSystemId[]
  /** Nomes de executável para a detecção automática. */
  exes: string[]
  args: (rom: string) => string[]
  /** Pastas de save candidatas (usa a primeira que existir). */
  saves: (exe: string) => string[]
  /** Sincroniza todas as pastas da lista (cada uma numa subpasta da nuvem), em vez da primeira. */
  allSaves?: boolean
}

const DOCS = join(process.env.USERPROFILE ?? '', 'Documents')
const APPDATA = process.env.APPDATA ?? ''

export const EMULATORS: EmulatorDef[] = [
  {
    id: 'duckstation',
    name: 'DuckStation',
    systems: ['ps1'],
    exes: ['duckstation-qt-x64-ReleaseLTCG.exe', 'duckstation-qt.exe'],
    args: (rom) => ['-fullscreen', '--', rom],
    saves: (exe) => [join(DOCS, 'DuckStation', 'memcards'), join(dirname(exe), 'memcards')]
  },
  {
    id: 'pcsx2',
    name: 'PCSX2',
    systems: ['ps2'],
    exes: ['pcsx2-qt.exe', 'pcsx2-qtx64.exe', 'pcsx2-qtx64-avx2.exe'],
    args: (rom) => ['-batch', '-fullscreen', '--', rom],
    saves: (exe) => [join(DOCS, 'PCSX2', 'memcards'), join(dirname(exe), 'memcards')]
  },
  {
    id: 'ppsspp',
    name: 'PPSSPP',
    systems: ['psp'],
    exes: ['PPSSPPWindows64.exe', 'PPSSPPWindows.exe'],
    args: (rom) => ['--fullscreen', rom],
    saves: (exe) => [join(DOCS, 'PPSSPP', 'PSP', 'SAVEDATA'), join(dirname(exe), 'memstick', 'PSP', 'SAVEDATA')]
  },
  {
    id: 'dolphin',
    name: 'Dolphin',
    systems: ['gc', 'wii'],
    exes: ['Dolphin.exe'],
    args: (rom) => ['-b', '-e', rom],
    // Só os saves: GC (cartões de memória) e Wii/title (dados dos jogos). Config e caches ficam de fora.
    saves: () => [join(DOCS, 'Dolphin Emulator', 'GC'), join(DOCS, 'Dolphin Emulator', 'Wii', 'title')],
    allSaves: true
  },
  {
    id: 'ryujinx',
    name: 'Ryujinx',
    systems: ['switch'],
    exes: ['Ryujinx.exe'],
    args: (rom) => ['--fullscreen', rom],
    saves: () => [join(APPDATA, 'Ryujinx', 'bis', 'user', 'save')]
  },
  {
    id: 'mgba',
    name: 'mGBA',
    systems: ['gba'],
    exes: ['mGBA.exe'],
    args: (rom) => ['-f', rom],
    // O mGBA grava o .sav ao lado da ROM: a sincronização cuida só desses arquivos.
    saves: () => []
  }
]

export function emulatorFor(system: EmuSystemId): EmulatorDef | undefined {
  return EMULATORS.find((e) => e.systems.includes(system))
}

// ---------- configuração (da máquina, não do perfil) ----------

const EMPTY: EmuConfig = { exes: {}, romDirs: {}, cloudDir: null, cloudSync: true }

export function loadEmuConfig(): EmuConfig {
  try {
    return { ...EMPTY, ...(JSON.parse(getSetting('emulators') ?? '{}') as Partial<EmuConfig>) }
  } catch {
    return { ...EMPTY }
  }
}

export function saveEmuConfig(patch: Partial<EmuConfig>): EmuConfig {
  const cur = loadEmuConfig()
  const next: EmuConfig = {
    ...cur,
    ...patch,
    exes: { ...cur.exes, ...(patch.exes ?? {}) },
    romDirs: { ...cur.romDirs, ...(patch.romDirs ?? {}) }
  }
  setSetting('emulators', JSON.stringify(next))
  return next
}

/** Procura os emuladores nos lugares de instalação mais comuns (sem varrer o disco todo). */
export function detectEmulators(): EmuConfig {
  const roots = [
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
    join(process.env.LOCALAPPDATA ?? '', 'Programs'),
    join(process.env.USERPROFILE ?? '', 'scoop', 'apps'),
    join(process.env.USERPROFILE ?? '', 'Emulators'),
    join(process.env.USERPROFILE ?? '', 'Desktop'),
    join(process.env.USERPROFILE ?? '', 'Downloads'),
    'C:\\Emulators',
    'C:\\Emuladores',
    'D:\\Emulators',
    'D:\\Emuladores'
  ].filter((r): r is string => !!r && existsSync(r))
  const found: Record<string, string> = {}
  const cur = loadEmuConfig()
  for (const emu of EMULATORS) {
    if (cur.exes[emu.id] && existsSync(cur.exes[emu.id])) continue
    const hit = findExe(roots, emu.exes, 3)
    if (hit) found[emu.id] = hit
  }
  return Object.keys(found).length ? saveEmuConfig({ exes: found }) : cur
}

function findExe(roots: string[], names: string[], depth: number): string | null {
  const want = new Set(names.map((n) => n.toLowerCase()))
  const walk = (dir: string, d: number): string | null => {
    let entries: import('fs').Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return null
    }
    for (const e of entries) if (e.isFile() && want.has(e.name.toLowerCase())) return join(dir, e.name)
    if (d <= 0) return null
    for (const e of entries) {
      if (!e.isDirectory() || /^(windows|\$|node_modules|steamapps|epic games)/i.test(e.name)) continue
      const r = walk(join(dir, e.name), d - 1)
      if (r) return r
    }
    return null
  }
  for (const r of roots) {
    const hit = walk(r, depth)
    if (hit) return hit
  }
  return null
}

export async function pickEmuPath(win: BrowserWindow | null, what: 'exe' | 'dir', title: string): Promise<string | null> {
  const opts: Electron.OpenDialogOptions =
    what === 'exe'
      ? { title, properties: ['openFile'], filters: [{ name: 'Programas', extensions: ['exe'] }] }
      : { title, properties: ['openDirectory'] }
  const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  return r.canceled || !r.filePaths[0] ? null : r.filePaths[0]
}

/** Pasta de nuvem sugerida: OneDrive, Google Drive ou Dropbox, se existirem. */
export function suggestCloudDir(): string | null {
  const home = process.env.USERPROFILE ?? ''
  const cands = [process.env.OneDrive, join(home, 'OneDrive'), 'G:\\Meu Drive', 'G:\\My Drive', join(home, 'Google Drive'), join(home, 'Dropbox')]
  const base = cands.find((c) => c && existsSync(c))
  return base ? join(base, 'Prisma Saves') : null
}

// ---------- varredura das ROMs ----------

/** Nome limpo a partir do arquivo: tira extensão, região e marcas como (USA), [!], (Rev 1). */
function cleanTitle(file: string): string {
  return basename(file, extname(file))
    .replace(/\s*[([][^)\]]*[)\]]/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Capa e imagem do repositório de miniaturas do Libretro (nomes no padrão Redump/No-Intro). */
function thumb(system: EmuSystemId, file: string, kind: 'Named_Boxarts' | 'Named_Snaps'): string | null {
  const folder = EMU_SYSTEMS[system].libretro
  if (!folder) return null
  const name = basename(file, extname(file)).replace(/[&*/:`<>?\\|"]/g, '_')
  return `https://thumbnails.libretro.com/${encodeURIComponent(folder)}/${kind}/${encodeURIComponent(name)}.png`
}

export interface EmuRom {
  system: EmuSystemId
  path: string
  title: string
  cover: string | null
  banner: string | null
  size: number
}

export function scanRoms(): EmuRom[] {
  const cfg = loadEmuConfig()
  const out: EmuRom[] = []
  for (const [sys, dir] of Object.entries(cfg.romDirs) as Array<[EmuSystemId, string]>) {
    if (!dir || !existsSync(dir)) continue
    const exts = new Set(EMU_SYSTEMS[sys].ext)
    const seenBase = new Set<string>()
    const walk = (d: string, depth: number): void => {
      let entries: import('fs').Dirent[]
      try {
        entries = readdirSync(d, { withFileTypes: true })
      } catch {
        return
      }
      for (const e of entries) {
        const p = join(d, e.name)
        if (e.isDirectory() && depth > 0) walk(p, depth - 1)
        else if (e.isFile() && exts.has(extname(e.name).toLowerCase())) {
          // Jogo em vários arquivos (.cue + .bin): fica só um por nome.
          const key = basename(e.name, extname(e.name)).toLowerCase()
          if (seenBase.has(key)) continue
          seenBase.add(key)
          let size = 0
          try {
            size = statSync(p).size
          } catch {
            /* sem acesso */
          }
          out.push({ system: sys, path: p, title: cleanTitle(e.name), cover: thumb(sys, e.name, 'Named_Boxarts'), banner: thumb(sys, e.name, 'Named_Snaps'), size })
        }
      }
    }
    walk(dir, 2)
  }
  return out
}

/** Atualiza a biblioteca com as ROMs encontradas. Devolve [encontradas, removidas]. */
export function refreshEmuGames(): [number, number] {
  const roms = scanRoms()
  return syncEmuGames(roms)
}

// ---------- lançamento e saves na nuvem ----------

export async function launchEmulated(game: Game): Promise<{ ok: boolean; message: string; started?: boolean }> {
  const sys = game.emuSystem
  if (!sys) return { ok: false, message: 'Jogo sem sistema de emulação' }
  const emu = emulatorFor(sys)
  const cfg = loadEmuConfig()
  const exe = emu ? cfg.exes[emu.id] : undefined
  if (!emu || !exe || !existsSync(exe)) {
    return { ok: false, message: `Configure o ${emu?.name ?? 'emulador'} em Ajustes → Emuladores para jogar ${EMU_SYSTEMS[sys].label}` }
  }
  const rom = game.exePath
  if (!rom || !existsSync(rom)) return { ok: false, message: 'Arquivo do jogo não encontrado. A pasta de ROMs mudou?' }
  syncSaves(game, 'pull')
  const child = spawn(exe, emu.args(rom), { cwd: dirname(exe), detached: false, stdio: 'ignore', windowsHide: false })
  trackChild(game, child)
  return { ok: true, started: true, message: `${game.title} aberto no ${emu.name}` }
}

/** Copia os arquivos de src para dst quando são novos ou mais recentes (2 s de tolerância). */
function mirrorNewer(src: string, dst: string, filter?: (name: string) => boolean, depth = 6): number {
  if (!existsSync(src)) return 0
  let n = 0
  let entries: import('fs').Dirent[]
  try {
    entries = readdirSync(src, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const e of entries) {
    const s = join(src, e.name)
    const d = join(dst, e.name)
    if (e.isDirectory()) {
      if (depth > 0) n += mirrorNewer(s, d, filter, depth - 1)
      continue
    }
    if (!e.isFile() || (filter && !filter(e.name))) continue
    try {
      const sm = statSync(s).mtimeMs
      const dm = existsSync(d) ? statSync(d).mtimeMs : 0
      if (sm > dm + 2000) {
        mkdirSync(dirname(d), { recursive: true })
        copyFileSync(s, d)
        n++
      }
    } catch {
      /* arquivo em uso: fica para a próxima */
    }
  }
  return n
}

/** pull: nuvem → PC antes de jogar; push: PC → nuvem depois de jogar. */
export function syncSaves(game: Game, dir: 'pull' | 'push'): number {
  const cfg = loadEmuConfig()
  const sys = game.emuSystem
  if (!sys || !cfg.cloudSync || !cfg.cloudDir) return 0
  const emu = emulatorFor(sys)
  const exe = emu ? cfg.exes[emu.id] : undefined
  if (!emu) return 0
  const cloud = join(cfg.cloudDir, emu.id)
  try {
    if (emu.id === 'mgba') {
      const romDir = game.exePath ? dirname(game.exePath) : null
      if (!romDir) return 0
      const isSave = (n: string): boolean => /\.(sav|srm|ss\d)$/i.test(n)
      return dir === 'pull' ? mirrorNewer(cloud, romDir, isSave, 0) : mirrorNewer(romDir, cloud, isSave, 0)
    }
    if (!exe) return 0
    const dirs = emu.allSaves ? emu.saves(exe) : [emu.saves(exe).find((p) => existsSync(p)) ?? emu.saves(exe)[0]]
    let n = 0
    for (const local of dirs) {
      const remote = emu.allSaves ? join(cloud, basename(local)) : cloud
      n += dir === 'pull' ? mirrorNewer(remote, local) : mirrorNewer(local, remote)
    }
    return n
  } catch {
    return 0
  }
}
