import { memo, useMemo, useState } from 'react'
import type { Game } from '@shared/types'
import { GameCard } from '../components/GameCard'
import { IconDownload, IconDrive, IconGrid, IconPlay, IconResume } from '../components/Icons'
import { ScrollView } from '../components/ScrollView'
import { ShelfRow } from '../components/ShelfRow'
import { artStyle } from '../lib/covers'
import { imgLoad, imgRef } from '../lib/img'
import { formatPlaytime, greeting, lastActivity, PF, relativeTime, totalPlaytime } from '../lib/format'
import { play, useStore } from '../lib/store'

interface Props {
  featured: Game | null
  heroKey: string | null
  onOpen: (g: Game, key: string) => void
  onHover: (g: Game | null) => void
  onGoLibrary: () => void
  onGoInstalled: () => void
}

export function pickFeatured(games: Game[]): Game | null {
  let best: Game | null = null
  for (const g of games) {
    if (g.id >= 1_000_000) continue
    if (!best || (g.installed && !best.installed) || (g.installed === best.installed && lastActivity(g) > lastActivity(best))) best = g
  }
  return best
}

const Shelf = memo(function Shelf({
  id,
  title,
  list,
  heroKey,
  onOpen,
  onHover,
  more,
  Icon
}: {
  id: string
  title: string
  list: Game[]
  heroKey: string | null
  onOpen: (g: Game, key: string) => void
  onHover: (g: Game | null) => void
  more?: () => void
  Icon: typeof IconGrid
}) {
  if (!list.length) return null
  return (
    <section className="block">
      <div className="section-head">
        <h2 className="with-ico">
          <span className="sec-ico">
            <Icon width={16} height={16} />
          </span>
          {title}
        </h2>
        {more ? (
          <button className="link" onClick={more}>
            Ver tudo
          </button>
        ) : null}
      </div>
      <ShelfRow onLeave={() => onHover(null)}>
        {list.map((g) => (
          <GameCard key={g.id} game={g} vtKey={`${id}-${g.id}`} isHero={heroKey === `${id}-${g.id}`} onOpen={onOpen} onHover={onHover} />
        ))}
      </ShelfRow>
    </section>
  )
})

export function HomeView({ featured, heroKey, onOpen, onHover, onGoLibrary, onGoInstalled }: Props) {
  const games = useStore((s) => s.games)
  const sources = useStore((s) => s.sources)

  const shelves = useMemo(() => {
    const real = games.filter((g) => g.id < 1_000_000)
    const recent = real
      .filter((g) => lastActivity(g) > 0 && g.id !== featured?.id)
      .sort((a, b) => lastActivity(b) - lastActivity(a))
      .slice(0, 14)
    const seen = new Set(recent.map((g) => g.id))
    const installed = real
      .filter((g) => g.installed && !seen.has(g.id) && g.id !== featured?.id)
      .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
      .slice(0, 14)
    const library = real
      .filter((g) => !g.installed)
      .sort((a, b) => totalPlaytime(b) - totalPlaytime(a) || a.title.localeCompare(b.title, 'pt-BR'))
      .slice(0, 14)
    return { recent, installed, library, installedCount: games.filter((g) => g.installed).length }
  }, [games, featured])

  return (
    <ScrollView>
      <header className="view-head">
        <div className="view-title">
          <h1>{greeting()}</h1>
          <p>
            {games.length.toLocaleString('pt-BR')} jogos em {sources.filter((s) => s.count > 0).length} plataformas · {shelves.installedCount} instalados
          </p>
        </div>
      </header>

      {featured ? <Hero game={featured} heroKey={heroKey} onOpen={onOpen} /> : null}

      <Shelf id="recent" Icon={IconResume} title="Continuar jogando" list={shelves.recent} heroKey={heroKey} onOpen={onOpen} onHover={onHover} />
      <Shelf id="installed" Icon={IconDrive} title="Instalados" list={shelves.installed} heroKey={heroKey} onOpen={onOpen} onHover={onHover} more={onGoInstalled} />
      <Shelf id="library" Icon={IconGrid} title="Biblioteca" list={shelves.library} heroKey={heroKey} onOpen={onOpen} onHover={onHover} more={onGoLibrary} />
    </ScrollView>
  )
}

function Hero({ game, heroKey, onOpen }: { game: Game; heroKey: string | null; onOpen: (g: Game, key: string) => void }) {
  const [broken, setBroken] = useState(false)
  const [logoBroken, setLogoBroken] = useState(false)
  const running = useStore((s) => s.running.has(game.id))
  const pf = PF[game.platform]
  const canPlay = game.installed || game.platform === 'manual'
  const key = `hero-${game.id}`
  const last = lastActivity(game)
  return (
    <div className="hero">
      <div className="hero-art" style={heroKey === key ? { viewTransitionName: 'game-hero' } : undefined}>
        {game.bannerUrl && !broken ? (
          <img ref={imgRef} className="fade-img" src={game.bannerUrl} alt="" draggable={false} decoding="async" onLoad={imgLoad} onError={() => setBroken(true)} />
        ) : (
          <div className="art" style={artStyle(game.title)} />
        )}
      </div>
      <div className="hero-shade" />
      <div className="hero-body">
        {game.logoUrl && !logoBroken ? (
          <img className="hero-logo" src={game.logoUrl} alt={game.title} draggable={false} onError={() => setLogoBroken(true)} />
        ) : (
          <div className="hero-title">{game.title}</div>
        )}
        <div className="hero-meta">
          <span className="badge" style={{ '--c': pf.color } as React.CSSProperties}>
            <i />
            {pf.name}
          </span>
          <span>{formatPlaytime(totalPlaytime(game))} jogadas</span>
          {last ? <span>· última sessão {relativeTime(last)}</span> : null}
        </div>
        <div className="row">
          <button className="btn btn-play" onClick={() => play(game)} disabled={running}>
            {canPlay ? <IconPlay width={15} height={15} /> : <IconDownload width={17} height={17} />}
            {running ? 'Em jogo' : canPlay ? (last ? 'Continuar' : 'Jogar') : 'Instalar'}
          </button>
          <button className="btn ghost" onClick={() => onOpen(game, key)}>
            Ver detalhes
          </button>
        </div>
      </div>
    </div>
  )
}
