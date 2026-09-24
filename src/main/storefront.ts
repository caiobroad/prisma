import { net } from 'electron'
import type { StoreData, StoreItem, StoreSection } from '@shared/types'
import { getDb } from './db'
import { loadSettings } from './settings'

/**
 * Loja: vitrines da Steam (ofertas, mais vendidos, lançamentos, em breve) e da Epic (grátis
 * da semana e promoções), com preço em reais. Com a chave do IsThereAnyDeal, cada item ganha
 * o menor preço histórico (Steam e Epic, no Brasil). O SteamDB não permite uso por apps.
 */
const ITAD = 'https://api.isthereanydeal.com'
const SHOPS = '61,16' // Steam, Epic Game Store
const TTL = 30 * 60_000
let cache: { at: number; data: StoreData } | null = null

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await net.fetch(url, init)
  if (!res.ok) throw new Error(`${res.status}`)
  return (await res.json()) as T
}

/** appids da Steam e títulos (normalizados) que o usuário já tem. */
function ownedIndex(): { steam: Set<string>; titles: Set<string> } {
  const rows = getDb().prepare('SELECT platform, platform_id, title FROM games').all() as unknown as Array<{ platform: string; platform_id: string; title: string }>
  return {
    steam: new Set(rows.filter((r) => r.platform === 'steam').map((r) => r.platform_id)),
    titles: new Set(rows.map((r) => norm(r.title)))
  }
}

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[™®©]/g, '')
    .replace(/[^a-z0-9]+/g, '')

// ---------- Steam ----------

interface SteamFeatured {
  id: number
  type: number
  name: string
  discount_percent: number
  original_price: number | null
  final_price: number
  discount_expiration?: number
  header_image?: string
  large_capsule_image?: string
}

function steamItem(x: SteamFeatured): StoreItem {
  const isApp = x.type === 0
  return {
    key: `steam:${x.type}:${x.id}`,
    shop: 'steam',
    title: x.name,
    image: x.header_image ?? x.large_capsule_image ?? null,
    url: `https://store.steampowered.com/${isApp ? 'app' : 'sub'}/${x.id}`,
    price: typeof x.final_price === 'number' ? x.final_price : null,
    regular: x.original_price ?? null,
    cut: x.discount_percent ?? 0,
    until: x.discount_expiration ? x.discount_expiration * 1000 : null,
    steamAppId: isApp ? String(x.id) : null,
    low: null,
    owned: false
  }
}

async function steamSections(): Promise<StoreSection[]> {
  const f = await json<Record<string, { name?: string; items?: SteamFeatured[] }>>('https://store.steampowered.com/api/featuredcategories?cc=br&l=brazilian')
  const pick = (id: string, title: string): StoreSection | null => {
    const items = (f[id]?.items ?? []).map(steamItem)
    // A mesma edição aparece mais de uma vez em algumas vitrines.
    const seen = new Set<string>()
    const uniq = items.filter((i) => (seen.has(i.key) ? false : (seen.add(i.key), true)))
    return uniq.length ? { id: `steam-${id}`, title, items: uniq } : null
  }
  return [pick('specials', 'Ofertas na Steam'), pick('top_sellers', 'Mais vendidos na Steam'), pick('new_releases', 'Lançamentos na Steam'), pick('coming_soon', 'Em breve na Steam')].filter(
    (s): s is StoreSection => !!s
  )
}

// ---------- Epic ----------

interface EpicElement {
  title: string
  productSlug?: string | null
  urlSlug?: string
  offerType?: string
  catalogNs?: { mappings?: Array<{ pageSlug: string; pageType: string }> }
  keyImages?: Array<{ type: string; url: string }>
  price?: { totalPrice?: { discountPrice: number; originalPrice: number; discount: number } }
  promotions?: {
    promotionalOffers?: Array<{ promotionalOffers: Array<{ startDate: string; endDate: string; discountSetting?: { discountPercentage: number } }> }>
    upcomingPromotionalOffers?: Array<{ promotionalOffers: Array<{ startDate: string; endDate: string }> }>
  } | null
}

async function epicSections(): Promise<StoreSection[]> {
  const r = await json<{ data?: { Catalog?: { searchStore?: { elements?: EpicElement[] } } } }>(
    'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=pt-BR&country=BR&allowCountries=BR'
  )
  const free: StoreItem[] = []
  const soon: StoreItem[] = []
  for (const e of r.data?.Catalog?.searchStore?.elements ?? []) {
    const slug = e.catalogNs?.mappings?.find((m) => m.pageType === 'productHome')?.pageSlug ?? e.productSlug ?? e.urlSlug
    if (!slug || e.offerType === 'OTHERS') continue
    const pic = (t: string): string | undefined => e.keyImages?.find((k) => k.type === t && k.url)?.url
    const img = pic('OfferImageWide') || pic('DieselStoreFrontWide') || pic('featuredMedia') || pic('Thumbnail') || e.keyImages?.find((k) => k.url)?.url || null
    const now = e.promotions?.promotionalOffers?.[0]?.promotionalOffers?.[0]
    const next = e.promotions?.upcomingPromotionalOffers?.[0]?.promotionalOffers?.[0]
    const tp = e.price?.totalPrice
    const item: StoreItem = {
      key: `epic:${slug}`,
      shop: 'epic',
      title: e.title,
      image: img,
      url: `https://store.epicgames.com/pt-BR/p/${slug}`,
      price: now ? (tp?.discountPrice ?? 0) : (tp?.originalPrice ?? null),
      regular: tp?.originalPrice ?? null,
      cut: now && tp?.originalPrice ? Math.round(100 - (100 * (tp.discountPrice ?? 0)) / tp.originalPrice) : 0,
      until: now ? Date.parse(now.endDate) : next ? Date.parse(next.startDate) : null,
      steamAppId: null,
      low: null,
      owned: false
    }
    if (now) free.push(item)
    else if (next) soon.push({ ...item, price: 0, cut: 100, upcoming: true })
  }
  const out: StoreSection[] = []
  if (free.length) out.push({ id: 'epic-now', title: 'Grátis e em promoção na Epic', items: free })
  if (soon.length) out.push({ id: 'epic-soon', title: 'Próximos grátis na Epic', items: soon })
  return out
}

