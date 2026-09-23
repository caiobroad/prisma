import { useState } from 'react'
import type { Game } from '@shared/types'
import { artStyle } from '../lib/covers'
import { returnFromGame } from '../lib/store'

interface Props {
  game: Game | null
  phase: 'out' | 'playing' | 'return'
}

/**
 * Saída cinematográfica: a interface recua e desfoca, o banner do jogo surge de um
 * desfoque forte até ficar nítido, com zoom lento. O jogo só abre no fim (1,5 s).
 * No retorno, o caminho inverso.
 */
export function LaunchCinematic({ game, phase }: Props) {
  const [logoBroken, setLogoBroken] = useState(false)
  const art = game?.bannerUrl ?? game?.coverUrl ?? null
  return (
    <div className={`cine cine-${phase}`} aria-live="polite">
      <div className="cine-art">{art ? <img src={art} alt="" draggable={false} /> : game ? <div className="art" style={artStyle(game.title)} /> : null}</div>
      <div className="cine-shade" />
      {game ? (
        <div className="cine-body">
          {game.logoUrl && !logoBroken ? (
            <img className="cine-logo" src={game.logoUrl} alt={game.title} onError={() => setLogoBroken(true)} />
          ) : (
            <div className="cine-title">{game.title}</div>
          )}
          <div className="cine-status">
            {phase === 'out' ? (
              <>
                <span className="cine-bar">
                  <i />
                </span>
                Iniciando
              </>
            ) : phase === 'playing' ? (
              <>
                <span className="cine-live" />
                Em jogo
                <button className="btn ghost sm" onClick={returnFromGame}>
                  Voltar ao launcher
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
