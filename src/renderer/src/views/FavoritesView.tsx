import { useCallback, useMemo } from 'react'
import type { Game } from '@shared/types'
import { GameCard } from '../components/GameCard'
import { ScrollView } from '../components/ScrollView'
import { VirtualGrid } from '../components/VirtualGrid'
import { useStore } from '../lib/store'

interface Props {
  heroKey: string | null
  onOpen: (g: Game, key: string) => void
  onHover: (g: Game | null) => void
}

export function FavoritesView({ heroKey, onOpen, onHover }: Props) {
  const games = useStore((s) => s.games)
  const favs = useMemo(() => games.filter((g) => g.favorite).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')), [games])
  const render = useCallback(
    (g: Game) => <GameCard game={g} vtKey={`fav-${g.id}`} isHero={heroKey === `fav-${g.id}`} onOpen={onOpen} onHover={onHover} />,
    [heroKey, onOpen, onHover]
  )
  return (
    <ScrollView>
      <header className="view-head">
        <div className="view-title">
          <h1>Favoritos</h1>
          <p>
            {favs.length} {favs.length === 1 ? 'jogo' : 'jogos'}
          </p>
        </div>
      </header>
      {favs.length === 0 ? (
        <div className="empty glass">
          <b>Nenhum favorito ainda</b>
          <span>Abra um jogo e toque na estrela para ele aparecer aqui.</span>
        </div>
      ) : (
        <VirtualGrid items={favs} keyOf={(g) => g.id} render={render} onLeave={() => onHover(null)} />
      )}
    </ScrollView>
  )
}
