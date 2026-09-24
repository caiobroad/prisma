import { net } from 'electron'
import type { ReviewsInfo, SteamReview, WorkshopItem } from '@shared/types'
import { steamAppIdFor } from './db/games'

/**
 * Abas extras da página do jogo, só para jogos com página na Steam:
 * - Avaliações: API pública appreviews (as mais úteis em português; completa com inglês);
 * - Oficina: itens em alta na Steam Workshop (lidos da página pública da Oficina).
 * Cache de 30 minutos por jogo.
 */
const TTL = 30 * 60_000
const reviewCache = new Map<number, { at: number; data: ReviewsInfo | null }>()
const workshopCache = new Map<number, { at: number; data: WorkshopItem[] | null }>()

interface RawReview {
  review: string
  voted_up: boolean
  votes_up: number
  timestamp_created: number
  language: string
  author?: { playtime_forever?: number }
}

/** A Steam responde 429/5xx em rajadas (a página do jogo pede detalhes, trailer e avaliações juntos): tenta de novo. */
async function fetchRetry(url: string, init?: RequestInit, tries = 3): Promise<Response> {
  for (let i = 0; ; i++) {
    const res = await net.fetch(url, init).catch((e: unknown) => (i + 1 < tries ? null : Promise.reject(e)))
    if (res?.ok || (res && res.status < 429) || i + 1 >= tries) {
      if (!res) throw new Error('sem resposta')
      return res
    }
    await new Promise((r) => setTimeout(r, 900 * (i + 1)))
  }
}

async function page(appid: string, lang: string, n: number): Promise<{ summary?: { total_reviews?: number; total_positive?: number; review_score_desc?: string }; reviews: RawReview[] }> {
  const res = await fetchRetry(`https://store.steampowered.com/appreviews/${appid}?json=1&language=${lang}&filter=all&num_per_page=${n}&purchase_type=all&review_type=all`)
  if (!res.ok) throw new Error(String(res.status))
  const j = (await res.json()) as { query_summary?: { total_reviews?: number; total_positive?: number; review_score_desc?: string }; reviews?: RawReview[] }
  return { summary: j.query_summary, reviews: j.reviews ?? [] }
}

const toReview = (r: RawReview): SteamReview => ({
  up: r.voted_up,
  text: r.review.replace(/\[\/?[a-z*]+[^\]]*\]/gi, '').trim().slice(0, 900),
  hours: Math.round((r.author?.playtime_forever ?? 0) / 60),
  votes: r.votes_up,
  date: r.timestamp_created * 1000,
  lang: r.language
})

export async function reviewsFor(gameId: number): Promise<ReviewsInfo | null> {
  const hit = reviewCache.get(gameId)
  if (hit && Date.now() - hit.at < TTL) return hit.data
  const appid = steamAppIdFor(gameId)
  if (!appid) return null
  const [all, pt] = await Promise.all([page(appid, 'all', 1), page(appid, 'brazilian', 8)])
  let reviews = pt.reviews.map(toReview).filter((r) => r.text.length > 20)
  if (reviews.length < 5) {
    const en = await page(appid, 'english', 8).catch(() => ({ reviews: [] as RawReview[] }))
    reviews = [...reviews, ...en.reviews.map(toReview).filter((r) => r.text.length > 20)].slice(0, 8)
  }
  const s = all.summary
  const data: ReviewsInfo = {
    total: s?.total_reviews ?? 0,
    pct: s?.total_reviews ? Math.round((100 * (s.total_positive ?? 0)) / s.total_reviews) : null,
    label: s?.review_score_desc ?? null,
    reviews
  }
  reviewCache.set(gameId, { at: Date.now(), data })
  return data
}

const decode = (s: string): string =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

/** Itens em alta na Oficina (null = o jogo não é da Steam; [] = não tem Oficina ou nada em alta). */
export async function workshopFor(gameId: number): Promise<WorkshopItem[] | null> {
  const hit = workshopCache.get(gameId)
  if (hit && Date.now() - hit.at < TTL) return hit.data
  const appid = steamAppIdFor(gameId)
  if (!appid) return null
  const res = await fetchRetry(
    `https://steamcommunity.com/workshop/browse/?appid=${appid}&browsesort=trend&section=readytouseitems&actualsort=trend&p=1&days=90`,
    { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' } }
  )
  if (!res.ok) throw new Error(String(res.status))
  const html = await res.text()
  const items: WorkshopItem[] = []
  const seen = new Set<string>()
  // Cada item é um link para filedetails com a imagem de prévia e o título no alt.
  const re = /filedetails\/\?id=(\d+)"[^>]*>\s*<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && items.length < 24) {
    if (seen.has(m[1])) continue
    seen.add(m[1])
    items.push({ id: m[1], image: decode(m[2]), title: decode(m[3]) || 'Item da Oficina', url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${m[1]}` })
  }
  workshopCache.set(gameId, { at: Date.now(), data: items })
  return items
}
