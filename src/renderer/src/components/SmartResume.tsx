import { memo, useEffect, useState } from 'react'
import type { Game, ResumeCard } from '@shared/types'
import { IconCamera, IconPlay, IconThermo, IconTrophy } from './Icons'
import { formatDuration, relativeTime } from '../lib/format'
import { play, useStore } from '../lib/store'
import { imgLoad, imgRef } from '../lib/img'

/**
 * Smart Resume: o cartão da última sessão logo abaixo do banner. Última imagem da tela,
 * quanto durou, FPS médio, temperaturas máximas e as conquistas desbloqueadas nela.
 */
export const SmartResume = memo(function SmartResume({ game }: { game: Game }) {
  const running = useStore((s) => s.running.has(game.id))
  const [card, setCard] = useState<ResumeCard | null>(null)
  const [shotBroken, setShotBroken] = useState(false)

  useEffect(() => {
    if (game.id >= 1_000_000 || running) return
    let alive = true
    void window.nexus.games.resume(game.id).then((c) => {
      if (!alive) return
      setShotBroken(false)
      setCard(c)
    })
    return () => {
      alive = false
    }
  }, [game.id, running, game.playtimeSeconds])

  if (!card) return null
  const s = card.session
  const canPlay = game.installed || game.platform === 'manual'
  const shot = !shotBroken ? s.screenshot : null
  return (
    <section className="resume glass">
      <div className="resume-shot">
        {shot ? (
          <img ref={imgRef} className="fade-img" src={shot} alt="Última imagem da sessão" onLoad={imgLoad} onError={() => setShotBroken(true)} draggable={false} />
        ) : game.bannerUrl ? (
          <img className="resume-fallback" src={game.bannerUrl} alt="" draggable={false} />
        ) : null}
        <span className="resume-tag">
          <IconCamera width={13} height={13} />
          {shot ? 'Última imagem' : 'Sem captura'}
        </span>
      </div>
      <div className="resume-body">
        <p className="eyebrow">Smart Resume</p>
        <h3>Sua última sessão · {relativeTime(s.endedAt ?? s.startedAt)}</h3>
        <div className="resume-stats">
          <div>
            <span>Duração</span>
            <b>{formatDuration(s.durationSeconds)}</b>
          </div>
          <div>
            <span>FPS médio</span>
            <b>{s.avgFps ? Math.round(s.avgFps) : '—'}</b>
          </div>
          <div>
            <span>
              <IconThermo width={12} height={12} /> CPU máx.
            </span>
            <b>{s.maxCpuTemp ? `${Math.round(s.maxCpuTemp)} °C` : '—'}</b>
          </div>
          <div>
            <span>
              <IconThermo width={12} height={12} /> GPU máx.
            </span>
            <b>{s.maxGpuTemp ? `${Math.round(s.maxGpuTemp)} °C` : '—'}</b>
          </div>
        </div>
        {card.achievements.length ? (
          <div className="resume-ach">
            <IconTrophy width={15} height={15} />
            <span>
              {card.achievements.length} conquista{card.achievements.length > 1 ? 's' : ''} nesta sessão
            </span>
            <div className="resume-ach-icons">
              {card.achievements.slice(0, 6).map((a) =>
                a.icon ? <img key={a.apiName} src={a.icon} alt={a.name} title={a.name} loading="lazy" /> : <i key={a.apiName} title={a.name} />
              )}
            </div>
          </div>
        ) : (
          <p className="muted small">Nenhuma conquista nova nesta sessão.</p>
        )}
        {canPlay && !running ? (
          <button className="btn btn-play sm" onClick={() => play(game)}>
            <IconPlay width={14} height={14} />
            Continuar de onde parou
          </button>
        ) : null}
      </div>
    </section>
  )
})
