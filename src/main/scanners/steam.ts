import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { regQuery } from '../util/exec'
import { parseVdf, vdfGet, type VdfObject } from '../util/vdf'
import { readAppInfo, kvObj, kvStr, type KV } from '../util/appinfo'
import { localAsset, type DetectedGame, type Scanner, type ScannerOutput } from './types'

/** Gêneros da Steam (ids do appinfo) traduzidos. */
const GENRES: Record<string, string> = {
  '1': 'Ação',
  '2': 'Estratégia',
  '3': 'RPG',
  '4': 'Casual',
  '9': 'Corrida',
  '18': 'Esportes',
  '23': 'Indie',
  '25': 'Aventura',
  '28': 'Simulação',
  '29': 'MMO',
  '37': 'Gratuito para jogar',
  '70': 'Acesso antecipado'
}

const CDN = 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps'

export async function findSteamPath(): Promise<string | null> {
  const candidates = [
    await regQuery('HKCU\\Software\\Valve\\Steam', 'SteamPath'),
    await regQuery('HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'),
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam'
  ]
  for (const c of candidates) {
    if (c && existsSync(join(c, 'steamapps'))) return c.replace(/\//g, '\\')
  }
  return null
}

export function libraryFolders(steamPath: string): string[] {
  const file = join(steamPath, 'steamapps', 'libraryfolders.vdf')
  const dirs = new Set<string>([steamPath])
  if (!existsSync(file)) return [...dirs]
  try {
    const root = parseVdf(readFileSync(file, 'utf8'))
    const lib = (vdfGet(root, 'libraryfolders') ?? root) as VdfObject
    for (const key of Object.keys(lib)) {
      const entry = lib[key]
      if (typeof entry === 'string') {
        if (/^\d+$/.test(key)) dirs.add(entry)
      } else {
        const p = vdfGet(entry, 'path')
        if (typeof p === 'string') dirs.add(p)
      }
    }
  } catch {
    /* arquivo corrompido: fica só com a pasta principal */
  }
  return [...dirs].map((d) => d.replace(/\\\\/g, '\\'))
}

interface Installed {
  name: string
  dir: string | null
  installed: boolean
  size: number | null
}

function installedApps(steamPath: string): { apps: Map<string, Installed>; libs: number } {
  const apps = new Map<string, Installed>()
  let libs = 0
  for (const lib of libraryFolders(steamPath)) {
    const sa = join(lib, 'steamapps')
    if (!existsSync(sa)) continue
    libs++
    let files: string[] = []
    try {
      files = readdirSync(sa).filter((f) => /^appmanifest_\d+\.acf$/i.test(f))
    } catch {
      continue
    }
    for (const f of files) {
      try {
        const m = parseVdf(readFileSync(join(sa, f), 'utf8'))
        const st = (vdfGet(m, 'AppState') ?? m) as VdfObject
        const appid = String(vdfGet(st, 'appid') ?? f.match(/\d+/)?.[0] ?? '')
        const name = String(vdfGet(st, 'name') ?? '')
        const dir = join(sa, 'common', String(vdfGet(st, 'installdir') ?? ''))
        const flags = Number(vdfGet(st, 'StateFlags') ?? 0)
        if (!appid || apps.has(appid)) continue
        const exists = existsSync(dir)
        const size = Number(vdfGet(st, 'SizeOnDisk') ?? 0)
        apps.set(appid, { name, dir: exists ? dir : null, installed: (flags & 4) === 4 && exists, size: size > 0 ? size : null })
      } catch {
        /* manifesto ilegível */
      }
    }
  }
  return { apps, libs }
}

/** Arquivos do librarycache por appid: formato novo (pasta por app, com subpastas por hash) e antigo (arquivos soltos). */
function libraryCache(steamPath: string): Map<string, Map<string, string>> {
  const root = join(steamPath, 'appcache', 'librarycache')
  const out = new Map<string, Map<string, string>>()
  let entries: string[] = []
  try {
    entries = readdirSync(root)
  } catch {
    return out
  }
  const add = (id: string, name: string, full: string): void => {
    let m = out.get(id)
    if (!m) out.set(id, (m = new Map()))
    if (!m.has(name)) m.set(name, full)
  }
  for (const e of entries) {
    const full = join(root, e)
    if (/^\d+$/.test(e)) {
      try {
        if (!statSync(full).isDirectory()) continue
        for (const f of readdirSync(full)) {
          const p = join(full, f)
          if (/\.(jpg|png|jpeg)$/i.test(f)) add(e, f, p)
          else if (statSync(p).isDirectory()) for (const g of readdirSync(p)) add(e, g, join(p, g))
        }
        if (!out.has(e)) out.set(e, new Map())
      } catch {
        /* pasta inacessível */
      }
    } else {
      const m = e.match(/^(\d+)_(.+)$/)
      if (m) add(m[1], m[2], full)
    }
  }
  return out
}

interface LocalStats {
  playtimeMin: number
  lastPlayed: number
}

/** Tempo de jogo e última sessão por app, somando todos os usuários logados nesta máquina. */
function localConfig(steamPath: string): Map<string, LocalStats> {
  const out = new Map<string, LocalStats>()
  const userdata = join(steamPath, 'userdata')
  let users: string[] = []
  try {
    users = readdirSync(userdata)
  } catch {
    return out
  }
  for (const u of users) {
    const f = join(userdata, u, 'config', 'localconfig.vdf')
    if (!existsSync(f)) continue
    try {
      const root = parseVdf(readFileSync(f, 'utf8'))
      const store = (vdfGet(root, 'UserLocalConfigStore') ?? root) as VdfObject
      const sw = vdfGet(store, 'Software') as VdfObject | undefined
      const valve = vdfGet(sw, 'Valve') as VdfObject | undefined
      const steam = vdfGet(valve, 'Steam') as VdfObject | undefined
      const apps = vdfGet(steam, 'apps') as VdfObject | undefined
      if (!apps) continue
      for (const [id, v] of Object.entries(apps)) {
        if (!/^\d+$/.test(id) || typeof v !== 'object') continue
        const pt = Number(vdfGet(v, 'Playtime') ?? 0)
        const lp = Number(vdfGet(v, 'LastPlayed') ?? 0)
        const prev = out.get(id)
        out.set(id, {
          playtimeMin: Math.max(prev?.playtimeMin ?? 0, pt),
          lastPlayed: Math.max(prev?.lastPlayed ?? 0, lp)
        })
      }
    } catch {
      /* localconfig ilegível */
    }
  }
  return out
}

function assetPath(common: KV | undefined, key: string, variant: 'image' | 'image2x' = 'image'): string | undefined {
  const full = kvObj(kvObj(common?.library_assets_full)?.[key])
  const img = kvObj(full?.[variant]) ?? kvObj(full?.image)
  return kvStr(img?.english) ?? kvStr(img ? Object.values(img)[0] : undefined)
}

export const steamScanner: Scanner = {
  platform: 'steam',
  async scan(): Promise<ScannerOutput> {
    const steamPath = await findSteamPath()
    if (!steamPath) return { games: [], ok: false, detail: 'Steam não encontrada' }

    const { apps: installed, libs } = installedApps(steamPath)
    const cache = libraryCache(steamPath)
    const local = localConfig(steamPath)

    // Candidatos: tudo que está instalado, no cache da biblioteca ou no histórico local.
    const candidates = new Set<string>([...installed.keys(), ...cache.keys(), ...local.keys()])
    const info = readAppInfo(join(steamPath, 'appcache', 'appinfo.vdf'), (id) => candidates.has(id))

    const games: DetectedGame[] = []
    const notGames: string[] = []
    for (const id of candidates) {
      const app = info.get(id)
      const common = kvObj(app?.common)
      const inst = installed.get(id)
      const type = kvStr(common?.type)?.toLowerCase()
      if (type) {
        if (type !== 'game' && type !== 'demo') {
          notGames.push(id)
          continue
        }
      } else if (!inst) {
        continue // sem metadados e não instalado: não dá para saber se é jogo
      }
      const title = kvStr(common?.name) ?? inst?.name
      if (!title) continue

      const files = cache.get(id)
      const loc = (...names: string[]): string | null => {
        for (const n of names) {
          const p = files?.get(n)
          if (p) return localAsset(p)
        }
        return null
      }
      const cdn = (key: string, fallback: string): string => `${CDN}/${id}/${assetPath(common, key) ?? fallback}`

      const coverUrl = loc('library_600x900.jpg', 'library_capsule.jpg', 'library_600x900_2x.jpg') ?? cdn('library_capsule', 'library_600x900.jpg')
      const bannerUrl = loc('library_hero.jpg') ?? cdn('library_hero', 'library_hero.jpg')
      const logoUrl = loc('logo.png') ?? cdn('library_logo', 'logo.png')

      const clientIcon = kvStr(common?.clienticon)
      const iconHash = kvStr(common?.icon)
      // Ícone oficial em .ico (16 a 256 px): o do disco para os instalados, senão o mesmo arquivo
      // na CDN da comunidade. O .jpg de "icon" tem só 32×32 e fica borrado a 120 px.
      let iconUrl: string | null = null
      if (clientIcon && /^[0-9a-f]{40}$/i.test(clientIcon)) {
        const ico = join(steamPath, 'steam', 'games', `${clientIcon}.ico`)
        iconUrl = existsSync(ico) ? localAsset(ico) : `https://shared.fastly.steamstatic.com/community_assets/images/apps/${id}/${clientIcon}.ico`
      }
      if (!iconUrl && iconHash) {
        iconUrl = loc(`${iconHash}.jpg`) ?? `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${id}/${iconHash}.jpg`
      }

      let developer: string | null = null
      let publisher: string | null = null
      let franchise: string | null = null
      for (const a of Object.values(kvObj(common?.associations) ?? {})) {
        const o = kvObj(a)
        if (!o) continue
        if (o.type === 'developer' && !developer) developer = kvStr(o.name) ?? null
        if (o.type === 'publisher' && !publisher) publisher = kvStr(o.name) ?? null
        if (o.type === 'franchise' && !franchise) franchise = kvStr(o.name) ?? null
      }
      const ext = kvObj(app?.extended)
      developer ??= kvStr(ext?.developer) ?? null
      publisher ??= kvStr(ext?.publisher) ?? null

      const rel = Number(common?.original_release_date ?? common?.steam_release_date ?? 0)
      const genres = Object.values(kvObj(common?.genres) ?? {})
        .map((g) => GENRES[String(g)])
        .filter((g): g is string => !!g)

      const stats = local.get(id)
      games.push({
        platform: 'steam',
        platformId: id,
        title,
        installDir: inst?.dir ?? null,
        exePath: null,
        launchUri: `steam://rungameid/${id}`,
        coverUrl,
        bannerUrl,
        logoUrl,
        iconUrl,
        developer,
        publisher,
        releaseDate: rel > 0 ? rel * 1000 : null,
        genres: [...new Set(genres)],
        description: null,
        platformPlaytimeSeconds: (stats?.playtimeMin ?? 0) * 60,
        platformLastPlayed: stats?.lastPlayed ? stats.lastPlayed * 1000 : null,
        installSize: inst?.installed ? inst.size : null,
        franchise,
        installed: inst?.installed ?? false
      })
    }
    const inst = games.filter((g) => g.installed).length
    return {
      games,
      notGames,
      ok: true,
      detail: `${inst} instalados · ${libs} biblioteca${libs === 1 ? '' : 's'} · appinfo.vdf`
    }
  }
}
