import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Achievement, Game, Session } from '@shared/types'
import { GameIcon } from '../components/GameCover'
import { IconBack, IconDownload, IconFolder, IconPlay, IconStar, IconTrash } from '../components/Icons'
import { TrailerVideo } from '../components/TrailerVideo'
import { artStyle } from '../lib/covers'
import {
  formatBytes,
  formatDate,
  formatDuration,
  formatLongDate,
  formatPlaytime,
  lastActivity,
  PF,
  relativeTime,
  totalPlaytime
} from '../lib/format'
import { loadDetails, play, removeGame, toggleFavorite, useStore } from '../lib/store'
import { trailersAllowed, trailerUrl } from '../lib/trailers'

interface Props {
  game: Game
  onBack: () => void
}

/** Página do jogo: banner grande, ícone sobreposto, ação principal e os números que importam. */
export function GamePage({ game, onBack }: Props) {
  const running = useStore((s) => s.running.has(game.id))
  const [sessions, setSessions] = useState<Session[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [bannerBroken, setBannerBroken] = useState(false)
  const [trailer, setTrailer] = useState<string | null>(null)
  const [hasTrailer, setHasTrailer] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(game.trailerUrl == null && game.platform !== 'manual')
  const pf = PF[game.platform]
  const canPlay = game.installed || game.platform === 'manual'

  useEffect(() => {
    let alive = true
    void loadDetails(game).then(() => alive && setLoadingDetails(false))
    if (game.id < 1_000_000) {
      void window.nexus.games.achievements(game.id).then((a) => alive && setAchievements(a))
    }
    void trailerUrl(game.id).then((u) => alive && setHasTrailer(!!u))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id])

  useEffect(() => {
    if (game.id >= 1_000_000) return
    void window.nexus.games.sessions(game.id, 8).then(setSessions)
  }, [game.id, game.playtimeSeconds, running])

  const folder = game.installDir ?? (game.exePath ? game.exePath.replace(/[\\/][^\\/]+$/, '') : null)
  const banner = !bannerBroken ? game.bannerUrl : null
  const last = lastActivity(game)
  const unlocked = achievements.filter((a) => a.unlockedAt != null)
  const record = sessions.reduce((m, s) => Math.max(m, s.durationSeconds), 0)

  const toggleTrailer = async (): Promise<void> => {
    if (trailer) return setTrailer(null)
    const u = await trailerUrl(game.id)
    if (u && trailersAllowed()) setTrailer(u)
  }

  return (
    <div className="page">
      <div className="page-banner" style={{ viewTransitionName: 'game-hero' }}>
        {banner ? (
          <img src={banner} alt="" draggable={false} decoding="async" onError={() => setBannerBroken(true)} />
        ) : game.coverUrl ? (
          <img className="blur-fill" src={game.coverUrl} alt="" draggable={false} />
        ) : (
          <div className="art" style={artStyle(game.title)} />
        )}
        {trailer ? <TrailerVideo url={trailer} className="banner-trailer" /> : null}
        <div className="page-banner-shade" />
        <button className="btn ghost page-back" onClick={onBack}>
          <IconBack width={15} height={15} />
          Voltar
        </button>
        {hasTrailer ? (
          <button className="btn ghost page-trailer" onClick={() => void toggleTrailer()}>
            {trailer ? 'Parar trailer' : '▶ Trailer'}
          </button>
        ) : null}
        <div className="page-icon glass frost">
          <GameIcon game={game} />
        </div>
      </div>

      <div className="page-body">
        <div className="page-head">
          <div className="page-title-wrap">
            <h1 className="page-title">{game.title}</h1>
            <div className="page-meta">
              <span className="badge" style={{ '--c': pf.color } as React.CSSProperties}>
                <i />
                {pf.name}
              </span>
              <span className={`badge state ${game.installed ? 'is-installed' : 'is-library'}`}>
                <i />
                {game.installed ? 'Instalado' : 'Na Biblioteca'}
              </span>
              {running ? <span className="badge live">Em execução</span> : null}
            </div>
          </div>
          <div className="page-actions">
            <button className="btn btn-play" onClick={() => play(game)} disabled={running}>
              {canPlay ? <IconPlay width={16} height={16} /> : <IconDownload width={18} height={18} />}
              {running ? 'Em jogo' : canPlay ? 'Jogar' : 'Instalar'}
            </button>
            <button className={`btn ghost icobtn lg ${game.favorite ? 'fav' : ''}`} onClick={() => void toggleFavorite(game)} aria-label="Favoritar" title="Favoritar">
              <IconStar width={18} height={18} filled={game.favorite} />
            </button>
            {folder ? (
              <button className="btn ghost icobtn lg" onClick={() => void window.nexus.shell.openPath(folder)} aria-label="Abrir pasta" title="Abrir pasta de instalação">
                <IconFolder width={18} height={18} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="stat-strip">
          <Stat label="Plataforma" value={pf.name} />
          <Stat label="Tamanho" value={game.installed ? formatBytes(game.installSize) : 'Não instalado'} />
          <Stat label="Última vez aberto" value={last ? relativeTime(last) : 'Nunca'} hint={last ? formatLongDate(last) : undefined} />
          <Stat label="Tempo jogado" value={formatPlaytime(totalPlaytime(game))} hint={game.platformPlaytimeSeconds ? `${formatPlaytime(game.playtimeSeconds)} no Prisma` : undefined} />
          {game.achievementsTotal ? <Stat label="Conquistas" value={`${game.achievementsUnlocked} de ${game.achievementsTotal}`} /> : null}
        </div>

        <div className="page-grid">
          <div className="page-col">
            <section className="glass card pad">
              <h2>Sobre</h2>
              <About text={game.description} loading={loadingDetails} />
            </section>
            {achievements.length ? (
              <section className="glass card pad">
                <div className="section-head">
                  <h2>Conquistas</h2>
                  <span className="muted small">
                    {unlocked.length} de {achievements.length}
                  </span>
                </div>
                <div className="ach-bar">
                  <i style={{ width: `${(100 * unlocked.length) / achievements.length}%` }} />
                </div>
                <ul className="ach-list">
                  {unlocked.slice(0, 8).map((a) => (
                    <li key={a.apiName}>
                      {a.icon ? <img src={a.icon} alt="" loading="lazy" /> : <span className="ach-dot" />}
                      <div>
                        <b>{a.name}</b>
                        {a.description ? <span>{a.description}</span> : null}
                      </div>
                      <time>{a.unlockedAt ? formatDate(a.unlockedAt) : '—'}</time>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
          <div className="page-col">
            <section className="glass card pad">
              <h2>Informações</h2>
              <dl className="facts">
                {game.developer ? <Fact k="Desenvolvedor" v={game.developer} /> : null}
                {game.publisher && game.publisher !== game.developer ? <Fact k="Distribuidora" v={game.publisher} /> : null}
                {game.releaseDate ? <Fact k="Lançamento" v={formatLongDate(game.releaseDate)} /> : null}
                {game.genres.length ? <Fact k="Gêneros" v={game.genres.join(', ')} /> : null}
                <Fact k="Recorde de sessão" v={record ? formatDuration(record) : '—'} />
                {folder ? <Fact k="Pasta" v={folder} mono /> : null}
              </dl>
            </section>
            <section className="glass card pad">
              <h2>Sessões no Prisma</h2>
              {sessions.length ? (
                <div className="sessions">
                  {sessions.map((s) => (
                    <div key={s.id}>
                      <span>{formatDate(s.startedAt)}</span>
                      <span>
                        {s.endedAt == null ? 'em andamento' : formatDuration(s.durationSeconds)}
                        {s.avgFps ? ` · ${Math.round(s.avgFps)} FPS` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">O tempo passa a contar a partir do primeiro “Jogar” pelo Prisma.</p>
              )}
              {game.platform === 'manual' ? (
                confirmRemove ? (
                  <div className="row confirm">
                    <span className="muted">Remover da biblioteca? O arquivo não é apagado.</span>
                    <button className="btn ghost sm" onClick={() => setConfirmRemove(false)}>
                      Cancelar
                    </button>
                    <button className="btn danger sm" onClick={() => void removeGame(game).then(onBack)}>
                      Remover
                    </button>
                  </div>
                ) : (
                  <button className="btn danger sm spaced" onClick={() => setConfirmRemove(true)}>
                    <IconTrash width={14} height={14} />
                    Remover da biblioteca
                  </button>
                )
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat" title={hint}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

function Fact({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd className={mono ? 'mono' : undefined}>{v}</dd>
    </div>
  )
}

/** Descrição com "Mostrar mais" quando passa de 5 linhas; nunca corta no meio sem avisar. */
function About({ text, loading }: { text: string | null; loading: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [open, setOpen] = useState(false)
  const [overflow, setOverflow] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (el) setOverflow(el.scrollHeight > el.clientHeight + 2)
  }, [text])
  if (!text) return <p className="muted">{loading ? 'Buscando descrição…' : 'Sem descrição disponível para este jogo.'}</p>
  return (
    <>
      <p ref={ref} className={`about ${open ? 'open' : ''}`}>
        {text}
      </p>
      {overflow || open ? (
        <button className="link more" onClick={() => setOpen((v) => !v)}>
          {open ? 'Mostrar menos' : 'Mostrar mais'}
        </button>
      ) : null}
    </>
  )
}
