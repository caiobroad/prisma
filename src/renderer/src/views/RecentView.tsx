import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Game, Session } from '@shared/types'
import { GameCard } from '../components/GameCard'
import { GameIcon } from '../components/GameCover'
import { IconPlay } from '../components/Icons'
import { ScrollView } from '../components/ScrollView'
import { VirtualGrid } from '../components/VirtualGrid'
import { formatDuration, lastActivity, PF, relativeTime } from '../lib/format'
import { play, useStore } from '../lib/store'

interface Props {
  heroKey: string | null
  onOpen: (g: Game, key: string) => void
  onHover: (g: Game | null) => void
}

export function RecentView({ heroKey, onOpen, onHover }: Props) {
  const games = useStore((s) => s.games)
  const byId = useStore((s) => s.byId)
  const running = useStore((s) => s.running)
  const [sessions, setSessions] = useState<Array<Session & { title: string }>>([])

  useEffect(() => {
    void window.nexus.games.recentSessions(12).then(setSessions)
  }, [running])

  const rows = sessions.filter((s) => byId.has(s.gameId))
  const played = useMemo(() => games.filter((g) => lastActivity(g) > 0).sort((a, b) => lastActivity(b) - lastActivity(a)), [games])
  const render = useCallback(
    (g: Game) => <GameCard game={g} vtKey={`recent-${g.id}`} isHero={heroKey === `recent-${g.id}`} onOpen={onOpen} onHover={onHover} />,
    [heroKey, onOpen, onHover]
  )

  return (
    <ScrollView>
      <header className="view-head">
        <div className="view-title">
          <h1>Recentes</h1>
          <p>Sessões iniciadas pelo Prisma e o histórico registrado pelas lojas</p>
        </div>
      </header>

      {rows.length ? (
        <section className="block">
          <div className="section-head">
            <h2>Sessões no Prisma</h2>
          </div>
          <div className="session-list">
            {rows.map((s) => {
              const g = byId.get(s.gameId)!
              const open = s.endedAt == null
              return (
                <div key={s.id} className="glass session-row" onClick={() => onOpen(g, `session-${s.id}`)}>
                  <div className="session-icon">
                    <GameIcon game={g} />
                  </div>
                  <div className="session-main">
                    <b>{g.title}</b>
                    <span>
                      {PF[g.platform].name} · {open ? 'em andamento' : `sessão de ${formatDuration(s.durationSeconds)}`} · {relativeTime(s.startedAt)}
                    </span>
                  </div>
                  <button
                    className="btn ghost icobtn"
                    aria-label={`Jogar ${g.title}`}
                    disabled={open}
                    onClick={(e) => {
                      e.stopPropagation()
                      play(g)
                    }}
                  >
                    <IconPlay width={13} height={13} />
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      <section className="block">
        <div className="section-head">
          <h2>Jogados recentemente</h2>
        </div>
        {played.length ? (
          <VirtualGrid items={played} keyOf={(g) => g.id} render={render} onLeave={() => onHover(null)} />
        ) : (
          <div className="empty glass">
            <b>Nenhuma sessão ainda</b>
            <span>Quando você jogar algo, ele aparece aqui.</span>
          </div>
        )}
      </section>
    </ScrollView>
  )
}
