import { net } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { Friend, FriendLibrary, FriendState } from '@shared/types'
import { parseVdf, vdfGet, type VdfObject } from './util/vdf'
import { findSteamPath } from './scanners/steam'
import { cachedTags, profileStats, steamAppIdFor, getGame } from './db/games'
import { fetchStoreItems } from './enrich'
import { listProfiles, activeProfileId } from './profiles'
import { loadSettings } from './settings'

/**
 * Amigos e bibliotecas.
 * - Com a chave pessoal da Steam Web API: lista de amigos, status em tempo real (jogando,
 *   online, ausente, visto por último) e bibliotecas públicas para comparar.
 * - Sem chave: os amigos que o cliente Steam guarda em cache nesta máquina (nome e foto),
 *   sem status, e a biblioteca local de tempo de jogo.
 * - Perfis do Prisma neste PC também aparecem, com biblioteca e Game DNA completos.
 */
const STEAM64 = 76561197960265728n
const toSteam64 = (accountId: string): string => (STEAM64 + BigInt(accountId)).toString()
const toAccount = (steam64: string): string => (BigInt(steam64) - STEAM64).toString()

interface LocalUser {
  accountId: string
  steamId: string
  name: string
}

/** Conta Steam mais recente desta máquina (loginusers.vdf). */
async function currentUser(): Promise<LocalUser | null> {
  const sp = await findSteamPath()
  if (!sp) return null
  try {
    const root = parseVdf(readFileSync(join(sp, 'config', 'loginusers.vdf'), 'utf8'))
    const users = (vdfGet(root, 'users') ?? root) as VdfObject
    let best: LocalUser | null = null
    let bestTs = -1
    for (const [id, v] of Object.entries(users)) {
      if (typeof v !== 'object') continue
      const ts = Number(vdfGet(v, 'Timestamp') ?? 0) + (vdfGet(v, 'MostRecent') === '1' ? 1e12 : 0)
      if (ts > bestTs) {
        bestTs = ts
        best = { steamId: id, accountId: toAccount(id), name: String(vdfGet(v, 'PersonaName') ?? '') }
      }
    }
    return best
  } catch {
    return null
  }
}

function localConfig(sp: string, accountId: string): VdfObject | null {
  const f = join(sp, 'userdata', accountId, 'config', 'localconfig.vdf')
  if (!existsSync(f)) return null
  try {
    const root = parseVdf(readFileSync(f, 'utf8'))
    return (vdfGet(root, 'UserLocalConfigStore') ?? root) as VdfObject
  } catch {
    return null
  }
}

const avatarUrl = (hash: string | undefined): string | null =>
  hash && /^[0-9a-f]{40}$/i.test(hash) && !/^0+$/.test(hash) ? `https://avatars.steamstatic.com/${hash}_full.jpg` : null

async function api<T>(path: string): Promise<T | null> {
  try {
    const res = await net.fetch(`https://api.steampowered.com/${path}`)
    if (res.status === 401 || res.status === 403) throw new Error('forbidden')
    return res.ok ? ((await res.json()) as T) : null
  } catch (e) {
    if ((e as Error).message === 'forbidden') throw e
    return null
  }
}

interface Summary {
  steamid: string
  personaname: string
  avatarfull?: string
  personastate: number
  gameextrainfo?: string
  gameid?: string
  lastlogoff?: number
  profileurl?: string
}

function stateOf(s: Summary): FriendState {
  if (s.gameid || s.gameextrainfo) return 'playing'
  if (s.personastate === 1 || s.personastate === 2 || s.personastate === 5 || s.personastate === 6) return 'online'
  if (s.personastate === 3 || s.personastate === 4) return 'away'
  return 'offline'
}

const STATE_ORDER: Record<FriendState, number> = { playing: 0, online: 1, away: 2, unknown: 3, offline: 4 }

function localProfilesAsFriends(): Friend[] {
  const me = activeProfileId()
  return listProfiles()
    .filter((p) => p.id !== me)
    .map((p) => ({
      id: `local:${p.id}`,
      source: 'local' as const,
      name: p.nickname,
      avatar: p.avatar,
      state: 'offline' as FriendState,
      game: null,
      gameAppId: null,
      lastOnline: p.lastUsed,
      profileUrl: null
    }))
}

