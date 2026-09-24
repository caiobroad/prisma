import { memo, useMemo, useState } from 'react'
import type { Game } from '@shared/types'
import { GameCard } from '../components/GameCard'
import { ScrollView } from '../components/ScrollView'
import { ShelfRow as Shelf } from '../components/ShelfRow'
import { formatBytes, formatHours, PF, totalPlaytime } from '../lib/format'
import { useStore } from '../lib/store'
import { realFranchise } from '../lib/search'

interface Props {
  heroKey: string | null
  onOpen: (g: Game, key: string) => void
  onHover: (g: Game | null) => void
  onLibrary: () => void
}

const yearOf = (g: Game): number | null => (g.releaseDate ? new Date(g.releaseDate).getFullYear() : null)
const byTime = (a: Game, b: Game): number => totalPlaytime(b) - totalPlaytime(a)

/** Nome de franquia: o da loja; sem ele, o prefixo antes de ":" ou de um número quando dois jogos o dividem. */
function franchiseKey(g: Game): string | null {
  const real = realFranchise(g)
  if (real) return real
  const m = g.title.match(/^(.{3,}?)(?:\s*[:\-–]\s|\s+(?:\d+|II|III|IV|V|VI)\b)/)
  return m ? m[1].trim() : null
}

/**
 * Coleção: a biblioteca como estante premium. Franquias, anos de lançamento, o que mais
 * você jogou e quanto da coleção já foi concluído. Só as prateleiras visíveis pintam
 * (content-visibility), então a página continua leve com mais de 1000 jogos.
 */
