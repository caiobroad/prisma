import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { bkvObj, parseBinaryKV, type BKV } from './util/binkv'
import { replaceAchievements, steamGamesForAchievements } from './db/games'
import { findSteamPath } from './scanners/steam'

const ICON_CDN = 'https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps'

/** Texto localizado do esquema: prefere português, cai para inglês. */
function loc(v: BKV | string | number | undefined): string | null {
  if (typeof v === 'string') return v
  const o = bkvObj(v)
  if (!o) return null
  const s = o.brazilian ?? o.portuguese ?? o.english ?? Object.values(o).find((x) => typeof x === 'string' && !String(x).startsWith('NEW_'))
  return typeof s === 'string' ? s : null
}

interface Parsed {
  apiName: string
  name: string
  description: string | null
  icon: string | null
  unlockedAt: number | null
}

/**
 * Conquistas da Steam lidas do cache local do cliente:
 * UserGameStatsSchema_<appid>.bin traz nomes e ícones; UserGameStats_<conta>_<appid>.bin
 * traz os bits desbloqueados e a hora de cada desbloqueio. Nada é baixado.
 */
function readApp(statsDir: string, appid: string, files: string[], account: string | null): Parsed[] | null {
  const schemaFile = join(statsDir, `UserGameStatsSchema_${appid}.bin`)
  if (!existsSync(schemaFile)) return null
  let schema: BKV
  try {
    schema = parseBinaryKV(readFileSync(schemaFile))
  } catch {
    return null
  }
  const root = bkvObj(schema[appid]) ?? bkvObj(Object.values(schema)[0])
  const stats = bkvObj(root?.stats)
  if (!stats) return null

  // Desbloqueios da conta Steam do perfil (ou de todas as contas do PC, se o perfil não
  // escolheu uma); fica a data mais antiga.
  const unlocked = new Map<string, number>()
  const prefix = account ? `UserGameStats_${account}_` : 'UserGameStats_'
  for (const f of files) {
    if (!f.endsWith(`_${appid}.bin`) || !f.startsWith(prefix)) continue
    try {
      const s = parseBinaryKV(readFileSync(join(statsDir, f)))
      const cache = bkvObj(s.cache) ?? bkvObj(bkvObj(s[appid])?.cache)
      for (const [statId, v] of Object.entries(cache ?? {})) {
        const o = bkvObj(v)
        if (!o) continue
        const data = Number(o.data ?? 0)
        const times = bkvObj(o.AchievementTimes) ?? {}
        for (let bit = 0; bit < 32; bit++) {
          if ((data >>> bit) & 1) {
            const key = `${statId}:${bit}`
            const t = Number(times[String(bit)] ?? 0) * 1000
            const prev = unlocked.get(key)
            if (prev == null || (t && t < prev)) unlocked.set(key, t)
          }
        }
      }
    } catch {
      /* arquivo de outra versão: ignora */
    }
  }

  const out: Parsed[] = []
  for (const [statId, v] of Object.entries(stats)) {
    const bits = bkvObj(bkvObj(v)?.bits)
    if (!bits) continue
    for (const [bit, b] of Object.entries(bits)) {
      const a = bkvObj(b)
      if (!a) continue
      const display = bkvObj(a.display)
      const apiName = typeof a.name === 'string' ? a.name : `${statId}_${bit}`
      const key = `${statId}:${bit}`
      const icon = typeof display?.icon === 'string' ? `${ICON_CDN}/${appid}/${display.icon}` : null
      const t = unlocked.get(key)
      out.push({
        apiName,
        name: loc(display?.name) ?? apiName,
        description: loc(display?.desc),
        icon,
        unlockedAt: t == null ? null : t || 0
      })
    }
  }
  return out
}

/** Atualiza as conquistas de todos os jogos Steam da biblioteca (ou só dos ids pedidos). */
export async function syncSteamAchievements(onlyGameIds?: number[], account: string | null = null): Promise<number> {
  const steam = await findSteamPath()
  if (!steam) return 0
  const statsDir = join(steam, 'appcache', 'stats')
  if (!existsSync(statsDir)) return 0
  let files: string[] = []
  try {
    files = readdirSync(statsDir)
  } catch {
    return 0
  }
  let n = 0
  for (const g of steamGamesForAchievements(onlyGameIds)) {
    const list = readApp(statsDir, g.platformId, files, account || null)
    if (!list) continue
    replaceAchievements(g.id, list)
    n += list.filter((a) => a.unlockedAt != null).length
  }
  return n
}
