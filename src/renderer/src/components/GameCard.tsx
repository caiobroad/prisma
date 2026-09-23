import { memo, useEffect, useRef, useState } from 'react'
import type { Game } from '@shared/types'
import { GameCover } from './GameCover'
import { TrailerVideo } from './TrailerVideo'
import { PF } from '../lib/format'
import { play, useStore } from '../lib/store'
import { trailersAllowed, trailerUrl } from '../lib/trailers'

interface Props {
  game: Game
  /** Identifica esta capa na transição para a página do jogo. */
  vtKey: string
  isHero: boolean
  onOpen: (g: Game, vtKey: string) => void
  onHover?: (g: Game | null) => void
}

const TRAILER_DELAY = 1000

/**
 * Capa da biblioteca. Hover: inclinação 3D que segue o cursor, zoom, brilho e sombra
 * que se desloca para o lado oposto da inclinação. Após ~1 s parado, vira trailer silencioso;
 * ao sair, volta para a capa na hora (o vídeo é destruído, não pausado).
 */
export const GameCard = memo(function GameCard({ game, vtKey, isHero, onOpen, onHover }: Props) {
  const running = useStore((s) => s.running.has(game.id))
  const tilt = useRef<HTMLDivElement>(null)
  const hovering = useRef(false)
  const timer = useRef<number | null>(null)
  const [trailer, setTrailer] = useState<string | null>(null)
  const pf = PF[game.platform]

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    []
  )

  const enter = (): void => {
    hovering.current = true
    onHover?.(game)
    if (!trailersAllowed()) return
    timer.current = window.setTimeout(async () => {
      const url = await trailerUrl(game.id)
      if (hovering.current && url && trailersAllowed()) setTrailer(url)
    }, TRAILER_DELAY)
  }

  const leave = (): void => {
    hovering.current = false
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    setTrailer(null)
    const el = tilt.current
    if (el) {
      el.style.setProperty('--rx', '0deg')
      el.style.setProperty('--ry', '0deg')
      el.style.setProperty('--sx', '0px')
      el.style.setProperty('--sy', '18px')
    }
    onHover?.(null)
  }

  const move = (e: React.PointerEvent): void => {
    const el = tilt.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--ry', `${(px * 10).toFixed(2)}deg`)
    el.style.setProperty('--rx', `${(-py * 8).toFixed(2)}deg`)
    el.style.setProperty('--gx', `${((px + 0.5) * 100).toFixed(1)}%`)
    el.style.setProperty('--gy', `${((py + 0.5) * 100).toFixed(1)}%`)
    // Sombra dinâmica: a luz vem do cursor, a sombra vai para o lado oposto.
    el.style.setProperty('--sx', `${(-px * 22).toFixed(1)}px`)
    el.style.setProperty('--sy', `${(18 - py * 14).toFixed(1)}px`)
  }

  return (
    <div
      className="gcard"
      role="button"
      tabIndex={0}
      aria-label={`${game.title}, ${pf.name}, ${game.installed ? 'instalado' : 'na biblioteca'}`}
      onClick={() => onOpen(game, vtKey)}
      onDoubleClick={() => play(game)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(game, vtKey)
        }
      }}
      onPointerEnter={enter}
      onPointerMove={move}
      onPointerLeave={leave}
      onFocus={() => onHover?.(game)}
      onBlur={() => onHover?.(null)}
    >
      <div className="gcard-tilt" ref={tilt} style={isHero ? { viewTransitionName: 'game-hero' } : undefined}>
        <GameCover game={game} />
        {trailer ? <TrailerVideo url={trailer} /> : null}
        <span className={`gcard-state ${game.installed ? 'is-installed' : 'is-library'}`}>
          <i />
          {running ? 'Em jogo' : game.installed ? 'Instalado' : 'Na Biblioteca'}
        </span>
        <span className="gcard-glare" />
      </div>
      <div className="gcard-info">
        <div className="gcard-name" title={game.title}>
          {game.title}
        </div>
        <div className="gcard-pf" style={{ '--c': pf.color } as React.CSSProperties}>
          <i />
          {pf.name}
        </div>
      </div>
    </div>
  )
})