export function CollectionView({ heroKey, onOpen, onHover, onLibrary }: Props) {
  const games = useStore((s) => s.games)
  const [year, setYear] = useState<number | null>(null)

  const data = useMemo(() => {
    const real = games.filter((g) => g.id < 1_000_000)
    const secs = real.reduce((n, g) => n + totalPlaytime(g), 0)
    const played = real.filter((g) => totalPlaytime(g) > 0)
    const completed = real.filter((g) => g.completed)
    const achT = real.reduce((n, g) => n + g.achievementsTotal, 0)
    const achU = real.reduce((n, g) => n + g.achievementsUnlocked, 0)
    const size = real.reduce((n, g) => n + (g.installed ? (g.installSize ?? 0) : 0), 0)

    // Franquias com pelo menos dois jogos, ordenadas pelo tempo investido.
    const fr = new Map<string, Game[]>()
    for (const g of real) {
      const k = franchiseKey(g)
      if (!k) continue
      const list = fr.get(k) ?? []
      list.push(g)
      fr.set(k, list)
    }
    const franchises = [...fr.entries()]
      .filter(([, l]) => l.length >= 2)
      .map(([name, list]) => ({
        name,
        list: [...list].sort((a, b) => (yearOf(a) ?? 9999) - (yearOf(b) ?? 9999) || a.title.localeCompare(b.title, 'pt-BR')),
        secs: list.reduce((n, g) => n + totalPlaytime(g), 0),
        done: list.filter((g) => g.completed).length,
        played: list.filter((g) => totalPlaytime(g) > 0).length
      }))
      .sort((a, b) => b.secs - a.secs || b.list.length - a.list.length)

    const years = new Map<number, Game[]>()
    for (const g of real) {
      const y = yearOf(g)
      if (!y) continue
      const l = years.get(y) ?? []
      l.push(g)
      years.set(y, l)
    }
    const yearList = [...years.entries()].sort((a, b) => b[0] - a[0])
    const yearMax = Math.max(1, ...yearList.map(([, l]) => l.length))

    const genres = new Map<string, number>()
    for (const g of played) for (const x of g.genres.slice(0, 3)) genres.set(x, (genres.get(x) ?? 0) + totalPlaytime(g))
    const topGenres = [...genres.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)

    const platforms = new Map<string, number>()
    for (const g of real) platforms.set(g.platform, (platforms.get(g.platform) ?? 0) + 1)

    return {
      total: real.length,
      secs,
      played: played.length,
      completed: completed.length,
      completion: played.length ? completed.length / played.length : 0,
      ach: achT ? achU / achT : 0,
      achU,
      size,
      franchises,
      yearList,
      yearMax,
      topPlayed: [...played].sort(byTime).slice(0, 10),
      topGenres,
      platforms: [...platforms.entries()].sort((a, b) => b[1] - a[1]),
      completedList: [...completed].sort(byTime)
    }
  }, [games])

  const yearGames = useMemo(
    () => (year == null ? [] : (data.yearList.find(([y]) => y === year)?.[1] ?? []).slice().sort(byTime)),
    [year, data.yearList]
  )
  const maxPlayed = data.topPlayed[0] ? totalPlaytime(data.topPlayed[0]) : 1

  return (
    <ScrollView>
      <header className="view-head">
        <div className="view-title">
          <p className="eyebrow">Biblioteca</p>
          <h1>Coleção</h1>
          <p>Sua estante: franquias, épocas e tudo o que você já zerou.</p>
        </div>
        <div className="toolbar">
          <button className="btn ghost sm" onClick={onLibrary}>
            Ver todos os jogos
          </button>
        </div>
      </header>

      <div className="col-hero glass">
        <Ring value={data.completion} label="da coleção jogada concluída" big={`${Math.round(data.completion * 100)}%`} />
        <div className="col-kpis">
          <Kpi v={data.total.toLocaleString('pt-BR')} k="jogos na coleção" />
          <Kpi v={formatHours(data.secs)} k="tempo total" />
          <Kpi v={`${data.played}`} k="já jogados" />
          <Kpi v={`${data.completed}`} k="concluídos" />
          <Kpi v={`${Math.round(data.ach * 100)}%`} k={`conquistas (${data.achU.toLocaleString('pt-BR')})`} />
          <Kpi v={formatBytes(data.size)} k="instalados em disco" />
        </div>
      </div>

      <div className="col-grid">
        <section className="glass card pad">
          <h2>Mais jogados</h2>
          <ol className="col-top">
            {data.topPlayed.map((g, i) => (
              <li key={g.id}>
                <button onClick={() => onOpen(g, `ctop-${g.id}`)}>
                  <em>{i + 1}</em>
                  <span className="col-top-name">{g.title}</span>
                  <i>
                    <b style={{ width: `${(100 * totalPlaytime(g)) / maxPlayed}%` }} />
                  </i>
                  <span className="col-top-h">{formatHours(totalPlaytime(g))}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
        <section className="glass card pad">
          <h2>Seu gosto</h2>
          <ul className="col-genres">
            {data.topGenres.map(([name, s]) => (
              <li key={name}>
                <span>{name}</span>
                <i>
                  <b style={{ width: `${(100 * s) / (data.topGenres[0]?.[1] || 1)}%` }} />
                </i>
                <em>{formatHours(s)}</em>
              </li>
            ))}
          </ul>
          <div className="col-pf">
            {data.platforms.map(([p, n]) => (
              <span key={p} className="chip" style={{ '--c': PF[p as keyof typeof PF].color } as React.CSSProperties}>
                <i />
                {PF[p as keyof typeof PF].name} <em>{n}</em>
              </span>
            ))}
          </div>
        </section>
      </div>

      <section className="block col-years">
        <div className="section-head">
          <h2>Por ano de lançamento</h2>
          {year ? (
            <button className="link" onClick={() => setYear(null)}>
              Fechar {year}
            </button>
          ) : (
            <span className="muted small">Escolha um ano</span>
          )}
        </div>
        <div className="year-bars" role="list">
          {data.yearList.map(([y, l]) => (
            <button key={y} role="listitem" className={`year-bar ${year === y ? 'on' : ''}`} onClick={() => setYear(year === y ? null : y)} title={`${l.length} jogos de ${y}`}>
              <i style={{ height: `${12 + (88 * l.length) / data.yearMax}%` }} />
              <span>{String(y).slice(2)}</span>
            </button>
          ))}
        </div>
        {year ? <ShelfRow id={`year-${year}`} list={yearGames} heroKey={heroKey} onOpen={onOpen} onHover={onHover} /> : null}
      </section>

      {data.completedList.length ? (
        <section className="block col-shelf">
          <div className="section-head">
            <h2>Concluídos</h2>
            <span className="muted small">{data.completedList.length} jogos</span>
          </div>
          <ShelfRow id="done" list={data.completedList.slice(0, 16)} heroKey={heroKey} onOpen={onOpen} onHover={onHover} />
        </section>
      ) : null}

      <div className="section-head col-fr-head">
        <h2>Franquias</h2>
        <span className="muted small">{data.franchises.length} séries na estante</span>
      </div>
      {data.franchises.slice(0, 30).map((f) => (
        <section key={f.name} className="block col-shelf">
          <div className="section-head">
            <h3>{f.name}</h3>
            <span className="muted small">
              {f.list.length} jogos · {f.played} jogados · {f.done} concluídos · {formatHours(f.secs)}
            </span>
          </div>
          <div className="col-progress">
            <b style={{ width: `${(100 * f.played) / f.list.length}%` }} />
          </div>
          <ShelfRow id={`fr-${f.name}`} list={f.list.slice(0, 16)} heroKey={heroKey} onOpen={onOpen} onHover={onHover} />
        </section>
      ))}
    </ScrollView>
  )
}

const ShelfRow = memo(function ShelfRow({ id, list, heroKey, onOpen, onHover }: { id: string; list: Game[]; heroKey: string | null; onOpen: Props['onOpen']; onHover: Props['onHover'] }) {
  return (
    <Shelf className="col-row" onLeave={() => onHover(null)}>
      {list.map((g) => (
        <GameCard key={g.id} game={g} vtKey={`${id}-${g.id}`} isHero={heroKey === `${id}-${g.id}`} onOpen={onOpen} onHover={onHover} />
      ))}
      <span className="shelf-wood" aria-hidden="true" />
    </Shelf>
  )
})

function Kpi({ v, k }: { v: string; k: string }) {
  return (
    <div className="kpi">
      <b>{v}</b>
      <span>{k}</span>
    </div>
  )
}

function Ring({ value, big, label }: { value: number; big: string; label: string }) {
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <div className="ring">
      <svg viewBox="0 0 128 128" width={128} height={128}>
        <circle cx="64" cy="64" r={r} className="ring-bg" />
        <circle cx="64" cy="64" r={r} className="ring-fg" strokeDasharray={`${c * Math.min(1, value)} ${c}`} transform="rotate(-90 64 64)" />
      </svg>
      <div>
        <b>{big}</b>
        <span>{label}</span>
      </div>
    </div>
  )
}
