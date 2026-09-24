import type { Game, Platform } from '@shared/types'
import { PF, platformName, totalPlaytime } from './format'

/**
 * Busca inteligente. Texto livre procura em título, desenvolvedora, franquia e tags;
 * filtros podem ser digitados ou escolhidos nas sugestões:
 *   genero:rpg  plataforma:steam  franquia:resident  ano:2020  ano:2015-2020  ano>2018
 *   nota>80  instalado  !instalado  concluido  favorito  roda (requisitos mínimos x sua RAM)
 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export interface Filter {
  key: string
  label: string
  test: (g: Game, ramGb: number) => boolean
}

const PLATFORM_ALIASES: Record<string, Platform> = {
  steam: 'steam',
  epic: 'epic',
  'epic games': 'epic',
  gog: 'gog',
  xbox: 'xbox',
  'game pass': 'xbox',
  manual: 'manual'
}

/** Franquia de verdade: a Steam às vezes marca a distribuidora ("WB Games") como franquia. */
export function realFranchise(g: Game): string | null {
  if (!g.franchise) return null
  const k = (s: string | null): string => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const f = k(g.franchise)
  if (f === k(g.publisher) || f === k(g.developer) || /games|digital|studios?|entertainment|interactive|publishing/i.test(g.franchise)) return null
  return g.franchise
}

/**
 * O que conta como gênero de um jogo: os gêneros oficiais da loja e só as 5 tags mais votadas.
 * As tags da Steam vão até 20 e as últimas são ruído ("Terror" é a 17ª do VRChat).
 */
export function genreTags(g: Game): string[] {
  return [...g.genres, ...g.tags.slice(0, 5)]
}

const plural = (n: number): string => `${n} ${n === 1 ? 'jogo' : 'jogos'}`

const yearOf = (g: Game): number | null => (g.releaseDate ? new Date(g.releaseDate).getFullYear() : null)
const rating = (g: Game): number | null => g.reviewPct ?? g.metacritic ?? null

/** Um token vira filtro (ou null, se for texto livre). */
export function tokenFilter(tok: string): Filter | null {
  const t = normalize(tok)
  const neg = t.startsWith('!') || t.startsWith('-')
  const body = neg ? t.slice(1) : t
  const wrap = (f: Filter): Filter => (neg ? { key: tok, label: `não ${f.label}`, test: (g, r) => !f.test(g, r) } : f)

  if (/^instalados?$/.test(body)) return wrap({ key: tok, label: 'instalado', test: (g) => g.installed })
  if (/^conclu[ií]dos?$/.test(body)) return wrap({ key: tok, label: 'concluído', test: (g) => g.completed })
  if (/^favoritos?$/.test(body)) return wrap({ key: tok, label: 'favorito', test: (g) => g.favorite })
  if (/^jogados?$/.test(body)) return wrap({ key: tok, label: 'já jogado', test: (g) => totalPlaytime(g) > 0 })
  if (/^roda$|^requisitos$/.test(body))
    return wrap({ key: tok, label: 'roda neste PC', test: (g, ram) => g.minRamGb != null && ram > 0 && g.minRamGb <= ram })

  let m = body.match(/^(genero|tag|g):(.+)$/)
  if (m) {
    const v = m[2].replace(/_/g, ' ')
    return wrap({ key: tok, label: `gênero ${v}`, test: (g) => genreTags(g).some((x) => normalize(x).includes(v)) })
  }
  m = body.match(/^(plataforma|pf|loja):(.+)$/)
  if (m) {
    const p = PLATFORM_ALIASES[m[2]] ?? (Object.keys(PF) as Platform[]).find((k) => normalize(PF[k].name).startsWith(m![2]))
    return p ? wrap({ key: tok, label: PF[p].name, test: (g) => g.platform === p }) : null
  }
  m = body.match(/^(franquia|serie|f):(.+)$/)
  if (m) {
    const v = m[2].replace(/_/g, ' ')
    return wrap({ key: tok, label: `franquia ${v}`, test: (g) => normalize(g.franchise ?? '').includes(v) || normalize(g.title).includes(v) })
  }
  m = body.match(/^ano([:<>=]+)(\d{4})(?:-(\d{4}))?$/)
  if (m) {
    const [, op, a, b] = m
    const y1 = Number(a)
    const y2 = b ? Number(b) : null
    return wrap({
      key: tok,
      label: y2 ? `${y1}–${y2}` : `${op === ':' ? '' : op}${y1}`,
      test: (g) => {
        const y = yearOf(g)
        if (y == null) return false
        if (y2) return y >= y1 && y <= y2
        if (op.startsWith('>')) return op.includes('=') ? y >= y1 : y > y1
        if (op.startsWith('<')) return op.includes('=') ? y <= y1 : y < y1
        return y === y1
      }
    })
  }
  m = body.match(/^(nota|avaliacao|rating)([:<>=]+)(\d{1,3})$/)
  if (m) {
    const [, , op, n] = m
    const v = Number(n)
    return wrap({
      key: tok,
      label: `nota ${op === ':' ? '≥' : op}${v}`,
      test: (g) => {
        const r = rating(g)
        if (r == null) return false
        return op.startsWith('<') ? r < v : r >= v
      }
    })
  }
  return null
}

