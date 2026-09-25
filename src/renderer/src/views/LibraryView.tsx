import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { EMU_SYSTEMS, type EmuSystemId, type Game, type Platform, type SteamLibraryInfo } from '@shared/types'
import { GameCard } from '../components/GameCard'
import { ScrollView } from '../components/ScrollView'
import { VirtualGrid } from '../components/VirtualGrid'
import { formatBytes, lastActivity, PF, totalPlaytime } from '../lib/format'
import { IconPlus, IconRetro, IconSettings, IconShelf } from '../components/Icons'
import { matches, parseQuery, removeFilter, searchIndex } from '../lib/search'
import { scan, useStore } from '../lib/store'

type Sort = 'name' | 'recent' | 'playtime' | 'added'
type Status = 'all' | 'installed' | 'favorites' | 'library'
export type LibPlatform = Platform | 'all' | 'emu'

interface Props {
  query: string
  platform: LibPlatform
  onPlatform: (p: LibPlatform) => void
  heroKey: string | null
  onOpen: (g: Game, key: string) => void
  onHover: (g: Game | null) => void
  onAdd: () => void
  onQuery: (q: string) => void
  /** Aba "Instalados" fixa no menu: a mesma grade, só com o que está no disco. */
  installedOnly?: boolean
  onCollection?: () => void
  /** Aba Emulação: só jogos de emulador, com filtro por console. */
  emuOnly?: boolean
  /** Abre Ajustes num ponto: emuladores ou chaves de API. */
  onSettings?: (anchor: 'emulators' | 'api-keys' | 'profiles') => void
}

const PLATFORMS: Platform[] = ['steam', 'epic', 'gog', 'xbox', 'manual']
const byName = (a: Game, b: Game): number => a.title.localeCompare(b.title, 'pt-BR')

/** Aviso da Biblioteca quando o PC tem várias contas Steam e a lista da conta do perfil é parcial. */
function useSteamInfo(enabled: boolean): SteamLibraryInfo | null {
  const count = useStore((s) => s.games.length)
  const account = useStore((s) => s.profile?.steamAccount)
  const [info, setInfo] = useState<SteamLibraryInfo | null>(null)
  useEffect(() => {
    if (!enabled || account === '') return setInfo(null)
    let alive = true
    void window.nexus.steam
      .libraryInfo()
      .catch(() => null)
      .then((i) => alive && setInfo(i))
    return () => {
      alive = false
    }
  }, [enabled, account, count])
  return info
}

/** 'emu' = jogos de emulador; 'manual' = só os .exe adicionados à mão. */
function inPlatform(g: Game, p: LibPlatform): boolean {
  if (p === 'all') return true
  if (p === 'emu') return !!g.emuSystem
  return g.platform === p && !g.emuSystem
}