// ---------- IsThereAnyDeal ----------

interface ItadPrice {
  amount: number
  amountInt?: number
  currency?: string
}
interface ItadOverview {
  prices?: Array<{
    id: string
    current?: { shop?: { id: number; name: string }; price?: ItadPrice; regular?: ItadPrice; cut?: number; url?: string } | null
    lowest?: { shop?: { id: number; name: string }; price?: ItadPrice; timestamp?: string } | null
  }>
}

const cents = (p?: ItadPrice): number | null => (p ? (typeof p.amountInt === 'number' ? p.amountInt : Math.round(p.amount * 100)) : null)

/** Preenche o menor preço histórico dos itens (Steam pelo appid, Epic pelo título). */
async function addLows(items: StoreItem[], key: string): Promise<void> {
  const ids = new Map<string, string>() // item.key → id no ITAD
  const steam = items.filter((i) => i.steamAppId)
  if (steam.length) {
    const map = await json<Record<string, string | null>>(`${ITAD}/lookup/shop/61/id/v1?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([...new Set(steam.map((i) => `app/${i.steamAppId}`))])
    })
    for (const i of steam) {
      const id = map[`app/${i.steamAppId}`]
      if (id) ids.set(i.key, id)
    }
  }
  for (const i of items.filter((x) => x.shop === 'epic').slice(0, 12)) {
    try {
      const r = await json<{ found?: boolean; game?: { id: string } }>(`${ITAD}/games/lookup/v1?key=${encodeURIComponent(key)}&title=${encodeURIComponent(i.title)}`)
      if (r.found && r.game) ids.set(i.key, r.game.id)
    } catch {
      /* jogo que o ITAD não conhece */
    }
  }
  const uniq = [...new Set(ids.values())]
  const lows = new Map<string, StoreItem['low']>()
  for (let k = 0; k < uniq.length; k += 150) {
    const ov = await json<ItadOverview>(`${ITAD}/games/overview/v2?key=${encodeURIComponent(key)}&country=BR&shops=${SHOPS}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(uniq.slice(k, k + 150))
    })
    for (const p of ov.prices ?? []) {
      const price = cents(p.lowest?.price)
      if (price != null) lows.set(p.id, { price, shop: p.lowest?.shop?.name ?? '', when: p.lowest?.timestamp ? Date.parse(p.lowest.timestamp) : null })
    }
  }
  for (const i of items) {
    const id = ids.get(i.key)
    if (id) i.low = lows.get(id) ?? null
  }
}

function markOwned(items: StoreItem[]): void {
  const o = ownedIndex()
  for (const i of items) i.owned = (i.steamAppId != null && o.steam.has(i.steamAppId)) || o.titles.has(norm(i.title))
}

export async function loadStore(force = false): Promise<StoreData> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache.data
  const [s, e] = await Promise.allSettled([steamSections(), epicSections()])
  const sections = [...(s.status === 'fulfilled' ? s.value : []), ...(e.status === 'fulfilled' ? e.value : [])]
  const all = sections.flatMap((x) => x.items)
  markOwned(all)
  const key = loadSettings().itadKey.trim()
  let itad: StoreData['itad'] = key ? 'ok' : 'no-key'
  let message: string | null = key ? null : 'Adicione a chave do IsThereAnyDeal em Ajustes para ver o menor preço histórico.'
  if (key) {
    try {
      await addLows(all, key)
    } catch (err) {
      itad = 'error'
      message = /403|401/.test(String((err as Error).message)) ? 'A chave do IsThereAnyDeal foi recusada.' : 'O IsThereAnyDeal não respondeu agora.'
    }
  }
  if (!sections.length) message = 'Não foi possível carregar as lojas agora. Verifique a conexão.'
  const data: StoreData = { sections, itad, message }
  if (sections.length) cache = { at: Date.now(), data }
  return data
}

/** Busca na Steam (preço em reais) com menor preço histórico, se houver chave. */
export async function searchStore(term: string): Promise<StoreItem[]> {
  const t = term.trim()
  if (t.length < 2) return []
  const r = await json<{ items?: Array<{ id: number; name: string; type: string; price?: { initial: number; final: number }; tiny_image?: string }> }>(
    `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(t)}&l=brazilian&cc=BR`
  )
  const items: StoreItem[] = (r.items ?? []).slice(0, 20).map((x) => ({
    key: `steam:0:${x.id}`,
    shop: 'steam',
    title: x.name,
    image: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${x.id}/header.jpg`,
    url: `https://store.steampowered.com/app/${x.id}`,
    price: x.price ? x.price.final : 0,
    regular: x.price ? x.price.initial : 0,
    cut: x.price && x.price.initial ? Math.round(100 - (100 * x.price.final) / x.price.initial) : 0,
    until: null,
    steamAppId: String(x.id),
    low: null,
    owned: false
  }))
  markOwned(items)
  const key = loadSettings().itadKey.trim()
  if (key) await addLows(items, key).catch(() => undefined)
  return items
}