export interface ParsedQuery {
  words: string[]
  filters: Filter[]
}

// "franquia:"resident evil"" com aspas vira um token só.
const tokens = (q: string): string[] => q.match(/[^\s"]+:"[^"]*"|"[^"]*"|\S+/g) ?? []
const tokenKey = (raw: string): string => raw.replace(/"/g, '').replace(/:(.+)/, (_, v: string) => ':' + v.replace(/\s+/g, '_'))

/** Tira um filtro da busca (chip removido). */
export function removeFilter(q: string, key: string): string {
  return tokens(q)
    .filter((raw) => tokenKey(raw) !== key)
    .join(' ')
}

export function parseQuery(q: string): ParsedQuery {
  const words: string[] = []
  const filters: Filter[] = []
  for (const raw of tokens(q)) {
    const tok = tokenKey(raw)
    const f = tokenFilter(tok)
    if (f) filters.push(f)
    else words.push(normalize(raw.replace(/"/g, '')))
  }
  return { words: words.filter(Boolean), filters }
}

export function searchIndex(g: Game): string {
  return normalize(`${g.title} ${platformName(g)}${g.emuSystem ? ' emulador' : ''} ${g.developer ?? ''} ${g.publisher ?? ''} ${g.franchise ?? ''} ${genreTags(g).join(' ')}`)
}

export function matches(g: Game, hay: string, p: ParsedQuery, ramGb: number): boolean {
  for (const f of p.filters) if (!f.test(g, ramGb)) return false
  return p.words.every((w) => hay.includes(w))
}

export interface Suggestion {
  kind: 'game' | 'filter' | 'history'
  label: string
  hint?: string
  /** Texto que substitui a busca ao escolher. */
  value: string
  game?: Game
}

/** Sugestões enquanto digita: jogos pelo título, filtros que casam com a última palavra e buscas recentes. */
export function suggest(q: string, games: Game[], history: string[]): Suggestion[] {
  const t = normalize(q.trim())
  if (!t) return history.slice(0, 6).map((h) => ({ kind: 'history', label: h, value: h }))
  const out: Suggestion[] = []
  const last = t.split(/\s+/).pop() ?? ''
  const head = q.trim().slice(0, q.trim().length - last.length)

  const titles = games
    .filter((g) => g.id < 1_000_000)
    .map((g) => ({ g, n: normalize(g.title) }))
    .filter((x) => x.n.includes(t))
    .sort((a, b) => Number(!a.n.startsWith(t)) - Number(!b.n.startsWith(t)) || totalPlaytime(b.g) - totalPlaytime(a.g))
    .slice(0, 5)
  for (const { g } of titles) out.push({ kind: 'game', label: g.title, hint: PF[g.platform].name, value: g.title, game: g })

  if (last.length >= 2 && !last.includes(':')) {
    const genres = new Map<string, number>()
    const franchises = new Map<string, number>()
    for (const g of games) {
      for (const x of new Set(genreTags(g))) if (normalize(x).startsWith(last)) genres.set(x, (genres.get(x) ?? 0) + 1)
      const fr = realFranchise(g)
      if (fr && normalize(fr).includes(last)) franchises.set(fr, (franchises.get(fr) ?? 0) + 1)
    }
    const top = (m: Map<string, number>, n: number): Array<[string, number]> => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
    for (const [name] of top(genres, 3)) {
      const key = `genero:${normalize(name).replace(/\s+/g, '_')}`
      // A contagem é a do próprio filtro, para o número bater com o resultado.
      const f = tokenFilter(key)
      const n = f ? games.filter((g) => f.test(g, 0)).length : 0
      out.push({ kind: 'filter', label: `Gênero: ${name}`, hint: plural(n), value: `${head}${key} ` })
    }
    for (const [name, n] of top(franchises, 2))
      out.push({ kind: 'filter', label: `Franquia: ${name}`, hint: plural(n), value: `${head}franquia:"${name}" ` })
    for (const p of Object.keys(PF) as Platform[])
      if (normalize(PF[p].name).startsWith(last)) out.push({ kind: 'filter', label: `Plataforma: ${PF[p].name}`, value: `${head}plataforma:${p} ` })
    const flags: Array<[string, string]> = [
      ['instalado', 'Só instalados'],
      ['concluido', 'Concluídos'],
      ['favorito', 'Favoritos'],
      ['roda', 'Roda neste PC (requisitos mínimos)']
    ]
    for (const [k, label] of flags) if (k.startsWith(last)) out.push({ kind: 'filter', label, value: `${head}${k} ` })
    if ('ano'.startsWith(last) || /^\d{2,4}$/.test(last)) out.push({ kind: 'filter', label: 'Ano de lançamento', hint: 'ano:2020 · ano>2018 · ano:2015-2020', value: `${head}ano:${/^\d{4}$/.test(last) ? last : ''}` })
    if ('nota'.startsWith(last)) out.push({ kind: 'filter', label: 'Nota mínima', hint: 'nota>80', value: `${head}nota>80 ` })
  }
  for (const h of history) if (normalize(h).startsWith(t) && normalize(h) !== t && out.length < 10) out.push({ kind: 'history', label: h, value: h })
  return out.slice(0, 10)
}
