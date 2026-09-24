import { net } from 'electron'
import type { CommunityInfo } from '@shared/types'
import { getGame, saveStoreData, steamAppIdFor } from './db/games'
import { fetchStoreItems } from './enrich'

/** Radar da Comunidade: jogadores agora, atualizações oficiais e notícias. Cache de 10 minutos por jogo. */
const cache = new Map<number, { at: number; data: CommunityInfo }>()
const TTL = 10 * 60_000

interface NewsItem {
  title: string
  url: string
  date: number
  feedlabel?: string
  feedname?: string
  contents?: string
}

function clean(s: string): string {
  return s
    .replace(/\[\/?[a-z0-9*]+(=[^\]]*)?\]/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{STEAM_CLAN_IMAGE\}\S*/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Fontes em alfabetos que o público do app não lê ficam de fora. */
const latin = (s: string): boolean => !/[Ѐ-ӿ一-鿿぀-ヿ가-힯]/.test(s)

async function json<T>(url: string): Promise<T | null> {
  try {
    const res = await net.fetch(url)
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

async function news(appid: string): Promise<CommunityInfo['news']> {
  const base = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appid}&maxlength=320&format=json`
  const [official, general] = await Promise.all([
    json<{ appnews?: { newsitems?: NewsItem[] } }>(`${base}&count=4&feeds=steam_community_announcements`),
    json<{ appnews?: { newsitems?: NewsItem[] } }>(`${base}&count=15`)
  ])
  const seen = new Set<string>()
  const out: CommunityInfo['news'] = []
  const push = (n: NewsItem, source: string): void => {
    if (seen.has(n.url) || !latin(n.title)) return
    seen.add(n.url)
    out.push({ title: clean(n.title), url: n.url, date: n.date * 1000, source, excerpt: clean(n.contents ?? '').slice(0, 220) })
  }
  for (const n of official?.appnews?.newsitems ?? []) push(n, 'Atualização oficial')
  for (const n of general?.appnews?.newsitems ?? []) if (out.length < 8) push(n, n.feedlabel || n.feedname || 'Notícias')
  return out.sort((a, b) => b.date - a.date).slice(0, 8)
}

export async function communityFor(gameId: number): Promise<CommunityInfo> {
  const hit = cache.get(gameId)
  if (hit && Date.now() - hit.at < TTL) return hit.data
  const g = getGame(gameId)
  const appid = g ? steamAppIdFor(gameId) : null
  const empty: CommunityInfo = {
    appid,
    playersNow: null,
    reviewPct: g?.reviewPct ?? null,
    reviewLabel: g?.reviewLabel ?? null,
    reviewCount: g?.reviewCount ?? null,
    metacritic: g?.metacritic ?? null,
    news: []
  }
  if (!appid) return empty
  const [players, items, store] = await Promise.all([
    json<{ response?: { player_count?: number; result?: number } }>(
      `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appid}`
    ),
    news(appid),
    fetchStoreItems([appid]).catch(() => null)
  ])
  const s = store?.get(appid)
  if (s) saveStoreData(gameId, s)
  const data: CommunityInfo = {
    ...empty,
    playersNow: players?.response?.result === 1 ? (players.response.player_count ?? null) : null,
    reviewPct: s?.reviewPct ?? empty.reviewPct,
    reviewLabel: s?.reviewLabel ?? empty.reviewLabel,
    reviewCount: s?.reviewCount ?? empty.reviewCount,
    news: items
  }
  cache.set(gameId, { at: Date.now(), data })
  if (cache.size > 40) cache.delete(cache.keys().next().value!)
  return data
}
