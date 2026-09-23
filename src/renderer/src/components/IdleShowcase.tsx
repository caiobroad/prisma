import { useEffect, useMemo, useState } from 'react'
import type { Game } from '@shared/types'
import { TrailerVideo } from './TrailerVideo'
import { formatPlaytime, PF, totalPlaytime } from '../lib/format'
import { useStore } from '../lib/store'
import { scheduleRelease, trailerUrl } from '../lib/trailers'

const SLIDE_MS = 9000

function shuffle<T>(a: T[]): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

/**
 * Vitrine ociosa: banners com zoom lento que se trocam em crossfade, um trailer
 * silencioso a cada três destaques e uma faixa de capas deslizando devagar.
 * Tudo em transform/opacity (GPU); qualquer movimento encerra no mesmo instante.
 */
export function IdleShowcase({ onSlide }: { onSlide: (g: Game | null) => void }) {
  const games = useStore((s) => s.games)
  const deck = useMemo(() => shuffle(games.filter((g) => g.id < 1_000_000 && g.bannerUrl)).slice(0, 30), [games])
  const covers = useMemo(() => shuffle(games.filter((g) => g.id < 1_000_000 && g.coverUrl)).slice(0, 12), [games])
  const [i, setI] = useState(0)
  const [trailer, setTrailer] = useState<string | null>(null)
  const [clock, setClock] = useState(() => new Date())
  const game = deck.length ? deck[i % deck.length] : null
  const prev = deck.length > 1 ? deck[(i - 1 + deck.length) % deck.length] : null

  useEffect(() => {
    const t = window.setInterval(() => setI((n) => n + 1), SLIDE_MS)
    const c = window.setInterval(() => setClock(new Date()), 15000)
    return () => {
      window.clearInterval(t)
      window.clearInterval(c)
    }
  }, [])

  useEffect(() => {
    onSlide(game)
    setTrailer(null)
    if (!game || i % 3 !== 2) return
    let alive = true
    void trailerUrl(game.id).then((u) => alive && u && setTrailer(u))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id])

  // Ao sair: zona volta ao normal e os banners grandes saem da memória.
  useEffect(
    () => () => {
      onSlide(null)
      scheduleRelease(800)
    },
    [onSlide]
  )

  if (!game) return null
  return (
    <div className="showcase" aria-hidden="true">
      {prev && prev.id !== game.id ? <img key={`p${prev.id}-${i}`} className="sc-slide out" src={prev.bannerUrl!} alt="" /> : null}
      <img key={`${game.id}-${i}`} className="sc-slide in" src={game.bannerUrl!} alt="" />
      {trailer ? <TrailerVideo url={trailer} className="sc-trailer" /> : null}
      <div className="sc-shade" />
      <div className="sc-top">
        <span>{clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        <em>Mova o mouse ou toque no controle para voltar</em>
      </div>
      <div className="sc-info" key={`info-${game.id}-${i}`}>
        <span className="sc-eyebrow">Da sua biblioteca</span>
        {game.logoUrl ? <img className="sc-logo" src={game.logoUrl} alt="" /> : <div className="sc-title">{game.title}</div>}
        <span className="sc-meta">
          {PF[game.platform].name}
          {totalPlaytime(game) ? ` · ${formatPlaytime(totalPlaytime(game))} jogadas` : ''}
          {game.installed ? ' · Instalado' : ''}
        </span>
      </div>
      <div className="sc-marquee">
        <div className="sc-track">
          {[...covers, ...covers].map((g, k) => (
            <img key={`${g.id}-${k}`} src={g.coverUrl!} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.display = 'none')} />
          ))}
        </div>
      </div>
    </div>
  )
}
