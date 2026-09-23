import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Game } from '@shared/types'
import { GameCover } from './GameCover'
import { formatBytes, formatPlaytime, lastActivity, PF, relativeTime, totalPlaytime } from '../lib/format'
import { startGame, install, toggleFavorite, useStore } from '../lib/store'
import { useGamepad, type PadAction } from '../lib/input'

type Tab = 'all' | 'installed' | 'recent' | 'favorites'
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'installed', label: 'Instalados' },
  { id: 'recent', label: 'Recentes' },
  { id: 'favorites', label: 'Favoritos' }
]
const ACTIONS = ['play', 'favorite', 'back'] as const
const WINDOW_BEHIND = 6
const WINDOW_AHEAD = 12

interface Props {
  onExit: () => void
  onFocusGame: (g: Game | null) => void
}

/**
 * Modo Controle: uma coleção física em prateleira. Navegação só por controle
 * (ou setas do teclado), foco por cartão, capas com perspectiva e reflexo.
 */
export function ControllerMode({ onExit, onFocusGame }: Props) {
  const games = useStore((s) => s.games)
  const running = useStore((s) => s.running)
  const [tab, setTab] = useState<Tab>('all')
  const [focus, setFocus] = useState<Record<Tab, number>>({ all: 0, installed: 0, recent: 0, favorites: 0 })
  const [detail, setDetail] = useState(false)
  const [action, setAction] = useState(0)
  const [clock, setClock] = useState(() => new Date())
  // Capas proporcionais à altura da janela, para a prateleira nunca invadir as informações.
  const [vh, setVh] = useState(() => window.innerHeight)
  useEffect(() => {
    const on = (): void => setVh(window.innerHeight)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const cardW = Math.round(Math.max(104, Math.min(150, vh * 0.17)))
  const STEP = Math.round(cardW * 1.27)

  const lists = useMemo(() => {
    const real = games.filter((g) => g.id < 1_000_000)
    const byName = (a: Game, b: Game): number => a.title.localeCompare(b.title, 'pt-BR')
    const byRecent = (a: Game, b: Game): number => lastActivity(b) - lastActivity(a) || byName(a, b)
    return {
      all: [...real].sort(byRecent),
      installed: real.filter((g) => g.installed).sort(byRecent),
      recent: real.filter((g) => lastActivity(g) > 0).sort(byRecent),
      favorites: real.filter((g) => g.favorite).sort(byName)
    } satisfies Record<Tab, Game[]>
  }, [games])

  const list = lists[tab]
  const idx = Math.min(focus[tab], Math.max(0, list.length - 1))
  const game = list[idx] ?? null

  const focusTimer = useRef<number | null>(null)
  useEffect(() => {
    if (focusTimer.current) window.clearTimeout(focusTimer.current)
    focusTimer.current = window.setTimeout(() => onFocusGame(game), 260)
  }, [game, onFocusGame])
  useEffect(() => () => onFocusGame(null), [onFocusGame])

  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date()), 15000)
    return () => window.clearInterval(t)
  }, [])

  const move = useCallback(
    (d: number) => setFocus((f) => ({ ...f, [tab]: Math.max(0, Math.min(list.length - 1, f[tab] + d)) })),
    [tab, list.length]
  )

  const handle = useCallback(
    (a: PadAction): void => {
      if (a === 'start' || a === 'select') return onExit()
      if (detail) {
        if (a === 'left') setAction((n) => Math.max(0, n - 1))
        else if (a === 'right') setAction((n) => Math.min(ACTIONS.length - 1, n + 1))
        else if (a === 'back') setDetail(false)
        else if (a === 'y' && game) void toggleFavorite(game)
        else if (a === 'confirm' && game) {
          const act = ACTIONS[action]
          if (act === 'back') setDetail(false)
          else if (act === 'favorite') void toggleFavorite(game)
          else if (game.installed || game.platform === 'manual') void startGame(game)
          else void install(game)
        }
        return
      }
      if (a === 'left') move(-1)
      else if (a === 'right') move(1)
      else if (a === 'up') move(-8)
      else if (a === 'down') move(8)
      else if (a === 'lb' || a === 'rb') {
        const i = TABS.findIndex((t) => t.id === tab)
        setTab(TABS[(i + (a === 'rb' ? 1 : TABS.length - 1)) % TABS.length].id)
      } else if (a === 'confirm' && game) {
        setAction(0)
        setDetail(true)
      } else if (a === 'y' && game) void toggleFavorite(game)
    },
    [detail, action, game, tab, move, onExit]
  )

  const pad = useGamepad(handle, true)

  // Teclado equivalente, para quem não tem controle à mão.
  useEffect(() => {
    const map: Record<string, PadAction> = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
      Enter: 'confirm',
      Escape: 'back',
      Backspace: 'back',
      q: 'lb',
      e: 'rb',
      f: 'y',
      F10: 'start'
    }
    const onKey = (ev: KeyboardEvent): void => {
      const a = map[ev.key]
      if (!a) return
      ev.preventDefault()
      ev.stopPropagation()
      if (a === 'back' && !detail) return onExit()
      handle(a)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [handle, detail, onExit])

  const from = Math.max(0, idx - WINDOW_BEHIND)
  const to = Math.min(list.length, idx + WINDOW_AHEAD)
  const canPlay = game ? game.installed || game.platform === 'manual' : false

  return (
    <div className={`cm ${detail ? 'cm-detail-open' : ''}`}>
      <div className="cm-bg">{game?.bannerUrl ? <img key={game.id} src={game.bannerUrl} alt="" /> : null}</div>
      <div className="cm-shade" />

      <header className="cm-top">
        <div className="cm-tabs">
          <kbd className="pad-btn">L1</kbd>
          {TABS.map((t) => (
            <button key={t.id} className={t.id === tab ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.label}
              <em>{lists[t.id].length}</em>
            </button>
          ))}
          <kbd className="pad-btn">R1</kbd>
        </div>
        <div className="cm-clock">
          {clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          <button className="btn ghost sm" onClick={onExit}>
            Sair do Modo Controle
          </button>
        </div>
      </header>

      {game ? (
        <div className="cm-info" key={game.id}>
          {game.logoUrl ? <img className="cm-logo" src={game.logoUrl} alt={game.title} /> : <h1 className="cm-title">{game.title}</h1>}
          <div className="cm-meta">
            <span>{PF[game.platform].name}</span>
            <span>{running.has(game.id) ? 'Em jogo' : game.installed ? 'Instalado' : 'Na Biblioteca'}</span>
            {totalPlaytime(game) ? <span>{formatPlaytime(totalPlaytime(game))}</span> : null}
            {lastActivity(game) ? <span>{relativeTime(lastActivity(game))}</span> : null}
            {game.favorite ? <span>★ Favorito</span> : null}
          </div>
        </div>
      ) : (
        <div className="cm-info">
          <h1 className="cm-title">Nada por aqui</h1>
        </div>
      )}

      <div className="cm-shelf" aria-label="Prateleira de jogos">
        <div className="cm-track">
          {list.slice(from, to).map((g, k) => {
            const i = from + k
            const d = i - idx
            const style = {
              width: cardW,
              '--d': d,
              '--ad': Math.min(Math.abs(d), 6),
              transform: `translate3d(${d * STEP + (d > 0 ? cardW * 0.4 : d < 0 ? -cardW * 0.2 : 0)}px, 0, ${d === 0 ? 80 : -Math.abs(d) * 30}px) rotateY(${d === 0 ? 0 : d > 0 ? -14 : 14}deg) scale(${d === 0 ? 1.22 : 1})`
            } as React.CSSProperties
            return (
              <div
                key={g.id}
                className={`cm-card ${d === 0 ? 'focus' : ''}`}
                style={style}
                onClick={() => (d === 0 ? setDetail(true) : setFocus((f) => ({ ...f, [tab]: i })))}
              >
                <div className="cm-cover">
                  <GameCover game={g} />
                </div>
              </div>
            )
          })}
        </div>
        <div className="cm-ledge" />
      </div>

      {detail && game ? (
        <div className="cm-panel glass frost">
          <div className="cm-panel-main">
            <h2>{game.title}</h2>
            {game.description ? <p>{game.description}</p> : null}
            <div className="cm-panel-stats">
              <span>
                <em>Tamanho</em>
                {game.installed ? formatBytes(game.installSize) : 'Não instalado'}
              </span>
              <span>
                <em>Última vez</em>
                {lastActivity(game) ? relativeTime(lastActivity(game)) : 'Nunca'}
              </span>
              <span>
                <em>Tempo jogado</em>
                {formatPlaytime(totalPlaytime(game))}
              </span>
            </div>
          </div>
          <div className="cm-actions">
            {ACTIONS.map((a, i) => (
              <button
                key={a}
                className={`cm-action ${i === action ? 'on' : ''} ${a === 'play' ? 'primary' : ''}`}
                onMouseEnter={() => setAction(i)}
                onClick={() => handle('confirm')}
              >
                {a === 'play' ? (running.has(game.id) ? 'Em jogo' : canPlay ? 'Jogar' : 'Instalar') : a === 'favorite' ? (game.favorite ? 'Remover favorito' : 'Favoritar') : 'Voltar'}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <footer className="cm-hints">
        <span>
          <kbd className="pad-btn a">A</kbd>
          {detail ? 'Confirmar' : 'Selecionar'}
        </span>
        <span>
          <kbd className="pad-btn b">B</kbd>
          Voltar
        </span>
        <span>
          <kbd className="pad-btn y">Y</kbd>
          Favorito
        </span>
        <span>
          <kbd className="pad-btn">☰</kbd>
          Sair
        </span>
        {!pad ? <em>Nenhum controle detectado: use as setas, Enter e Esc</em> : null}
      </footer>
    </div>
  )
}