export function LibraryView({ query, platform: platformProp, onPlatform, heroKey, onOpen, onHover, onAdd, onQuery, installedOnly, onCollection, emuOnly, onSettings }: Props) {
  const platform: LibPlatform = emuOnly ? 'emu' : platformProp
  const [sys, setSys] = useState<EmuSystemId | 'all'>('all')
  const steamInfo = useSteamInfo(!emuOnly)
  const games = useStore((s) => s.games)
  const loaded = useStore((s) => s.loaded)
  const scanning = useStore((s) => s.scanning)
  const ramGb = useStore((s) => s.ramGb)
  const [sort, setSort] = useState<Sort>(installedOnly ? 'recent' : 'name')
  const [statusState, setStatus] = useState<Status>('all')
  const status: Status = installedOnly ? 'installed' : statusState
  // Digitar não trava a grade: o filtro roda com prioridade baixa.
  const deferred = useDeferredValue(query)
  const parsed = useMemo(() => parseQuery(deferred), [deferred])
  const q = deferred.trim()

  // Índice de busca normalizado uma vez por lista, não a cada tecla.
  const index = useMemo(() => new Map(games.map((g) => [g.id, searchIndex(g)])), [games])

  const list = useMemo(() => {
    const out = games.filter((g) => {
      if (!inPlatform(g, platform)) return false
      if (emuOnly && sys !== 'all' && g.emuSystem !== sys) return false
      if (status === 'installed' && !g.installed) return false
      if (status === 'favorites' && !g.favorite) return false
      if (status === 'library' && g.installed) return false
      return matches(g, index.get(g.id) ?? '', parsed, ramGb)
    })
    const cmp: Record<Sort, (a: Game, b: Game) => number> = {
      name: byName,
      recent: (a, b) => lastActivity(b) - lastActivity(a) || byName(a, b),
      playtime: (a, b) => totalPlaytime(b) - totalPlaytime(a) || byName(a, b),
      added: (a, b) => b.addedAt - a.addedAt || byName(a, b)
    }
    return out.sort(cmp[sort])
  }, [games, index, parsed, ramGb, platform, status, sort, emuOnly, sys])

  const counts = useMemo(() => {
    const inPf = games.filter((g) => inPlatform(g, platform))
    const installed = inPf.filter((g) => g.installed)
    return {
      total: inPf.length,
      installed: installed.length,
      size: installed.reduce((n, g) => n + (g.installSize ?? 0), 0),
      present: PLATFORMS.filter((p) => games.some((g) => g.platform === p && !g.emuSystem)),
      emu: games.some((g) => g.emuSystem),
      systems: (Object.keys(EMU_SYSTEMS) as EmuSystemId[]).map((id) => [id, games.filter((g) => g.emuSystem === id).length] as const).filter(([, n]) => n > 0)
    }
  }, [games, platform])

  const render = useCallback(
    (g: Game) => <GameCard game={g} vtKey={`lib-${g.id}`} isHero={heroKey === `lib-${g.id}`} onOpen={onOpen} onHover={onHover} />,
    [heroKey, onOpen, onHover]
  )

  return (
    <ScrollView>
      <header className="view-head">
        <div className="view-title">
          <h1>{emuOnly ? 'Emulação' : installedOnly ? 'Instalados' : platform === 'all' ? 'Biblioteca' : platform === 'emu' ? 'Emuladores' : PF[platform].name}</h1>
          <p>
            {emuOnly
              ? `${counts.total} ${counts.total === 1 ? 'jogo' : 'jogos'} de console · cada um abre no emulador que você configurou`
              : installedOnly
              ? `${counts.installed} ${counts.installed === 1 ? 'jogo pronto' : 'jogos prontos'} para jogar · ${formatBytes(counts.size)} em disco`
              : `${counts.total.toLocaleString('pt-BR')} ${counts.total === 1 ? 'jogo' : 'jogos'} · ${counts.installed} instalados · ${(counts.total - counts.installed).toLocaleString('pt-BR')} na biblioteca`}
          </p>
        </div>
        <div className="toolbar">
          {!installedOnly && !emuOnly && onCollection ? (
            <div className="segmented" role="tablist" aria-label="Visão da biblioteca">
              <button role="tab" aria-selected className="on">
                Todos os jogos
              </button>
              <button role="tab" aria-selected={false} onClick={onCollection}>
                <IconShelf width={14} height={14} />
                Coleção
              </button>
            </div>
          ) : null}
          {installedOnly || emuOnly ? null : (
          <div className="segmented" role="tablist" aria-label="Filtrar por estado">
            {(
              [
                ['all', 'Todos'],
                ['installed', 'Instalados'],
                ['favorites', 'Favoritos'],
                ['library', 'Na Biblioteca']
              ] as Array<[Status, string]>
            ).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={status === id} className={status === id ? 'on' : ''} onClick={() => setStatus(id)}>
                {label}
              </button>
            ))}
          </div>
          )}
          <label className="select">
            <span>Ordenar</span>
            <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="name">Nome</option>
              <option value="recent">Jogado recentemente</option>
              <option value="playtime">Tempo de jogo</option>
              <option value="added">Adicionado</option>
            </select>
          </label>
          {emuOnly ? (
            <button className="btn ghost sm" onClick={() => onSettings?.('emulators')}>
              <IconSettings width={15} height={15} />
              Configurar emuladores
            </button>
          ) : (
            <button className="btn ghost icobtn" onClick={onAdd} aria-label="Adicionar jogo" title="Adicionar um .exe à biblioteca">
              <IconPlus width={17} height={17} />
            </button>
          )}
        </div>
      </header>

      {!emuOnly && !installedOnly && steamInfo?.unset && steamInfo.multi && (platform === 'all' || platform === 'steam') ? (
        <div className="notice glass lib-notice">
          <span>
            Este perfil ainda mostra os jogos de <b>todas as contas Steam</b> deste PC, misturados. Escolha qual conta é a sua para ver só a sua biblioteca e o seu tempo de jogo.
          </span>
          <button className="btn ghost sm" onClick={() => onSettings?.('profiles')}>
            Escolher conta
          </button>
        </div>
      ) : null}

      {!emuOnly && !installedOnly && steamInfo && !steamInfo.unset && steamInfo.multi && !steamInfo.complete && (platform === 'all' || platform === 'steam') ? (
        <div className="notice glass lib-notice">
          <span>
            Steam: mostrando os jogos de <b>{steamInfo.account?.name ?? 'sua conta'}</b> que já foram jogados ou instalados neste PC. Para ver também os que você nunca abriu, adicione a sua chave da Steam Web API.
          </span>
          <button className="btn ghost sm" onClick={() => onSettings?.('api-keys')}>
            Adicionar chave
          </button>
        </div>
      ) : null}

      {emuOnly ? (
        counts.systems.length > 1 ? (
          <div className="chips">
            <button className={`chip ${sys === 'all' ? 'on' : ''}`} onClick={() => setSys('all')}>
              Todos os consoles
            </button>
            {counts.systems.map(([id, n]) => (
              <button key={id} className={`chip ${sys === id ? 'on' : ''}`} style={{ '--c': '#ff7ad9' } as React.CSSProperties} onClick={() => setSys(id)}>
                <i />
                {EMU_SYSTEMS[id].label} <em>{n}</em>
              </button>
            ))}
          </div>
        ) : null
      ) : (
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
        {counts.emu ? (
          <button className={`chip ${platform === 'emu' ? 'on' : ''}`} style={{ '--c': '#ff7ad9' } as React.CSSProperties} onClick={() => onPlatform('emu')}>
            <i />
            Emuladores
          </button>
        ) : null}
      </div>
      )}

      {parsed.filters.length ? (
        <div className="chips filter-chips">
          {parsed.filters.map((f) => (
            <button key={f.key} className="chip on" onClick={() => onQuery(removeFilter(query, f.key))} title="Remover filtro">
              {f.label} <em>×</em>
            </button>
          ))}
          <span className="muted small">{list.length.toLocaleString('pt-BR')} resultados</span>
        </div>
      ) : null}

      {list.length === 0 && emuOnly && !q ? (
        <div className="emu-empty glass">
          <span className="emu-empty-ico">
            <IconRetro width={34} height={34} />
          </span>
          <b>Sua coleção de console, junto com o resto</b>
          <span>
            O Prisma organiza e abre jogos de PlayStation, PS2, PSP, GameCube, Wii, Switch e Game Boy Advance usando os emuladores instalados no seu PC.
          </span>
          <ol>
            <li>Instale o emulador do console (DuckStation, PCSX2, PPSSPP, Dolphin, Ryujinx ou mGBA).</li>
            <li>Em Ajustes → Emuladores, clique em Detectar ou escolha o executável.</li>
            <li>Aponte a pasta onde estão os jogos. Eles aparecem aqui com capa.</li>
          </ol>
          <button className="btn" onClick={() => onSettings?.('emulators')}>
            Configurar emuladores
          </button>
        </div>
      ) : list.length === 0 ? (
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
