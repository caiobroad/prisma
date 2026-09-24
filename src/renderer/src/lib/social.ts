import { useEffect, useState } from 'react'
import type { Friend, FriendLibrary, Game } from '@shared/types'
import { computeDna, type Dna } from './dna'
import { getState } from './store'

/**
 * Amigos e bibliotecas com cache curto em memória: trocar de tela não refaz as chamadas,
 * e a lista de amigos só se atualiza (a cada 60 s) enquanto alguma tela social está aberta.
 */
type FriendsResult = Awaited<ReturnType<typeof window.nexus.friends.list>>

let friendsCache: { at: number; data: FriendsResult } | null = null
let friendsInflight: Promise<FriendsResult> | null = null
const libCache = new Map<string, { at: number; data: FriendLibrary }>()

export function loadFriends(force = false): Promise<FriendsResult> {
  if (!force && friendsCache && Date.now() - friendsCache.at < 55_000) return Promise.resolve(friendsCache.data)
  if (friendsInflight) return friendsInflight
  friendsInflight = window.nexus.friends
    .list()
    .then((data) => {
      friendsCache = { at: Date.now(), data }
      return data
    })
    .finally(() => (friendsInflight = null))
  return friendsInflight
}

export function useFriends(): FriendsResult | null {
  const [data, setData] = useState<FriendsResult | null>(friendsCache?.data ?? null)
  useEffect(() => {
    let alive = true
    const load = (force: boolean): void => {
      if (document.hidden) return
      void loadFriends(force).then((d) => alive && setData(d))
    }
    load(false)
    const t = window.setInterval(() => load(true), 60_000)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [])
  return data
}

export function invalidateSocial(): void {
  friendsCache = null
  libCache.clear()
}

export function loadLibrary(id: string): Promise<FriendLibrary> {
  const hit = libCache.get(id)
  if (hit && Date.now() - hit.at < 5 * 60_000) return Promise.resolve(hit.data)
  const p = id === 'me' ? window.nexus.friends.myLibrary() : window.nexus.friends.library(id)
  return p.then((data) => {
    libCache.set(id, { at: Date.now(), data })
    return data
  })
}

export function useLibrary(id: string | null, key = 0): FriendLibrary | null {
  const [lib, setLib] = useState<FriendLibrary | null>(null)
  useEffect(() => {
    if (!id) return setLib(null)
    let alive = true
    setLib(null)
    void loadLibrary(id).then((d) => alive && setLib(d))
    return () => {
      alive = false
    }
  }, [id, key])
  return lib
}

/** Tags de um item da biblioteca: da loja (cache), senão as do jogo local (ou os gêneros). */
function tagsOf(appid: string, lib: FriendLibrary, games: Map<string, Game>): string[] {
  const t = lib.tags[appid]
  if (t?.length) return t
  const g = games.get(appid)
  return g ? (g.tags.length ? g.tags : g.genres) : []
}

/** Índice appid → jogo local (Steam pelo appid; outros pela chave game:<id>). */
export function gamesByAppKey(): Map<string, Game> {
  const m = new Map<string, Game>()
  for (const g of getState().games) {
    m.set(`game:${g.id}`, g)
    if (g.platform === 'steam') m.set(g.platformId, g)
  }
  return m
}

export function libraryDna(lib: FriendLibrary): Dna {
  const games = gamesByAppKey()
  return computeDna(lib.games.map((g) => ({ tags: tagsOf(g.appid, lib, games), hours: g.minutes / 60 })))
}

export const FRIEND_STATE: Record<Friend['state'], string> = {
  playing: 'Jogando',
  online: 'Online',
  away: 'Ausente',
  offline: 'Offline',
  unknown: 'Sem status'
}

export function friendStatus(f: Friend): string {
  if (f.state === 'playing') return f.game ? `Jogando ${f.game}` : 'Jogando'
  if (f.state === 'offline' && f.lastOnline) {
    const min = (Date.now() - f.lastOnline) / 60000
    if (min < 90) return 'Offline há pouco'
  }
  return FRIEND_STATE[f.state]
}
