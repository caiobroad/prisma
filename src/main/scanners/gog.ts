import { existsSync } from 'fs'
import { join } from 'path'
import { DatabaseSync } from 'node:sqlite'
import { regSubkeys, regValues } from '../util/exec'
import type { DetectedGame, Scanner, ScannerOutput } from './types'

const ROOTS = ['HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games', 'HKLM\\SOFTWARE\\GOG.com\\Games']

interface Owned {
  title: string
  cover: string | null
  banner: string | null
  icon: string | null
  logo: string | null
  developer: string | null
  publisher: string | null
  releaseDate: number | null
  genres: string[]
  description: string | null
}

function parse<T>(v: unknown): T | null {
  if (typeof v !== 'string') return null
  try {
    return JSON.parse(v) as T
  } catch {
    return null
  }
}

/**
 * Jogos da conta GOG pelo banco do GOG Galaxy 2.0 (somente leitura).
 * Só existe se o Galaxy estiver instalado e já tiver sincronizado a conta.
 */
function galaxyLibrary(): Map<string, Owned> {
  const out = new Map<string, Owned>()
  const programData = process.env.ProgramData ?? 'C:\\ProgramData'
  const file = join(programData, 'GOG.com', 'Galaxy', 'storage', 'galaxy-2.0.db')
  if (!existsSync(file)) return out
  let db: DatabaseSync | null = null
  try {
    db = new DatabaseSync(file, { readOnly: true })
    const keys = new Set<string>()
    for (const sql of [
      "SELECT releaseKey AS k FROM LibraryReleaseKeys WHERE releaseKey LIKE 'gog_%'",
      "SELECT gameReleaseKey AS k FROM ProductPurchaseDates WHERE gameReleaseKey LIKE 'gog_%'"
    ]) {
      try {
        for (const r of db.prepare(sql).all() as Array<{ k: string }>) keys.add(r.k)
      } catch {
        /* tabela ausente nesta versão do Galaxy */
      }
    }
    if (!keys.size) return out
    const types = new Map<number, string>()
    for (const r of db.prepare('SELECT id, type FROM GamePieceTypes').all() as Array<{ id: number; type: string }>) {
      types.set(Number(r.id), r.type)
    }
    const pieces = db.prepare('SELECT releaseKey, gamePieceTypeId, value FROM GamePieces').all() as Array<{
      releaseKey: string
      gamePieceTypeId: number
      value: string
    }>
    const byKey = new Map<string, Record<string, unknown>>()
    for (const p of pieces) {
      if (!keys.has(p.releaseKey)) continue
      const t = types.get(Number(p.gamePieceTypeId))
      if (!t) continue
      let o = byKey.get(p.releaseKey)
      if (!o) byKey.set(p.releaseKey, (o = {}))
      o[t] = parse(p.value)
    }
    for (const [key, o] of byKey) {
      const title =
        (o.title as { title?: string } | null)?.title ?? (o.originalTitle as { title?: string } | null)?.title
      if (!title) continue
      const img = (o.originalImages ?? o.images) as Record<string, string> | null
      const meta = (o.originalMeta ?? o.meta) as
        | { releaseDate?: number; developers?: string[]; publishers?: string[]; genres?: string[] }
        | null
      const summary = (o.summary ?? o.originalSummary) as { summary?: string } | null
      out.set(key.replace(/^gog_/, ''), {
        title,
        cover: img?.verticalCover ?? null,
        banner: img?.background ?? null,
        icon: img?.squareIcon ?? null,
        logo: img?.logo ?? null,
        developer: meta?.developers?.[0] ?? null,
        publisher: meta?.publishers?.[0] ?? null,
        releaseDate: meta?.releaseDate ? meta.releaseDate * 1000 : null,
        genres: meta?.genres ?? [],
        description: summary?.summary ?? null
      })
    }
  } catch {
    /* banco bloqueado ou formato inesperado */
  } finally {
    try {
      db?.close()
    } catch {
      /* ignora */
    }
  }
  return out
}

export const gogScanner: Scanner = {
  platform: 'gog',
  async scan(): Promise<ScannerOutput> {
    const games = new Map<string, DetectedGame>()
    const owned = galaxyLibrary()

    for (const root of ROOTS) {
      for (const key of await regSubkeys(root)) {
        const v = await regValues(key)
        const id = key.split('\\').pop() ?? ''
        const title = v.gameName ?? v.GAMENAME
        if (!id || !title || games.has(id)) continue
        if (v.dependsOn || v.DEPENDSON) continue
        const path = v.path ?? v.PATH ?? null
        const exe = v.exe ?? v.EXE ?? null
        const exePath = exe ? (exe.includes(':') ? exe : path ? join(path, exe) : null) : null
        const o = owned.get(id)
        games.set(id, {
          platform: 'gog',
          platformId: id,
          title: o?.title ?? title,
          installDir: path,
          exePath: exePath && existsSync(exePath) ? exePath : null,
          launchUri: `goggalaxy://openGameView/${id}`,
          coverUrl: o?.cover ?? null,
          bannerUrl: o?.banner ?? null,
          iconUrl: o?.icon ?? null,
          logoUrl: o?.logo ?? null,
          developer: o?.developer ?? null,
          publisher: o?.publisher ?? null,
          releaseDate: o?.releaseDate ?? null,
          genres: o?.genres ?? [],
          description: o?.description ?? null,
          installed: !!path && existsSync(path)
        })
      }
    }
    for (const [id, o] of owned) {
      if (games.has(id)) continue
      games.set(id, {
        platform: 'gog',
        platformId: id,
        title: o.title,
        installDir: null,
        exePath: null,
        launchUri: `goggalaxy://openGameView/${id}`,
        coverUrl: o.cover,
        bannerUrl: o.banner,
        iconUrl: o.icon,
        logoUrl: o.logo,
        developer: o.developer,
        publisher: o.publisher,
        releaseDate: o.releaseDate,
        genres: o.genres,
        description: o.description,
        installed: false
      })
    }
    if (!games.size) return { games: [], ok: false, detail: 'GOG não encontrado' }
    const list = [...games.values()]
    return {
      games: list,
      ok: true,
      detail: `${list.filter((g) => g.installed).length} instalados · ${owned.size ? 'GOG Galaxy' : 'registro'}`
    }
  }
}
