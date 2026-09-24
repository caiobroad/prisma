import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ControllerSettings, Game } from '@shared/types'
import { GameCover } from './GameCover'
import { PrismaMark } from './TitleBar'
import { Avatar } from './Avatar'
import { formatBytes, formatPlaytime, lastActivity, PF, relativeTime, totalPlaytime } from '../lib/format'
import { startGame, install, toggleFavorite, updateSettings, useStore } from '../lib/store'
import { useGamepad, type PadAction } from '../lib/input'
import { rumble, sfx } from '../lib/sounds'

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

/** Duração da intro por intensidade de animação (suave, normal, intensa). */
const BOOT_MS = [1500, 2600, 3400]

/**
 * Modo Controle: uma coleção física em prateleira, pensada para o sofá. Abre com uma intro
 * de console, tem sons de sistema, vibração, ajustes próprios e um cursor virtual no
 * analógico direito. Tudo funciona sem mouse (controle ou teclado).
 */
export function ControllerMode({ onExit, onFocusGame }: Props) {
  const games = useStore((s) => s.games)
  const running = useStore((s) => s.running)
  const cs = useStore((s) => s.settings.controller)
  const profile = useStore((s) => s.profile)
  const [tab, setTab] = useState<Tab>('all')
  const [focus, setFocus] = useState<Record<Tab, number>>({ all: 0, installed: 0, recent: 0, favorites: 0 })
  const [detail, setDetail] = useState(false)
  const [action, setAction] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [booting, setBooting] = useState(true)
  const [clock, setClock] = useState(() => new Date())
  const [cursor, setCursor] = useState<{ x: number; y: number; on: boolean }>({ x: window.innerWidth / 2, y: window.innerHeight / 2, on: false })
  const cursorPos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  const cursorIdle = useRef<number | null>(null)
  // Capas proporcionais à altura da janela, para a prateleira nunca invadir as informações.
  const [vh, setVh] = useState(() => window.innerHeight)
  useEffect(() => {
    const on = (): void => setVh(window.innerHeight)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const cardW = Math.round(Math.max(104, Math.min(150, vh * 0.17)))
  const STEP = Math.round(cardW * 1.27)

  // ---------- intro ----------
  useEffect(() => {
    sfx('boot')
    rumble('light')
    const t = window.setTimeout(() => setBooting(false), BOOT_MS[cs.animation] ?? BOOT_MS[1])
    return () => window.clearTimeout(t)
    // A intro toca uma vez por entrada no modo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    (d: number) =>
      setFocus((f) => {
        const next = Math.max(0, Math.min(list.length - 1, f[tab] + d))
        if (next !== f[tab]) {
          sfx('move')
          rumble('light')
        }
        return { ...f, [tab]: next }
      }),
    [tab, list.length]
  )

  const switchTab = useCallback(
    (dir: 1 | -1) => {
      const i = TABS.findIndex((t) => t.id === tab)
      setTab(TABS[(i + dir + TABS.length) % TABS.length].id)
      setDetail(false)
      sfx('tab')
      rumble('light')
    },
    [tab]
  )

  const exit = useCallback(() => {
    sfx('back')
    onExit()
  }, [onExit])

  const handle = useCallback(
    (a: PadAction): void => {
      if (booting) {
        // Qualquer botão pula a intro.
        setBooting(false)
        return
      }
      if (a === 'r3') return clickCursor()
      if (settingsOpen) return // o painel de ajustes tem o próprio controle
      if (a === 'start') return exit()
      if (a === 'select') {
        sfx('open')
        setSettingsOpen(true)
        return
      }
      if (detail) {
        if (a === 'left' && action > 0) {
          setAction(action - 1)
          sfx('move')
        } else if (a === 'right' && action < ACTIONS.length - 1) {
          setAction(action + 1)
          sfx('move')
        } else if (a === 'back') {
          setDetail(false)
          sfx('back')
        } else if (a === 'y' && game) {
          void toggleFavorite(game)
          sfx('confirm')
        } else if (a === 'confirm' && game) {
          const act = ACTIONS[action]
          if (act === 'back') {
            setDetail(false)
            sfx('back')
            return
          }
          sfx('confirm')
          rumble('strong')
          if (act === 'favorite') void toggleFavorite(game)
          else if (running.has(game.id)) sfx('error')
          else if (game.installed || game.platform === 'manual') void startGame(game)
          else void install(game)
        } else if (a === 'lb' || a === 'lt') switchTab(-1)
        else if (a === 'rb' || a === 'rt') switchTab(1)
        return
      }
      if (a === 'left') move(-1)
      else if (a === 'right') move(1)
      else if (a === 'up') move(-8)
      else if (a === 'down') move(8)
      else if (a === 'lb' || a === 'lt') switchTab(-1)
      else if (a === 'rb' || a === 'rt') switchTab(1)
      else if (a === 'back') exit()
      else if (a === 'confirm' && game) {
        setAction(0)
        setDetail(true)
        sfx('open')
        rumble('light')
      } else if (a === 'y' && game) {
        void toggleFavorite(game)
        sfx('confirm')
      }
    },
    // clickCursor lê só refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [booting, settingsOpen, detail, action, game, running, move, switchTab, exit]
  )

  // ---------- cursor virtual (analógico direito + R3) ----------
  const onRightStick = useCallback(
    (x: number, y: number, dt: number) => {
      const k = (cs.cursorSpeed * dt) / 16
      const p = cursorPos.current
      p.x = Math.max(0, Math.min(window.innerWidth - 1, p.x + x * Math.abs(x) * k * 1.6))
      p.y = Math.max(0, Math.min(window.innerHeight - 1, p.y + y * Math.abs(y) * k * 1.6))
      setCursor({ x: p.x, y: p.y, on: true })
      if (cursorIdle.current) window.clearTimeout(cursorIdle.current)
      cursorIdle.current = window.setTimeout(() => setCursor((c) => ({ ...c, on: false })), 2500)
    },
    [cs.cursorSpeed]
  )

  function clickCursor(): void {
    const { x, y } = cursorPos.current
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    const target = el?.closest<HTMLElement>('button, [role="button"], a, input, select, .cm-card') ?? el
    if (!target) return
    sfx('confirm')
    rumble('light')
    target.click()
  }

  const pad = useGamepad(handle, true, { sensitivity: cs.sensitivity, onRightStick })

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
      o: 'select',
      F10: 'start'
    }
    const onKey = (ev: KeyboardEvent): void => {
      if (settingsOpen) return
      const a = map[ev.key]
      if (!a) return
      ev.preventDefault()
      ev.stopPropagation()
      handle(a)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [handle, settingsOpen])

  const from = Math.max(0, idx - WINDOW_BEHIND)
  const to = Math.min(list.length, idx + WINDOW_AHEAD)
  const canPlay = game ? game.installed || game.platform === 'manual' : false

  return (
    <div className={`cm cm-anim-${cs.animation} ${detail ? 'cm-detail-open' : ''} ${booting ? 'cm-booting' : 'cm-ready'}`}>
      <div className="cm-bg">{game?.bannerUrl ? <img key={game.id} src={game.bannerUrl} alt="" /> : null}</div>
      <div className="cm-shade" />

      <header className="cm-top">
        <div className="cm-tabs">
          <kbd className="pad-btn">L2</kbd>
          {TABS.map((t) => (
            <button key={t.id} className={t.id === tab ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.label}
              <em>{lists[t.id].length}</em>
            </button>
          ))}
          <kbd className="pad-btn">R2</kbd>
        </div>
        <div className="cm-clock">
          {profile ? (
            <span className="cm-user">
              <Avatar src={profile.avatar} name={profile.nickname} size={30} />
              {profile.nickname}
            </span>
          ) : null}
          {clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          <button className="btn ghost sm" onClick={() => setSettingsOpen(true)}>
            Ajustes
          </button>
          <button className="btn ghost sm" onClick={exit}>
            Sair
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
            {game.completed ? <span>✓ Concluído</span> : null}
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
            const tilt = cs.animation === 0 ? 6 : cs.animation === 2 ? 20 : 14
            const lift = cs.animation === 0 ? 1.12 : cs.animation === 2 ? 1.3 : 1.22
            const style = {
              width: cardW,
              '--d': d,
              '--ad': Math.min(Math.abs(d), 6),
              transform: `translate3d(${d * STEP + (d > 0 ? cardW * 0.4 : d < 0 ? -cardW * 0.2 : 0)}px, 0, ${d === 0 ? 80 : -Math.abs(d) * 30}px) rotateY(${d === 0 ? 0 : d > 0 ? -tilt : tilt}deg) scale(${d === 0 ? lift : 1})`
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
                onClick={() => {
                  setAction(i)
                  handle('confirm')
                }}
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
          <kbd className="pad-btn">L2 R2</kbd>
          Abas
        </span>
        <span>
          <kbd className="pad-btn">⧉</kbd>
          Ajustes
        </span>
        <span>
          <kbd className="pad-btn">R3</kbd>
          Cursor
        </span>
        <span>
          <kbd className="pad-btn">☰</kbd>
          Sair
        </span>
        {!pad ? <em>Sem controle: setas, Enter, Esc · Q/E abas · O ajustes</em> : null}
      </footer>

      {settingsOpen ? <PadSettings settings={cs} onClose={() => setSettingsOpen(false)} /> : null}

      {cursor.on ? <div className="vcursor" style={{ transform: `translate3d(${cursor.x}px, ${cursor.y}px, 0)` }} /> : null}

      {booting ? <BootIntro onSkip={() => setBooting(false)} /> : null}
    </div>
  )
}

/** Intro de console: o feixe atravessa o prisma, o espectro se abre e a interface surge. */
function BootIntro({ onSkip }: { onSkip: () => void }) {
  return (
    <div className="boot" onClick={onSkip} role="presentation">
      <div className="boot-beam" />
      <div className="boot-mark">
        <PrismaMark />
      </div>
      <div className="boot-spectrum">
        <i />
        <i />
        <i />
      </div>
      <div className="boot-word">PRISMA</div>
      <div className="boot-sub">Modo Controle</div>
    </div>
  )
}

type Row =
  | { key: keyof ControllerSettings; label: string; kind: 'bool' }
  | { key: keyof ControllerSettings; label: string; kind: 'range'; min: number; max: number; step: number; fmt: (v: number) => string }

const ROWS: Row[] = [
  { key: 'vibration', label: 'Vibração', kind: 'bool' },
  { key: 'sounds', label: 'Sons do sistema', kind: 'bool' },
  { key: 'volume', label: 'Volume dos sons', kind: 'range', min: 0, max: 1, step: 0.1, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'sensitivity', label: 'Sensibilidade da navegação', kind: 'range', min: 1, max: 3, step: 1, fmt: (v) => ['Lenta', 'Normal', 'Rápida'][v - 1] },
  { key: 'cursorSpeed', label: 'Velocidade do cursor virtual', kind: 'range', min: 6, max: 30, step: 2, fmt: (v) => `${v}` },
  { key: 'animation', label: 'Intensidade das animações', kind: 'range', min: 0, max: 2, step: 1, fmt: (v) => ['Suave', 'Normal', 'Intensa'][v] }
]

/** Ajustes do Modo Controle, navegáveis só com o direcional: ↑↓ escolhe, ←→ muda, B fecha. */
function PadSettings({ settings, onClose }: { settings: ControllerSettings; onClose: () => void }) {
  const [row, setRow] = useState(0)

  const change = useCallback(
    (dir: 1 | -1 | 0) => {
      const r = ROWS[row]
      if (r.kind === 'bool') {
        void updateSettings({ controller: { ...settings, [r.key]: !settings[r.key] } })
      } else {
        const cur = settings[r.key] as number
        const next = Math.round(Math.max(r.min, Math.min(r.max, cur + (dir || 1) * r.step)) * 100) / 100
        if (next === cur) return sfx('error')
        void updateSettings({ controller: { ...settings, [r.key]: next } })
      }
      // O som de teste já usa o valor novo (ex.: volume).
      window.setTimeout(() => {
        sfx('move', true)
        if (r.key === 'vibration' && !settings.vibration) rumble('strong')
      }, 60)
    },
    [row, settings]
  )

  const handle = useCallback(
    (a: PadAction) => {
      if (a === 'up') {
        setRow((n) => (n - 1 + ROWS.length) % ROWS.length)
        sfx('move')
      } else if (a === 'down') {
        setRow((n) => (n + 1) % ROWS.length)
        sfx('move')
      } else if (a === 'left') change(-1)
      else if (a === 'right') change(1)
      else if (a === 'confirm') change(0)
      else if (a === 'back' || a === 'select' || a === 'start') {
        sfx('back')
        onClose()
      }
    },
    [change, onClose]
  )

  useGamepad(handle, true, { sensitivity: settings.sensitivity })

  useEffect(() => {
    const map: Record<string, PadAction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'confirm', Escape: 'back', Backspace: 'back', o: 'select' }
    const onKey = (e: KeyboardEvent): void => {
      const a = map[e.key]
      if (!a) return
      e.preventDefault()
      e.stopPropagation()
      handle(a)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [handle])

  return (
    <div className="cm-settings-scrim">
      <div className="cm-settings glass frost" role="dialog" aria-label="Ajustes do Modo Controle">
        <h2>Ajustes do Modo Controle</h2>
        <ul>
          {ROWS.map((r, i) => {
            const v = settings[r.key]
            return (
              <li key={r.key} className={i === row ? 'on' : ''} onMouseEnter={() => setRow(i)}>
                <span>{r.label}</span>
                {r.kind === 'bool' ? (
                  <button className="tg" role="switch" aria-checked={!!v} aria-label={r.label} onClick={() => (setRow(i), change(0))} />
                ) : (
                  <span className="cm-range">
                    <button onClick={() => (setRow(i), change(-1))} aria-label="Diminuir">
                      ‹
                    </button>
                    <b>{r.fmt(v as number)}</b>
                    <i>
                      <em style={{ width: `${(100 * ((v as number) - r.min)) / (r.max - r.min)}%` }} />
                    </i>
                    <button onClick={() => (setRow(i), change(1))} aria-label="Aumentar">
                      ›
                    </button>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
        <p className="muted small">↑↓ escolher · ←→ ajustar · A alternar · B fechar</p>
      </div>
    </div>
  )
}
