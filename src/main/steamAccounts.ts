import { net } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { SteamAccount } from '@shared/types'
import { parseVdf, vdfGet, type VdfObject } from './util/vdf'
import { findSteamPath } from './scanners/steam'
import { getSetting } from './db/games'
import { getDb } from './db'

/**
 * Contas Steam deste PC. Várias pessoas podem entrar no mesmo cliente Steam; cada perfil do
 * Prisma escolhe a sua e vê só os jogos dela. O que o disco diz por conta: os jogos que ela já
 * jogou (userdata/<conta>/config/localconfig.vdf) e os que ela instalou (LastOwner do manifesto).
 * Os nunca jogados só aparecem com a chave da Steam Web API (GetOwnedGames).
 */
const STEAM64 = 76561197960265728n
export const toAccountId = (steam64: string): string => (BigInt(steam64) - STEAM64).toString()
export const toSteam64 = (accountId: string): string => (STEAM64 + BigInt(accountId)).toString()

export async function listSteamAccounts(): Promise<SteamAccount[]> {
  const sp = await findSteamPath()
  if (!sp) return []
  let users: VdfObject
  try {
    const root = parseVdf(readFileSync(join(sp, 'config', 'loginusers.vdf'), 'utf8'))
    users = (vdfGet(root, 'users') ?? root) as VdfObject
  } catch {
    return []
  }
  const out: Array<SteamAccount & { ts: number }> = []
  for (const [id, v] of Object.entries(users)) {
    if (!/^\d{17}$/.test(id) || typeof v !== 'object') continue
    // Só o nome público (PersonaName); o login da conta (AccountName) não é lido.
    const name = String(vdfGet(v, 'PersonaName') ?? '').trim() || 'Conta Steam'
    const png = join(sp, 'config', 'avatarcache', `${id}.png`)
    let avatar: string | null = null
    try {
      if (existsSync(png)) avatar = `data:image/png;base64,${readFileSync(png).toString('base64')}`
    } catch {
      /* avatar ilegível */
    }
    out.push({
      accountId: toAccountId(id),
      steamId: id,
      name,
      avatar,
      mostRecent: vdfGet(v, 'MostRecent') === '1',
      ts: Number(vdfGet(v, 'Timestamp') ?? 0)
    })
  }
  out.sort((a, b) => Number(b.mostRecent) - Number(a.mostRecent) || b.ts - a.ts)
  // Nem toda versão da Steam grava MostRecent: vale a entrada mais recente.
  return out.map(({ ts: _ts, ...a }, i) => ({ ...a, mostRecent: i === 0 }))
}

export interface ApiOwned {
  account: string
  games: Array<{ appid: string; name: string; playtimeMin: number; lastPlayed: number | null; icon: string | null }>
}

/**
 * Lista completa de jogos de cada conta escolhida por um perfil que tenha a própria chave da
 * Steam Web API. Uma chamada por conta; falhas (chave recusada, sem rede) só pulam a conta.
 */
export async function apiOwnedGames(): Promise<ApiOwned[]> {
  const db = getDb()
  const profiles = db.prepare("SELECT id, steam_account FROM profiles WHERE steam_account IS NOT NULL AND steam_account != ''").all() as Array<{
    id: number
    steam_account: string
  }>
  const done = new Set<string>()
  const out: ApiOwned[] = []
  for (const p of profiles) {
    if (done.has(p.steam_account)) continue
    let key = ''
    try {
      key = String((JSON.parse(getSetting(`settings:${p.id}`) ?? '{}') as { steamApiKey?: string }).steamApiKey ?? '').trim()
    } catch {
      /* ajustes ilegíveis */
    }
    if (!/^[0-9A-F]{32}$/i.test(key)) continue
    try {
      const res = await net.fetch(
        `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(key)}&steamid=${toSteam64(p.steam_account)}&include_appinfo=1&include_played_free_games=1`
      )
      if (!res.ok) continue
      const j = (await res.json()) as {
        response?: { games?: Array<{ appid: number; name?: string; playtime_forever?: number; rtime_last_played?: number; img_icon_url?: string }> }
      }
      const games = j.response?.games
      if (!games?.length) continue
      done.add(p.steam_account)
      out.push({
        account: p.steam_account,
        games: games.map((g) => ({
          appid: String(g.appid),
          name: g.name ?? `App ${g.appid}`,
          playtimeMin: g.playtime_forever ?? 0,
          lastPlayed: g.rtime_last_played ? g.rtime_last_played * 1000 : null,
          icon: g.img_icon_url ? `https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg` : null
        }))
      })
    } catch {
      /* sem rede */
    }
  }
  return out
}