export async function listFriends(): Promise<{ friends: Friend[]; mode: 'api' | 'local' | 'none'; message: string | null }> {
  const local = localProfilesAsFriends()
  const me = await currentUser()
  const key = loadSettings().steamApiKey.trim()
  if (me && key) {
    try {
      const fl = await api<{ friendslist?: { friends?: Array<{ steamid: string }> } }>(
        `ISteamUser/GetFriendList/v1/?key=${encodeURIComponent(key)}&steamid=${me.steamId}&relationship=friend`
      )
      const ids = fl?.friendslist?.friends?.map((f) => f.steamid) ?? []
      const summaries: Summary[] = []
      for (let i = 0; i < ids.length; i += 100) {
        const r = await api<{ response?: { players?: Summary[] } }>(
          `ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(key)}&steamids=${ids.slice(i, i + 100).join(',')}`
        )
        summaries.push(...(r?.response?.players ?? []))
      }
      if (fl) {
        const friends: Friend[] = summaries.map((s) => ({
          id: s.steamid,
          source: 'steam',
          name: s.personaname,
          avatar: s.avatarfull ?? null,
          state: stateOf(s),
          game: s.gameextrainfo ?? null,
          gameAppId: s.gameid ?? null,
          lastOnline: s.lastlogoff ? s.lastlogoff * 1000 : null,
          profileUrl: s.profileurl ?? `https://steamcommunity.com/profiles/${s.steamid}`
        }))
        friends.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || (b.lastOnline ?? 0) - (a.lastOnline ?? 0) || a.name.localeCompare(b.name))
        return { friends: [...friends, ...local], mode: 'api', message: null }
      }
    } catch {
      return { friends: await cachedFriends(me, local), mode: 'local', message: 'A chave da Steam Web API foi recusada. Mostrando o cache local.' }
    }
  }
  if (!me) return { friends: local, mode: 'none', message: 'Steam não encontrada neste PC.' }
  return {
    friends: await cachedFriends(me, local),
    mode: 'local',
    message: 'Status em tempo real precisa da sua chave da Steam Web API (Ajustes → Amigos).'
  }
}

async function cachedFriends(me: LocalUser, local: Friend[]): Promise<Friend[]> {
  const sp = await findSteamPath()
  const cfg = sp ? localConfig(sp, me.accountId) : null
  const fr = vdfGet(cfg ?? undefined, 'friends') as VdfObject | undefined
  const out: Friend[] = []
  for (const [id, v] of Object.entries(fr ?? {})) {
    // Só contas individuais (ids de 32 bits); grupos e a própria conta ficam de fora.
    if (!/^\d+$/.test(id) || id === me.accountId || BigInt(id) >= 2n ** 32n || typeof v !== 'object') continue
    const name = vdfGet(v, 'name')
    if (typeof name !== 'string' || !name) continue
    const sid = toSteam64(id)
    out.push({
      id: sid,
      source: 'steam',
      name,
      avatar: avatarUrl(vdfGet(v, 'avatar') as string | undefined),
      state: 'unknown',
      game: null,
      gameAppId: null,
      lastOnline: null,
      profileUrl: `https://steamcommunity.com/profiles/${sid}`
    })
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  return [...out, ...local]
}

/** Tags por appid: cache do banco e, para o que faltar, a loja em lotes de 50. */
export async function tagsFor(appids: string[]): Promise<Record<string, string[]>> {
  const uniq = [...new Set(appids.filter((a) => /^\d+$/.test(a)))]
  const out = cachedTags(uniq)
  const missing = uniq.filter((a) => !out[a]).slice(0, 200)
  for (let i = 0; i < missing.length; i += 50) {
    try {
      const data = await fetchStoreItems(missing.slice(i, i + 50))
      for (const [id, d] of data) out[id] = d.tags
    } catch {
      break
    }
  }
  return out
}

async function withTags(lib: Omit<FriendLibrary, 'tags'>): Promise<FriendLibrary> {
  const top = [...lib.games].sort((a, b) => b.minutes - a.minutes).slice(0, 80)
  return { ...lib, tags: await tagsFor(top.map((g) => g.appid)) }
}

/** Biblioteca de um perfil do Prisma: tempo por jogo das sessões dele (e da Steam, se for o dono da conta). */
function localProfileLibrary(profileId: number, friendId: string): Omit<FriendLibrary, 'tags'> {
  const p = listProfiles().find((x) => x.id === profileId)
  if (!p) return { friendId, games: [], available: false, reason: 'Perfil não encontrado' }
  const stats = profileStats(profileId, p.steamLinked, 400)
  const games = stats.topGames.map((t) => {
    const g = getGame(t.gameId)
    return { appid: steamAppIdFor(t.gameId) ?? `game:${t.gameId}`, name: g?.title ?? '?', minutes: Math.round(t.seconds / 60) }
  })
  return { friendId, games, available: true, reason: null }
}

export async function friendLibrary(friendId: string): Promise<FriendLibrary> {
  if (friendId.startsWith('local:')) return withTags(localProfileLibrary(Number(friendId.slice(6)), friendId))
  const key = loadSettings().steamApiKey.trim()
  if (!key) return { friendId, games: [], tags: {}, available: false, reason: 'Comparar bibliotecas da Steam precisa da sua chave da Steam Web API.' }
  try {
    const r = await api<{ response?: { games?: Array<{ appid: number; name?: string; playtime_forever: number }> } }>(
      `IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(key)}&steamid=${friendId}&include_appinfo=1&include_played_free_games=1`
    )
    const games = r?.response?.games
    if (!games) return { friendId, games: [], tags: {}, available: false, reason: 'A biblioteca deste amigo é privada.' }
    return withTags({
      friendId,
      games: games.map((g) => ({ appid: String(g.appid), name: g.name ?? String(g.appid), minutes: g.playtime_forever })),
      available: true,
      reason: null
    })
  } catch {
    return { friendId, games: [], tags: {}, available: false, reason: 'A Steam recusou a chave da Web API.' }
  }
}

export async function myLibrary(): Promise<FriendLibrary> {
  const id = activeProfileId()
  if (id == null) return { friendId: 'me', games: [], tags: {}, available: false, reason: 'Nenhum perfil ativo' }
  return withTags(localProfileLibrary(id, 'me'))
}
