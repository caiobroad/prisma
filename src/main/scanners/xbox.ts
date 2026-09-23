import { existsSync, readdirSync, readFileSync } from 'fs'
import { basename, dirname, extname, join } from 'path'
import { powershellJson } from '../util/exec'
import { localAsset, type DetectedGame, type Scanner, type ScannerOutput } from './types'

interface AppxRow {
  Name: string
  PackageFamilyName: string
  InstallLocation: string
  PackageFullName: string
}

/**
 * Jogos do Xbox app / Game Pass são pacotes MSIX. Filtramos os que carregam
 * MicrosoftGame.config (assinatura do GDK). A Microsoft não expõe localmente
 * os jogos da conta que não estão instalados, então só os instalados aparecem.
 */
const SCRIPT = `
$rows = Get-AppxPackage -PackageTypeFilter Main | Where-Object { $_.SignatureKind -ne 'System' -and $_.IsFramework -eq $false -and $_.InstallLocation } |
  Select-Object Name, PackageFamilyName, InstallLocation, PackageFullName
if ($null -eq $rows) { '[]' } else { ConvertTo-Json @($rows) -Compress }
`

/** Infraestrutura da Microsoft que também carrega marcadores de jogo, mas não é jogo. */
const NOT_GAMES =
  /^Microsoft\.(GamingApp|GamingServices|XboxGamingOverlay|XboxGameOverlay|XboxIdentityProvider|XboxSpeechToTextOverlay|Xbox\.TCUI|XboxApp|WindowsStore|StorePurchaseApp|DesktopAppInstaller|MicrosoftEdge|WindowsTerminal|Windows\.)/i

/** Recursos MSIX vêm em variantes de escala (Logo.scale-200.png); escolhe a maior que existir. */
function resolveAsset(dir: string, rel: string | undefined): string | null {
  if (!rel || rel.startsWith('ms-resource')) return null
  const full = join(dir, rel.replace(/\//g, '\\'))
  if (existsSync(full)) return full
  const folder = dirname(full)
  const stem = basename(full, extname(full)).toLowerCase()
  try {
    const variants = readdirSync(folder)
      .filter((f) => f.toLowerCase().startsWith(stem + '.') && /\.(png|jpg|jpeg)$/i.test(f))
      .sort((a, b) => scale(b) - scale(a))
    return variants[0] ? join(folder, variants[0]) : null
  } catch {
    return null
  }
}

function scale(f: string): number {
  return Number(f.match(/scale-(\d+)/i)?.[1] ?? f.match(/targetsize-(\d+)/i)?.[1] ?? 100)
}

interface Info {
  appId: string | null
  displayName: string | null
  publisher: string | null
  icon: string | null
  banner: string | null
  logo: string | null
}

function readPackage(dir: string): Info | null {
  const gameCfg = join(dir, 'MicrosoftGame.config')
  if (!existsSync(gameCfg)) return null
  const info: Info = { appId: null, displayName: null, publisher: null, icon: null, banner: null, logo: null }
  try {
    const xml = readFileSync(join(dir, 'AppxManifest.xml'), 'utf8')
    info.appId = xml.match(/<Application\s[^>]*\bId="([^"]+)"/i)?.[1] ?? null
    const dn = xml.match(/<DisplayName>([^<]+)<\/DisplayName>/i)?.[1]
    if (dn && !dn.startsWith('ms-resource')) info.displayName = dn
    const pub = xml.match(/<PublisherDisplayName>([^<]+)<\/PublisherDisplayName>/i)?.[1]
    if (pub && !pub.startsWith('ms-resource')) info.publisher = pub
  } catch {
    /* manifesto ilegível */
  }
  try {
    const cfg = readFileSync(gameCfg, 'utf8')
    const vis = cfg.match(/<ShellVisuals\b[^>]*>/i)?.[0] ?? ''
    const attr = (n: string): string | undefined => vis.match(new RegExp(`\\b${n}="([^"]+)"`, 'i'))?.[1]
    const n = attr('DefaultDisplayName')
    if (n && !n.startsWith('ms-resource') && !info.displayName) info.displayName = n
    const pub = attr('PublisherDisplayName')
    if (pub && !pub.startsWith('ms-resource') && !info.publisher) info.publisher = pub
    info.icon = resolveAsset(dir, attr('Square150x150Logo') ?? attr('StoreLogo'))
    info.banner = resolveAsset(dir, attr('SplashScreenImage'))
    info.logo = resolveAsset(dir, attr('Square480x480Logo') ?? attr('Square150x150Logo'))
  } catch {
    /* config ilegível */
  }
  return info
}

export const xboxScanner: Scanner = {
  platform: 'xbox',
  async scan(): Promise<ScannerOutput> {
    const rows = await powershellJson<AppxRow[] | AppxRow>(SCRIPT, 45000)
    if (!rows) return { games: [], ok: false, detail: 'Get-AppxPackage indisponível' }
    const list = Array.isArray(rows) ? rows : [rows]
    const games: DetectedGame[] = []
    let noAccess = 0
    for (const r of list) {
      if (!r.InstallLocation || NOT_GAMES.test(r.Name)) continue
      let info: Info | null
      try {
        if (!existsSync(r.InstallLocation)) {
          noAccess++
          continue
        }
        info = readPackage(r.InstallLocation)
      } catch {
        noAccess++
        continue
      }
      if (!info) continue
      games.push({
        platform: 'xbox',
        platformId: r.PackageFamilyName,
        title: cleanTitle(info.displayName ?? r.Name),
        installDir: r.InstallLocation,
        exePath: null,
        launchUri: `shell:AppsFolder\\${r.PackageFamilyName}!${info.appId ?? 'Game'}`,
        coverUrl: null,
        bannerUrl: info.banner ? localAsset(info.banner) : null,
        iconUrl: info.icon ? localAsset(info.icon) : null,
        logoUrl: info.logo ? localAsset(info.logo) : null,
        publisher: info.publisher,
        installed: true
      })
    }
    const detail = `${games.length} instalados · ${list.length} pacotes` + (noAccess ? ` · ${noAccess} sem permissão` : '')
    return { games, ok: true, detail }
  }
}

function cleanTitle(name: string): string {
  const parts = name.split('.')
  const raw = parts.length > 1 ? parts.slice(1).join(' ') : name
  return raw.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/-/g, ' ').trim()
}
