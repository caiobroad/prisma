import { useEffect, useMemo, useState } from 'react'
import type { Achievement, Game, Session } from '@shared/types'
import { GameIcon } from '../components/GameCover'
import { ScrollView } from '../components/ScrollView'
import { dayKey, formatDuration, formatHours, formatLongDate, lastActivity, PF, totalPlaytime } from '../lib/format'
import { useStore } from '../lib/store'

type Kind = 'first' | 'record' | 'achievements' | 'streak' | 'last'
type Filter = 'all' | 'achievements' | 'sessions' | 'milestones'

interface TEvent {
  key: string
  kind: Kind
  at: number
  game: Game | null
  title: string
  detail?: string
  items?: Achievement[]
}

const DAY = 86_400_000

interface Props {
  onOpen: (g: Game, key: string) => void
}

/** Sequências de dias consecutivos a partir de um conjunto de dias com atividade. */
function streaks(days: Set<string>): { current: number; longest: number; runs: Array<{ end: number; len: number }> } {
  const sorted = [...days].sort()
  const runs: Array<{ end: number; len: number }> = []
  let len = 0
  let prev: number | null = null
  for (const d of sorted) {
    const t = new Date(d + 'T12:00:00').getTime()
    if (prev != null && Math.round((t - prev) / DAY) === 1) len++
    else {
      if (prev != null) runs.push({ end: prev, len })
      len = 1
    }
    prev = t
  }
  if (prev != null) runs.push({ end: prev, len })
  const longest = runs.reduce((m, r) => Math.max(m, r.len), 0)
  const last = runs[runs.length - 1]
  const today = new Date(dayKey(Date.now()) + 'T12:00:00').getTime()
  const current = last && Math.round((today - last.end) / DAY) <= 1 ? last.len : 0
  return { current, longest, runs }
}

