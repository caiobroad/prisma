import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import type { DetectedGame, Scanner, ScannerOutput } from './types'

interface EpicManifest {
  DisplayName?: string
  AppName?: string
  CatalogNamespace?: string
  CatalogItemId?: string
  InstallLocation?: string
  LaunchExecutable?: string
  bIsIncompleteInstall?: boolean
  AppCategories?: string[]
  MainGameAppName?: string
  InstallSize?: number
}

interface CatalogItem {
  id: string
  title: string
  namespace: string
  description?: string
  developer?: string
  creationDate?: string
  categories?: Array<{ path: string }>
  mainGameItem?: { id?: string }
  releaseInfo?: Array<{ appId?: string; dateAdded?: string }>
  keyImages?: Array<{ type: string; url: string }>
  customAttributes?: Record<string, { value?: string }>
}

function launchUri(ns: string | undefined, id: string | undefined, app: string, action: 'launch' | 'install' = 'launch'): string {
  const target = ns && id ? `${ns}:${id}:${app}` : app
  return `com.epicgames.launcher://apps/${encodeURIComponent(target)}?action=${action}&silent=true`
}

/** Itens do catálogo que não são jogos jogáveis: públicos-alvo, trilhas, livros de arte, betas técnicos. */
const NOT_A_GAME = /(audience|soundtrack|art ?book|offline installers?|beta|promotion)\s*$|audience/i

function readCatalog(programData: string): CatalogItem[] {
  // O launcher guarda em cache o catálogo dos itens da biblioteca da conta (JSON em base64).
  const file = join(programData, 'Epic', 'EpicGamesLauncher', 'Data', 'Catalog', 'catcache.bin')
  if (!existsSync(file)) return []
  try {
    const json = Buffer.from(readFileSync(file, 'utf8'), 'base64').toString('utf8')
    const items = JSON.parse(json) as CatalogItem[]
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

export const epicScanner: Scanner = {
  platform: 'epic',
  async scan(): Promise<ScannerOutput> {
    const programData = process.env.ProgramData ?? 'C:\\ProgramData'
    const dir = join(programData, 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests')
    const catalog = readCatalog(programData)
    if (!existsSync(dir) && !catalog.length) return { games: [], ok: false, detail: 'Epic Games Launcher não encontrado' }

    // Instalados, por AppName.
    const manifests = new Map<string, EpicManifest>()
    try {
      for (const f of readdirSync(dir).filter((x) => x.toLowerCase().endsWith('.item'))) {
        try {
          const m = JSON.parse(readFileSync(join(dir, f), 'utf8')) as EpicManifest
          if (!m.AppName || !m.DisplayName) continue
          if (m.MainGameAppName && m.MainGameAppName !== m.AppName) continue
          manifests.set(m.AppName, m)
        } catch {
          /* manifesto inválido */
        }
      }
    } catch {
      /* sem pasta de manifestos */
    }

    const games = new Map<string, DetectedGame>()

    for (const it of catalog) {
      const cats = (it.categories ?? []).map((c) => c.path)
      if (!cats.includes('games') || cats.includes('digitalextras') || cats.includes('addons')) continue
      if (it.mainGameItem?.id) continue // DLC
      const app = it.releaseInfo?.find((r) => r.appId)?.appId
      if (!app || NOT_A_GAME.test(it.title)) continue
      const img = (type: string): string | null => it.keyImages?.find((k) => k.type === type)?.url ?? null
      const tall = img('DieselGameBoxTall') ?? img('OfferImageTall')
      if (!tall) continue
      const m = manifests.get(app)
      const installDir = m?.InstallLocation ?? null
      const exe = installDir && m?.LaunchExecutable ? join(installDir, m.LaunchExecutable) : null
      const released = Date.parse(it.releaseInfo?.[0]?.dateAdded ?? it.creationDate ?? '')
      games.set(app, {
        platform: 'epic',
        platformId: app,
        title: it.title.replace(/\s+$/, ''),
        installDir,
        exePath: exe && existsSync(exe) ? exe : null,
        launchUri: launchUri(it.namespace, it.id, app),
        coverUrl: tall,
        bannerUrl: img('DieselGameBox') ?? img('OfferImageWide') ?? img('Featured'),
        logoUrl: img('DieselGameBoxLogo'),
        iconUrl: img('Thumbnail'),
        developer: it.developer ?? null,
        publisher: it.customAttributes?.PublisherName?.value ?? null,
        releaseDate: Number.isFinite(released) ? released : null,
        genres: [],
        description: cleanDescription(it.description, it.title),
        installSize: m?.InstallSize ?? null,
        installed: !!m && !m.bIsIncompleteInstall && !!installDir && existsSync(installDir)
      })
    }

    // Instalados que não aparecem no cache do catálogo.
    for (const [app, m] of manifests) {
      if (games.has(app)) continue
      const cats = (m.AppCategories ?? []).map((c) => c.toLowerCase())
      if (cats.length && !cats.includes('games') && !cats.includes('public')) continue
      const installDir = m.InstallLocation ?? null
      const exe = installDir && m.LaunchExecutable ? join(installDir, m.LaunchExecutable) : null
      games.set(app, {
        platform: 'epic',
        platformId: app,
        title: m.DisplayName!,
        installDir,
        exePath: exe && existsSync(exe) ? exe : null,
        launchUri: launchUri(m.CatalogNamespace, m.CatalogItemId, app),
        coverUrl: null,
        installSize: m.InstallSize ?? null,
        installed: !m.bIsIncompleteInstall && !!installDir && existsSync(installDir)
      })
    }

    const list = [...games.values()]
    const inst = list.filter((g) => g.installed).length
    return { games: list, ok: true, detail: `${inst} instalados · catálogo da conta` }
  }
}

/**
 * O catálogo da Epic muitas vezes repete o título no campo de descrição ou traz
 * só uma frase de marketing curta. Descarta o que não é descrição de verdade.
 */
function cleanDescription(desc: string | undefined, title: string): string | null {
  if (!desc) return null
  const d = desc.replace(/\s+/g, ' ').trim()
  const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
  if (!d || norm(d) === norm(title) || d.length < 40) return null
  return d
}

export function epicInstallUri(launch: string): string {
  return launch.replace('action=launch', 'action=install')
}
