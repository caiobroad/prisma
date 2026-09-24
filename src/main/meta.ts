import { nativeImage, net } from 'electron'
import { readFile, readdir, stat } from 'fs/promises'
import { join } from 'path'
import type { Game } from '@shared/types'
import { detailsState, getGame, saveDetails, setInstallSize, setZoneColor } from './db/games'

interface AppDetails {
  short_description?: string
  about_the_game?: string
  genres?: Array<{ description: string }>
  developers?: string[]
  publishers?: string[]
  movies?: Array<{ highlight?: boolean; hls_h264?: string; mp4?: Record<string, string>; webm?: Record<string, string> }>
  pc_requirements?: { minimum?: string; recommended?: string } | unknown[]
  metacritic?: { score?: number }
}

const inflight = new Map<number, Promise<Game | null>>()

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[™®©]/g, '')
    .replace(/\b(the|edition|remastered|enhanced|definitive|goty|game of the year|complete|standard)\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

/**
 * Encontra o appid da Steam de um jogo de outra loja pelo título. Só aceita um app (não
 * pacote) com o mesmo nome normalizado, comparando com o nome em inglês, como a Epic e a GOG
 * usam. Prefixo não basta: "Spellbreak" não é "Spell Breakers".
 */
async function findSteamRef(title: string): Promise<string | null> {
  const res = await net.fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(title)}&l=english&cc=BR`)
  if (!res.ok) throw new Error(String(res.status))
  const json = (await res.json()) as { items?: Array<{ id: number; name: string; type: string }> }
  const want = normalize(title)
  if (!want) return null
  const hit = json.items?.find((i) => i.type === 'app' && normalize(i.name) === want)
  return hit ? String(hit.id) : null
}

async function appDetails(appid: string): Promise<AppDetails | null> {
  const res = await net.fetch(`https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(appid)}&l=brazilian&cc=br`, {
    headers: { 'Accept-Language': 'pt-BR' }
  })
  if (!res.ok) throw new Error(String(res.status))
  const json = (await res.json()) as Record<string, { success: boolean; data?: AppDetails }>
  return json[appid]?.data ?? null
}

function decodeHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Requisitos mínimos em texto limpo ("Rótulo: valor" por linha) e a RAM mínima em GB. */
function requirements(d: AppDetails | null): { minRequirements: string | null; minRamGb: number | null } {
  const req = d?.pc_requirements
  const html = req && !Array.isArray(req) ? req.minimum : undefined
  if (!html) return { minRequirements: null, minRamGb: null }
  const text = html
    .replace(/<\/li>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l && !/^(m[ií]nimos?|minimum):?$/i.test(l))
    .join('\n')
  const m = text.match(/(?:mem[óo]ria|memory|ram)\s*:?\s*(\d+(?:[.,]\d+)?)\s*(GB|MB)/i)
  let ram: number | null = null
  if (m) {
    const v = Number(m[1].replace(',', '.'))
    ram = /mb/i.test(m[2]) ? Math.round((v / 1024) * 10) / 10 : v
  }
  return { minRequirements: text || null, minRamGb: ram }
}

function pickTrailer(d: AppDetails | null): string {
  const movies = d?.movies ?? []
  const m = movies.find((x) => x.highlight && x.hls_h264) ?? movies.find((x) => x.hls_h264)
  return m?.hls_h264 ?? ''
}

/**
 * Completa descrição, gêneros e trailer uma vez por jogo (loja Steam, em português),
 * e calcula o tamanho em disco se o manifesto da loja não informar.
 */
export function ensureDetails(id: number): Promise<Game | null> {
  const running = inflight.get(id)
  if (running) return running
  const p = (async () => {
    const g = getGame(id)
    if (!g) return null
    const st = detailsState(id)
    if (!st.fetched && g.platform !== 'manual') {
      try {
        const ref = g.platform === 'steam' ? g.platformId : (st.steamRef ?? (await findSteamRef(g.title)))
        const d = ref ? await appDetails(ref) : null
        saveDetails(id, {
          description: d?.short_description ? decodeHtml(d.short_description) : null,
          genres: d?.genres?.map((x) => x.description) ?? [],
          developer: d?.developers?.[0] ?? null,
          publisher: d?.publishers?.[0] ?? null,
          trailerUrl: pickTrailer(d),
          steamRef: ref ?? '',
          ...requirements(d),
          metacritic: d?.metacritic?.score ?? null
        })
      } catch {
        // Sem internet ou limite da API: tenta de novo na próxima abertura do app.
      }
    } else if (!st.fetched) {
      saveDetails(id, { trailerUrl: '' })
    }
    const now = getGame(id)
    if (now && now.installed && now.installSize == null && now.installDir) {
      const bytes = await folderSize(now.installDir)
      if (bytes > 0) setInstallSize(id, bytes)
    }
    return getGame(id)
  })().finally(() => inflight.delete(id))
  inflight.set(id, p)
  return p
}

export async function trailerFor(id: number): Promise<string | null> {
  const g = getGame(id)
  if (!g) return null
  if (g.trailerUrl != null) return g.trailerUrl || null
  const d = await ensureDetails(id)
  return d?.trailerUrl || null
}

/** Soma o tamanho de uma pasta sem bloquear (limite de arquivos para pastas gigantes). */
async function folderSize(dir: string, limit = 200_000): Promise<number> {
  let total = 0
  let count = 0
  const stack = [dir]
  while (stack.length && count < limit) {
    const d = stack.pop()!
    let entries: import('fs').Dirent[]
    try {
      entries = await readdir(d, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      const p = join(d, e.name)
      if (e.isDirectory()) stack.push(p)
      else if (e.isFile()) {
        try {
          total += (await stat(p)).size
        } catch {
          /* arquivo em uso */
        }
        if (++count >= limit) break
      }
    }
  }
  return total
}

async function loadImage(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith('cover://')) {
      const p = decodeURIComponent(url.replace(/^cover:\/\/(local\/)?/, ''))
      return await readFile(p)
    }
    if (url.startsWith('data:')) return Buffer.from(url.split(',')[1] ?? '', 'base64')
    const res = await net.fetch(url)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

/** Cor vibrante dominante: reduz para 32×32 e agrupa por matiz, pesando saturação e brilho. */
function vibrant(img: Electron.NativeImage): string | null {
  const small = img.resize({ width: 32, height: 32, quality: 'good' })
  const bmp = small.toBitmap()
  const buckets = new Array(24).fill(0).map(() => ({ w: 0, r: 0, g: 0, b: 0 }))
  for (let i = 0; i + 3 < bmp.length; i += 4) {
    const b = bmp[i] / 255
    const g = bmp[i + 1] / 255
    const r = bmp[i + 2] / 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l = (max + min) / 2
    const d = max - min
    if (d < 0.08 || l < 0.08 || l > 0.92) continue
    const s = d / (1 - Math.abs(2 * l - 1))
    let h = 0
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h = (h * 60 + 360) % 360
    const w = s * s * (1 - Math.abs(l - 0.5))
    const k = Math.floor(h / 15)
    buckets[k].w += w
    buckets[k].r += r * w
    buckets[k].g += g * w
    buckets[k].b += b * w
  }
  let best = -1
  let bw = 0
  for (let k = 0; k < buckets.length; k++) {
    const w = buckets[k].w + 0.5 * (buckets[(k + 1) % 24].w + buckets[(k + 23) % 24].w)
    if (w > bw) {
      bw = w
      best = k
    }
  }
  if (best < 0 || buckets[best].w === 0) return null
  const c = buckets[best]
  const hex = (v: number): string =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${hex(c.r / c.w)}${hex(c.g / c.w)}${hex(c.b / c.w)}`
}

export async function zoneColorFor(id: number): Promise<string | null> {
  const g = getGame(id)
  if (!g) return null
  if (g.zoneColor) return g.zoneColor
  for (const url of [g.bannerUrl, g.coverUrl, g.iconUrl, g.iconData]) {
    if (!url) continue
    const buf = await loadImage(url)
    if (!buf) continue
    const img = nativeImage.createFromBuffer(buf)
    if (img.isEmpty()) continue
    const c = vibrant(img)
    if (c) {
      setZoneColor(id, c)
      return c
    }
  }
  return null
}