/** embedded: dentro da aba do Perfil (sem rolagem própria nem título grande). */
export function TimelineView({ onOpen, embedded }: Props & { embedded?: boolean }) {
  const byId = useStore((s) => s.byId)
  const games = useStore((s) => s.games)
  const [sessions, setSessions] = useState<Session[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loaded, setLoaded] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [gameId, setGameId] = useState<number | 'all'>('all')
  const [months, setMonths] = useState(8)

  useEffect(() => {
    void window.nexus.timeline().then((d) => {
      setSessions(d.sessions)
      setAchievements(d.achievements)
      setLoaded(true)
    })
  }, [])

  const data = useMemo(() => {
    const ended = sessions.filter((s) => s.endedAt != null)
    const inScope = <T extends { gameId: number }>(x: T): boolean => gameId === 'all' || x.gameId === gameId
    const sess = ended.filter(inScope)
    const ach = achievements.filter(inScope)
    const scopeGames = gameId === 'all' ? games.filter((g) => g.id < 1_000_000) : [byId.get(gameId)].filter((g): g is Game => !!g)

    const days = new Set<string>()
    for (const s of sess) days.add(dayKey(s.startedAt))
    for (const a of ach) if (a.unlockedAt) days.add(dayKey(a.unlockedAt))
    for (const g of scopeGames) if (g.platformLastPlayed) days.add(dayKey(g.platformLastPlayed))
    const st = streaks(days)

    const events: TEvent[] = []
    const perGame = new Map<number, Session[]>()
    for (const s of sess) {
      const arr = perGame.get(s.gameId) ?? []
      arr.push(s)
      perGame.set(s.gameId, arr)
    }
    for (const [gid, list] of perGame) {
      const g = byId.get(gid) ?? null
      const first = list.reduce((a, b) => (a.startedAt < b.startedAt ? a : b))
      events.push({ key: `first-${gid}`, kind: 'first', at: first.startedAt, game: g, title: 'Primeira sessão pelo Prisma', detail: formatDuration(first.durationSeconds) })
      const rec = list.reduce((a, b) => (a.durationSeconds > b.durationSeconds ? a : b))
      if (rec.durationSeconds >= 600 && rec.id !== first.id) {
        events.push({ key: `rec-${gid}`, kind: 'record', at: rec.startedAt, game: g, title: 'Recorde de sessão', detail: formatDuration(rec.durationSeconds) })
      }
    }
    // Conquistas agrupadas por jogo e dia.
    const groups = new Map<string, Achievement[]>()
    for (const a of ach) {
      if (!a.unlockedAt) continue
      const k = `${a.gameId}|${dayKey(a.unlockedAt)}`
      const arr = groups.get(k) ?? []
      arr.push(a)
      groups.set(k, arr)
    }
    for (const [k, list] of groups) {
      list.sort((a, b) => (a.unlockedAt ?? 0) - (b.unlockedAt ?? 0))
      events.push({
        key: `ach-${k}`,
        kind: 'achievements',
        at: list[list.length - 1].unlockedAt!,
        game: byId.get(list[0].gameId) ?? null,
        title: list.length === 1 ? 'Conquista desbloqueada' : `${list.length} conquistas desbloqueadas`,
        items: list
      })
    }
    for (const g of scopeGames) {
      if (g.platformLastPlayed && !perGame.has(g.id)) {
        events.push({ key: `last-${g.id}`, kind: 'last', at: g.platformLastPlayed, game: g, title: `Último acesso registrado na ${PF[g.platform].name}` })
      }
    }
    for (const r of st.runs) {
      if (r.len >= 3) events.push({ key: `streak-${r.end}`, kind: 'streak', at: r.end, game: null, title: `Sequência de ${r.len} dias jogando` })
    }
    events.sort((a, b) => b.at - a.at)

    const hours = scopeGames.reduce((s, g) => s + totalPlaytime(g), 0)
    const record = sess.reduce<Session | null>((m, s) => (!m || s.durationSeconds > m.durationSeconds ? s : m), null)
    const played = scopeGames.filter((g) => lastActivity(g) > 0 || totalPlaytime(g) > 0).length
    return { events, st, hours, record, played, achCount: ach.filter((a) => a.unlockedAt != null).length, sess }
  }, [sessions, achievements, games, byId, gameId])

  const shown = data.events.filter(
    (e) =>
      filter === 'all' ||
      (filter === 'achievements' && e.kind === 'achievements') ||
      (filter === 'sessions' && (e.kind === 'first' || e.kind === 'last')) ||
      (filter === 'milestones' && (e.kind === 'record' || e.kind === 'streak' || e.kind === 'first'))
  )

  // Agrupa por mês; só os primeiros meses entram no DOM até pedir mais.
  const byMonth: Array<{ label: string; events: TEvent[] }> = []
  for (const e of shown) {
    const label = new Date(e.at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    const last = byMonth[byMonth.length - 1]
    if (last?.label === label) last.events.push(e)
    else byMonth.push({ label, events: [e] })
  }

  const played = useMemo(
    () => games.filter((g) => g.id < 1_000_000 && (lastActivity(g) > 0 || g.achievementsUnlocked > 0)).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')),
    [games]
  )
  const selected = gameId === 'all' ? null : byId.get(gameId) ?? null
  const firstOpened = selected ? data.sess.reduce<number | null>((m, s) => (m == null || s.startedAt < m ? s.startedAt : m), null) : null

  return (
    <Wrap embedded={embedded}>
      <header className={`view-head ${embedded ? 'embedded' : ''}`}>
        <div className="view-title">
          {embedded ? <h2>Timeline Gamer</h2> : <h1>Timeline Gamer</h1>}
          <p>Registrada automaticamente a partir das suas sessões, conquistas e do histórico das lojas</p>
        </div>
        <label className="select">
          <span>Jogo</span>
          <select id="tl-game" value={gameId} onChange={(e) => setGameId(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">Todos os jogos</option>
            {played.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="tl-stats">
        <div className="tl-stat glass">
          <span>Horas totais</span>
          <b>{formatHours(data.hours)}</b>
        </div>
        {selected ? (
          <>
            <div className="tl-stat glass">
              <span>Primeira vez aberto</span>
              <b>{firstOpened ? formatLongDate(firstOpened) : '—'}</b>
            </div>
            <div className="tl-stat glass">
              <span>Último acesso</span>
              <b>{lastActivity(selected) ? formatLongDate(lastActivity(selected)) : '—'}</b>
            </div>
          </>
        ) : (
          <div className="tl-stat glass">
            <span>Jogos com atividade</span>
            <b>{data.played}</b>
          </div>
        )}
        <div className="tl-stat glass">
          <span>Sequência atual</span>
          <b>
            {data.st.current} {data.st.current === 1 ? 'dia' : 'dias'}
          </b>
        </div>
        <div className="tl-stat glass">
          <span>Maior sequência</span>
          <b>
            {data.st.longest} {data.st.longest === 1 ? 'dia' : 'dias'}
          </b>
        </div>
        <div className="tl-stat glass">
          <span>Maior sessão</span>
          <b>{data.record ? formatDuration(data.record.durationSeconds) : '—'}</b>
        </div>
        <div className="tl-stat glass">
          <span>Conquistas</span>
          <b>{data.achCount}</b>
        </div>
      </div>

      <div className="chips">
        {(
          [
            ['all', 'Tudo'],
            ['achievements', 'Conquistas'],
            ['sessions', 'Sessões'],
            ['milestones', 'Marcos']
          ] as Array<[Filter, string]>
        ).map(([id, label]) => (
          <button key={id} className={`chip ${filter === id ? 'on' : ''}`} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      {!loaded ? null : byMonth.length === 0 ? (
        <div className="empty glass">
          <b>A linha do tempo começa no seu próximo jogo</b>
          <span>Sessões iniciadas pelo Prisma e conquistas da Steam aparecem aqui automaticamente.</span>
        </div>
      ) : (
        <div className="timeline">
          {byMonth.slice(0, months).map((m) => (
            <section key={m.label} className="tl-month">
              <h3>{m.label}</h3>
              <ol>
                {m.events.map((e) => (
                  <li key={e.key} className={`tl-event k-${e.kind}`}>
                    <span className="tl-dot" />
                    <time>{new Date(e.at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}</time>
                    <div className="tl-card glass" onClick={() => e.game && onOpen(e.game, `tl-${e.key}`)} role={e.game ? 'button' : undefined}>
                      {e.game ? (
                        <div className="tl-icon">
                          <GameIcon game={e.game} minSize={48} />
                        </div>
                      ) : (
                        <div className="tl-icon tl-flame">✦</div>
                      )}
                      <div className="tl-body">
                        <b>{e.title}</b>
                        <span>
                          {e.game?.title}
                          {e.detail ? `${e.game ? ' · ' : ''}${e.detail}` : ''}
                        </span>
                        {e.items ? (
                          <ul className="tl-ach">
                            {e.items.slice(0, 4).map((a) => (
                              <li key={a.apiName} title={a.description ?? undefined}>
                                {a.icon ? <img src={a.icon} alt="" loading="lazy" /> : null}
                                {a.name}
                              </li>
                            ))}
                            {e.items.length > 4 ? <li className="more">+{e.items.length - 4}</li> : null}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          {byMonth.length > months ? (
            <button className="btn ghost tl-more" onClick={() => setMonths((n) => n + 8)}>
              Carregar meses anteriores
            </button>
          ) : null}
        </div>
      )}
    </Wrap>
  )
}

function Wrap({ embedded, children }: { embedded?: boolean; children: React.ReactNode }) {
  return embedded ? <div className="timeline-view embedded">{children}</div> : <ScrollView className="timeline-view">{children}</ScrollView>
}
