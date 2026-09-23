import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import type { Game, Platform } from '@shared/types'
import { GameCard } from '../components/GameCard'
import { ScrollView } from '../components/ScrollView'
import { VirtualGrid } from '../components/VirtualGrid'
import { lastActivity, PF, totalPlaytime } from '../lib/format'
import { scan, useStore } from '../lib/store'

type Sort = 'name' | 'recent' | 'playtime' | 'added'
type Status = 'all' | 'installed' | 'library'

interface Props {
  query: string
  platform: Platform | 'all'
  onPlatform: (p: Platform | 'all') => void
  heroKey: string | null
  onOpen: (g: Game, key: string) => void
  onHover: (g: Game | null) => void
  onAdd: () => void
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

const PLATFORMS: Platform[] = ['steam', 'epic', 'gog', 'xbox', 'manual']
const byName = (a: Game, b: Game): number => a.title.localeCompare(b.title, 'pt-BR')

export function LibraryView({ query, platform, onPlatform, heroKey, onOpen, onHover, onAdd }: Props) {
  const games = useStore((s) => s.games)
  const loaded = useStore((s) => s.loaded)
  const scanning = useStore((s) => s.scanning)
  const [sort, setSort] = useState<Sort>('name')
  const [status, setStatus] = useState<Status>('all')
  // Digitar não trava a grade: o filtro roda com prioridade baixa.
  const q = normalize(useDeferredValue(query).trim())

  // Índice de busca normalizado uma vez por lista, não a cada tecla.
  const index = useMemo(() => new Map(games.map((g) => [g.id, normalize(`${g.title} ${PF[g.platform].name} ${g.developer ?? ''}`)])), [games])

  const list = useMemo(() => {
    const words = q.split(/\s+/).filter(Boolean)
    const out = games.filter((g) => {
      if (platform !== 'all' && g.platform !== platform) return false
      if (status === 'installed' && !g.installed) return false
      if (status === 'library' && g.installed) return false
      if (!words.length) return true
      const hay = index.get(g.id) ?? ''
      return words.every((w) => hay.includes(w))
    })
    const cmp: Record<Sort, (a: Game, b: Game) => number> = {
      name: byName,
      recent: (a, b) => lastActivity(b) - lastActivity(a) || byName(a, b),
      playtime: (a, b) => totalPlaytime(b) - totalPlaytime(a) || byName(a, b),
      added: (a, b) => b.addedAt - a.addedAt || byName(a, b)
    }
    return out.sort(cmp[sort])
  }, [games, index, q, platform, status, sort])

  const counts = useMemo(() => {
    const inPf = games.filter((g) => platform === 'all' || g.platform === platform)
    const installed = inPf.filter((g) => g.installed).length
    return { total: inPf.length, installed, present: PLATFORMS.filter((p) => games.some((g) => g.platform === p)) }
  }, [games, platform])

  const render = useCallback(
    (g: Game) => <GameCard game={g} vtKey={`lib-${g.id}`} isHero={heroKey === `lib-${g.id}`} onOpen={onOpen} onHover={onHover} />,
    [heroKey, onOpen, onHover]
  )

  return (
    <ScrollView>
      <header className="view-head">
        <div className="view-title">
          <h1>{platform === 'all' ? 'Biblioteca' : PF[platform].name}</h1>
          <p>
            {counts.total.toLocaleString('pt-BR')} jogos · {counts.installed} instalados · {(counts.total - counts.installed).toLocaleString('pt-BR')} na biblioteca
          </p>
        </div>
        <div className="toolbar">
          <div className="segmented" role="tablist" aria-label="Filtrar por estado">
            {(
              [
                ['all', 'Todos'],
                ['installed', 'Instalados'],
                ['library', 'Na Biblioteca']
              ] as Array<[Status, string]>
            ).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={status === id} className={status === id ? 'on' : ''} onClick={() => setStatus(id)}>
                {label}
              </button>
            ))}
          </div>
          <label className="select">
            <span>Ordenar</span>
            <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="name">Nome</option>
              <option value="recent">Jogado recentemente</option>
              <option value="playtime">Tempo de jogo</option>
              <option value="added">Adicionado</option>
            </select>
          </label>
        </div>
      </header>

      <div className="chips">
        <button className={`chip ${platform === 'all' ? 'on' : ''}`} onClick={() => onPlatform('all')}>
          Todas as plataformas
        </button>
        {counts.present.map((p) => (
          <button key={p} className={`chip ${platform === p ? 'on' : ''}`} style={{ '--c': PF[p].color } as React.CSSProperties} onClick={() => onPlatform(p)}>
            <i />
            {PF[p].name}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="empty glass">
          {games.length === 0 ? (
            <>
              <b>{loaded && !scanning ? 'Nenhum jogo ainda' : 'Procurando seus jogos…'}</b>
              <span>O Prisma lê as bibliotecas da Steam, Epic Games, GOG e Xbox desta máquina.</span>
              <div className="row">
                <button className="btn" onClick={() => void scan()} disabled={scanning}>
                  Sincronizar
                </button>
                <button className="btn ghost" onClick={onAdd}>
                  Adicionar .exe
                </button>
              </div>
            </>
          ) : (
            <>
              <b>Nenhum jogo encontrado{q ? ` para “${query.trim()}”` : ''}</b>
              <span>Tente outro nome ou mude os filtros.</span>
            </>
          )}
        </div>
      ) : (
        <VirtualGrid items={list} keyOf={(g) => g.id} render={render} onLeave={() => onHover(null)} />
      )}
    </ScrollView>
  )
}
