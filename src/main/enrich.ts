import { net } from 'electron'
import { detailsState, gamesNeedingDetails, gamesNeedingStore, getSetting, markStoreFetched, saveStoreData, saveTags, setSetting } from './db/games'
import { ensureDetails } from './meta'
import { anyRunning } from './sessions'

/**
 * Enriquecimento em segundo plano, sem pressa e sem atrapalhar:
 * - tags, avaliação e lançamento da Steam em lotes de 50 (IStoreBrowseService/GetItems);
 * - descrição, trailer e requisitos jogo a jogo, um a cada 2 s.
 * Pausa enquanto um jogo roda e recua 1 minuto quando a loja limita as requisições.
 */
type Progress = (done: number, total: number) => void

interface StoreItem {
  appid?: number
  id?: number
  tags?: Array<{ tagid: number; weight: number }>
  tagids?: number[]
  reviews?: { summary_filtered?: { review_count?: number; percent_positive?: number; review_score_label?: string } }
  release?: { steam_release_date?: number; original_release_date?: number }
}

export interface StoreData {
  tags: string[]
  reviewPct: number | null
  reviewLabel: string | null
  reviewCount: number | null
  releaseDate: number | null
}

let tagNames: Map<number, string> | null = null

/** Nomes das tags da Steam em português (cache de 7 dias no banco). */
export async function loadTagNames(): Promise<Map<number, string>> {
  if (tagNames) return tagNames
  const cached = getSetting('steam:tagnames')
  if (cached) {
    try {
      const o = JSON.parse(cached) as { at: number; tags: Array<[number, string]> }
      if (Date.now() - o.at < 7 * 86400_000) return (tagNames = new Map(o.tags))
    } catch {
      /* cache corrompido */
    }
  }
  const res = await net.fetch('https://store.steampowered.com/tagdata/populartags/brazilian')
  if (!res.ok) throw new Error(String(res.status))
  const list = (await res.json()) as Array<{ tagid: number; name: string }>
  const pairs = list.map((t) => [t.tagid, t.name.trim()] as [number, string])
  setSetting('steam:tagnames', JSON.stringify({ at: Date.now(), tags: pairs }))
  return (tagNames = new Map(pairs))
}

/** Tags (em ordem de relevância), avaliação e data de lançamento de até 50 apps por chamada. */
export async function fetchStoreItems(appids: string[]): Promise<Map<string, StoreData>> {
  const names = await loadTagNames()
  const input = {
    ids: appids.map((a) => ({ appid: Number(a) })),
    context: { language: 'brazilian', country_code: 'BR' },
    data_request: { include_tag_count: 20, include_reviews: true, include_release: true }
  }
  const res = await net.fetch(
    'https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=' + encodeURIComponent(JSON.stringify(input))
  )
  if (!res.ok) throw new Error(String(res.status))
  const json = (await res.json()) as { response?: { store_items?: StoreItem[] } }
  const out = new Map<string, StoreData>()
  for (const it of json.response?.store_items ?? []) {
    const id = String(it.appid ?? it.id ?? '')
    if (!id) continue
    const ids = it.tags ? [...it.tags].sort((a, b) => b.weight - a.weight).map((t) => t.tagid) : (it.tagids ?? [])
    const tags = ids.map((t) => names.get(t)).filter((t): t is string => !!t)
    const r = it.reviews?.summary_filtered
    const rel = it.release?.original_release_date || it.release?.steam_release_date || 0
    out.set(id, {
      tags,
      reviewPct: r?.review_count ? (r.percent_positive ?? null) : null,
      reviewLabel: r?.review_count ? (r.review_score_label ?? null) : null,
      reviewCount: r?.review_count ?? null,
      releaseDate: rel > 0 ? rel * 1000 : null
    })
    if (tags.length) saveTags(id, tags)
  }
  return out
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

let running = false

export function startEnrichment(onProgress: Progress, onChanged: () => void): void {
  if (running) return
  running = true
  void (async () => {
    try {
      await waitIdle()
      await storePass(onChanged)
      await detailsPass(onProgress, onChanged)
    } finally {
      running = false
    }
  })()
}

async function waitIdle(): Promise<void> {
  while (anyRunning()) await sleep(30_000)
}

async function storePass(onChanged: () => void): Promise<void> {
  const pending = gamesNeedingStore()
  for (let i = 0; i < pending.length; i += 50) {
    await waitIdle()
    const batch = pending.slice(i, i + 50)
    try {
      const data = await fetchStoreItems([...new Set(batch.map((b) => b.appid))])
      for (const b of batch) {
        const d = data.get(b.appid)
        if (d) saveStoreData(b.id, d)
        else markStoreFetched(b.id)
      }
      onChanged()
    } catch {
      await sleep(60_000)
    }
    await sleep(1500)
  }
}

async function detailsPass(onProgress: Progress, onChanged: () => void): Promise<void> {
  const ids = gamesNeedingDetails()
  let done = 0
  let failures = 0
  let dirty = 0
  for (const id of ids) {
    await waitIdle()
    await ensureDetails(id)
    done++
    if (!detailsState(id).fetched) {
      // Limite da loja ou sem internet: recua; depois de várias falhas, desiste até a próxima abertura.
      if (++failures >= 5) break
      await sleep(60_000)
      continue
    }
    failures = 0
    if (++dirty >= 25) {
      dirty = 0
      onChanged()
    }
    if (done % 10 === 0) onProgress(done, ids.length)
    await sleep(2000)
  }
  // Jogos de outras lojas ganharam steam_ref pelo título: agora dá para buscar tags e avaliação deles.
  await storePass(onChanged)
  if (dirty) onChanged()
  onProgress(ids.length, ids.length)
}
