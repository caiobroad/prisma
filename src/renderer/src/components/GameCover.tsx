import { useState } from 'react'
import type { Game } from '@shared/types'
import { artStyle, monogram } from '../lib/covers'

/**
 * Capa vertical 2:3. Sem box art oficial, monta um pôster: banner recortado ao centro,
 * ícone e título; sem nada disso, gradiente estável com monograma.
 */
/** URLs que já falharam nesta sessão: a lista virtual remonta capas ao rolar, e não vale pedir de novo. */
const broken = new Set<string>()
const ok = (url: string | null): url is string => !!url && !broken.has(url)

export function GameCover({ game }: { game: Game }) {
  const [, force] = useState(0)
  const icon = game.iconUrl ?? game.iconData
  const fail = (url: string) => () => {
    broken.add(url)
    force((n) => n + 1)
  }

  if (ok(game.coverUrl)) {
    return <img className="cover-img" src={game.coverUrl} alt="" loading="lazy" decoding="async" draggable={false} onError={fail(game.coverUrl)} />
  }
  return (
    <div className="cover-gen" style={artStyle(game.title)}>
      {ok(game.bannerUrl) ? (
        <img className="cover-gen-bg" src={game.bannerUrl} alt="" loading="lazy" draggable={false} onError={fail(game.bannerUrl)} />
      ) : null}
      {icon ? <img className="cover-gen-icon" src={icon} alt="" draggable={false} /> : <span className="cover-gen-mono">{monogram(game.title)}</span>}
      <span className="cover-gen-title">{game.title}</span>
    </div>
  )
}

/** Ícone/logo quadrado (120×120 na página do jogo). */
export function GameIcon({ game }: { game: Game }) {
  // Ícone quadrado, depois logotipo, depois o topo da capa recortado, e por fim o monograma.
  const sources = [game.iconUrl, game.iconData, game.logoUrl, game.coverUrl].filter((s): s is string => !!s)
  const [i, setI] = useState(0)
  const src = sources[i]
  if (!src) {
    return (
      <div className="icon-mono" style={artStyle(game.title)}>
        {monogram(game.title)}
      </div>
    )
  }
  const cls = src === game.logoUrl ? 'icon-logo' : src === game.coverUrl ? 'icon-cover' : 'icon-img'
  return <img className={cls} src={src} alt="" draggable={false} onError={() => setI((n) => n + 1)} />
}
