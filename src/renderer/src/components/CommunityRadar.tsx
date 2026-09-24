import { memo, useEffect, useState } from 'react'
import type { CommunityInfo, Game } from '@shared/types'
import { IconExternal, IconRadar } from './Icons'
import { formatDate } from '../lib/format'

const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

/** Radar da Comunidade: quantos jogam agora na Steam, a avaliação atual e as notícias mais recentes. */
export const CommunityRadar = memo(function CommunityRadar({ game }: { game: Game }) {
  const [info, setInfo] = useState<CommunityInfo | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (game.id >= 1_000_000) return
    let alive = true
    setInfo(null)
    void window.nexus.games
      .community(game.id)
      .then((c) => alive && setInfo(c))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [game.id])

  if (failed) return null
  const loading = !info
  if (info && !info.appid) {
    return (
      <section className="glass card pad radar">
        <h2 className="with-ico">
          <span className="sec-ico">
            <IconRadar width={16} height={16} />
          </span>
          Radar da Comunidade
        </h2>
        <p className="muted small">Este jogo não tem página na Steam, então não há dados da comunidade.</p>
      </section>
    )
  }
  return (
    <section className="glass card pad radar">
      <div className="section-head">
        <h2 className="with-ico">
          <span className="sec-ico">
            <IconRadar width={16} height={16} />
          </span>
          Radar da Comunidade
        </h2>
        <span className="muted small">Steam · atualiza a cada 10 min</span>
      </div>
      <div className="radar-kpis">
        <div className="radar-kpi live">
          <span>Jogando agora</span>
          {loading ? <i className="skel-line" /> : <b>{info.playersNow != null ? compact.format(info.playersNow) : '—'}</b>}
        </div>
        <div className="radar-kpi">
          <span>Avaliação</span>
          {loading ? (
            <i className="skel-line" />
          ) : (
            <b className={reviewTone(info.reviewPct)}>{info.reviewPct != null ? `${info.reviewPct}%` : '—'}</b>
          )}
          {info?.reviewLabel ? <small>{info.reviewLabel}</small> : null}
        </div>
        <div className="radar-kpi">
          <span>Análises</span>
          {loading ? <i className="skel-line" /> : <b>{info.reviewCount != null ? compact.format(info.reviewCount) : '—'}</b>}
        </div>
      </div>
      <h3 className="radar-sub">Atualizações e notícias</h3>
      {loading ? (
        <ul className="news">
          {[0, 1, 2].map((i) => (
            <li key={i} className="news-skel">
              <i className="skel-line" />
              <i className="skel-line short" />
            </li>
          ))}
        </ul>
      ) : info.news.length ? (
        <ul className="news">
          {info.news.slice(0, 5).map((n) => (
            <li key={n.url}>
              <button onClick={() => window.nexus.shell.openExternal(n.url)} title="Abrir no navegador">
                <span className="news-meta">
                  <em className={n.source === 'Atualização oficial' ? 'official' : ''}>{n.source}</em>
                  {formatDate(n.date)}
                </span>
                <b>{n.title}</b>
                {n.excerpt ? <span className="news-ex">{n.excerpt}</span> : null}
                <IconExternal width={13} height={13} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">Sem notícias recentes.</p>
      )}
    </section>
  )
})

function reviewTone(p: number | null): string {
  if (p == null) return ''
  return p >= 80 ? 'good' : p >= 60 ? 'mixed' : 'bad'
}
