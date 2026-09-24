import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Achievement, Game, ReviewsInfo, Session, WorkshopItem } from '@shared/types'
import { GameIcon } from '../components/GameCover'
import { IconBack, IconCheck, IconDownload, IconExternal, IconFolder, IconPlay, IconStar, IconThumb, IconTrash } from '../components/Icons'
import { SmartResume } from '../components/SmartResume'
import { CommunityRadar } from '../components/CommunityRadar'
import { imgLoad, imgRef } from '../lib/img'
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
  platformName,
  relativeTime,
  totalPlaytime
} from '../lib/format'
import { getState, loadDetails, play, removeGame, setCompleted, toggleFavorite, useStore } from '../lib/store'
import { trailersAllowed, trailerUrl } from '../lib/trailers'

interface Props {
  game: Game
  onBack: () => void
}

/** Página do jogo: banner grande, ícone sobreposto, ação principal e os números que importam. */
export function GamePage({ game, onBack }: Props) {
  const running = useStore((s) => s.running.has(game.id))
  const ramGb = useStore((s) => s.ramGb)
  const [reqOpen, setReqOpen] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [bannerBroken, setBannerBroken] = useState(false)
  const [trailer, setTrailer] = useState<string | null>(null)
  const [hasTrailer, setHasTrailer] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(game.trailerUrl == null && game.platform !== 'manual')
  const [tab, setTab] = useState<Tab>('overview')
  const [reviews, setReviews] = useState<ReviewsInfo | null | undefined>(undefined)
  const [workshop, setWorkshop] = useState<WorkshopItem[] | null | undefined>(undefined)
  const stopped = useRef(false)
  const pf = PF[game.platform]
  const pfColor = game.emuSystem ? '#ff7ad9' : pf.color
  const canPlay = game.installed || game.platform === 'manual'

  useEffect(() => {
    let alive = true
    void loadDetails(game).then(() => alive && setLoadingDetails(false))
    if (game.id < 1_000_000) {
      void window.nexus.games.achievements(game.id).then((a) => alive && setAchievements(a))
    }
    // O trailer é o padrão: começa sozinho (mudo) no banner pouco depois de abrir a página.
    const auto = window.setTimeout(() => {
      void trailerUrl(game.id).then((u) => {
        if (!alive) return
        setHasTrailer(!!u)
        if (u && trailersAllowed() && !stopped.current) setTrailer(u)
      })
    }, 900)
    // Avaliações e Oficina só existem para jogos com página na Steam; null = esconde as abas.
    const extra = window.setTimeout(() => {
      if (game.id >= 1_000_000 || game.emuSystem) {
        setReviews(null)
        setWorkshop(null)
        return
      }
      const load = (attempt: number): void => {
        window.nexus.games.reviews(game.id).then(
          (r) => {
            if (!alive) return
            setReviews(r)
            if (r) void window.nexus.games.workshop(game.id).catch(() => null).then((w) => alive && setWorkshop(w))
            else setWorkshop(null)
          },
          // Falha de rede: mais uma tentativa antes de esconder as abas.
          () => {
            if (alive && attempt < 1) window.setTimeout(() => alive && load(attempt + 1), 3000)
          }
        )
      }
      load(0)
    }, 400)
    return () => {
      alive = false
      window.clearTimeout(auto)
      window.clearTimeout(extra)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id])

  // Começou um jogo (ou o launcher foi para segundo plano): o trailer para.
  const allowed = useStore((s) => s.settings.trailersOnHover && !s.gameActive && !s.background)
  useEffect(() => {
    if (!allowed) setTrailer(null)
  }, [allowed])

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
    stopped.current = true
    if (trailer) return setTrailer(null)
    const u = await trailerUrl(game.id)
    if (u && !getState().gameActive) setTrailer(u)
  }

  const tabs: Array<[Tab, string, number | null]> = [
    ['overview', 'Visão geral', null],
    ...(achievements.length ? [['achievements', 'Conquistas', achievements.length] as [Tab, string, number]] : []),
    ...(reviews ? [['reviews', 'Avaliações', null] as [Tab, string, null]] : []),
    ...(workshop && workshop.length ? [['workshop', 'Oficina', null] as [Tab, string, null]] : [])
  ]

  return (
    <div className="page">
      <div className="page-banner" style={{ viewTransitionName: 'game-hero' }}>
        {banner ? (
          <img ref={imgRef} className="fade-img" src={banner} alt="" draggable={false} decoding="async" onLoad={imgLoad} onError={() => setBannerBroken(true)} />
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
              <span className="badge" style={{ '--c': pfColor } as React.CSSProperties}>
                <i />
                {platformName(game)}
              </span>
              <span className={`badge state ${game.installed ? 'is-installed' : 'is-library'}`}>
                <i />
                {game.installed ? 'Instalado' : 'Na Biblioteca'}
              </span>
              {running ? <span className="badge live">Em execução</span> : null}
              {game.completed ? <span className="badge done">Concluído</span> : null}
            </div>
          </div>
          <div className="page-actions">
            <button className="btn btn-play" onClick={() => play(game)} disabled={running}>
              {canPlay ? <IconPlay width={16} height={16} /> : <IconDownload width={18} height={18} />}
              {running ? 'Em jogo' : canPlay ? 'Jogar' : 'Instalar'}
            </button>
            <button
              className={`btn ghost icobtn lg ${game.completed ? 'done' : ''}`}
              onClick={() => void setCompleted(game, !game.completed)}
              aria-pressed={game.completed}
              aria-label="Marcar como concluído"
              title={game.completed ? 'Concluído (clique para desmarcar)' : 'Marcar como concluído'}
            >
              <IconCheck width={18} height={18} />
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

        {tabs.length > 1 ? (
          <div className="page-tabs" role="tablist" aria-label="Seções do jogo">
            {tabs.map(([id, label, n]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
                {label}
                {n != null ? <em>{id === 'achievements' ? `${unlocked.length}/${n}` : n}</em> : null}
              </button>
            ))}
          </div>
        ) : null}

        {tab === 'achievements' ? <AchievementsTab list={achievements} /> : null}
        {tab === 'reviews' && reviews ? <ReviewsTab info={reviews} steamUrl={steamUrl(game)} /> : null}
        {tab === 'workshop' && workshop ? <WorkshopTab items={workshop} steamUrl={steamUrl(game)} /> : null}

        {tab === 'overview' ? (
        <>
        <SmartResume game={game} />

        <div className="stat-strip">
          <Stat label="Plataforma" value={platformName(game)} />
          <Stat label="Tamanho" value={game.installed ? formatBytes(game.installSize) : 'Não instalado'} />
          <Stat label="Última vez aberto" value={last ? relativeTime(last) : 'Nunca'} hint={last ? formatLongDate(last) : undefined} />
          <Stat label="Tempo jogado" value={formatPlaytime(totalPlaytime(game))} hint={game.platformPlaytimeSeconds ? `${formatPlaytime(game.playtimeSeconds)} no Prisma` : undefined} />
          {game.achievementsTotal ? <Stat label="Conquistas" value={`${game.achievementsUnlocked} de ${game.achievementsTotal}`} /> : null}
          {game.reviewPct != null ? <Stat label="Avaliação Steam" value={`${game.reviewPct}%`} hint={game.reviewLabel ?? undefined} /> : null}
          {game.metacritic ? <Stat label="Metacritic" value={String(game.metacritic)} /> : null}
        </div>

        <div className="page-grid">
          <div className="page-col">
            <section className="glass card pad">
              <h2>Sobre</h2>
              <About text={game.description} loading={loadingDetails} />
            </section>
            <CommunityRadar game={game} />
          </div>
          <div className="page-col">
            <section className="glass card pad">
              <h2>Informações</h2>
              <dl className="facts">
                {game.developer ? <Fact k="Desenvolvedor" v={game.developer} /> : null}
                {game.publisher && game.publisher !== game.developer ? <Fact k="Distribuidora" v={game.publisher} /> : null}
                {game.releaseDate ? <Fact k="Lançamento" v={formatLongDate(game.releaseDate)} /> : null}
                {game.genres.length ? <Fact k="Gêneros" v={game.genres.join(', ')} /> : null}
                {game.franchise ? <Fact k="Franquia" v={game.franchise} /> : null}
                <Fact k="Plataforma" v={game.emuSystem ? `${platformName(game)} (emulador)` : pf.name} />
                <Fact k="Tamanho" v={game.installed ? formatBytes(game.installSize) : 'Não instalado'} />
                {game.reviewLabel ? <Fact k="Steam" v={`${game.reviewLabel}${game.reviewCount ? ` · ${game.reviewCount.toLocaleString('pt-BR')} análises` : ''}`} /> : null}
                {scores(game) ? <Fact k="Notas" v={scores(game)!} /> : null}
                <Fact k="Recorde de sessão" v={record ? formatDuration(record) : '—'} />
                {folder ? <Fact k="Pasta" v={folder} mono /> : null}
              </dl>
              {game.tags.length ? (
                <div className="tag-row">
                  {game.tags.slice(0, 8).map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
            {game.minRequirements ? (
              <section className="glass card pad">
                <div className="section-head">
                  <h2>Requisitos mínimos</h2>
                  {game.minRamGb != null && ramGb > 0 ? (
                    <span className={`req-check ${game.minRamGb <= ramGb ? 'ok' : 'low'}`}>
                      {game.minRamGb <= ramGb ? `Seu PC tem ${ramGb} GB de RAM: ok` : `Pede ${game.minRamGb} GB de RAM; seu PC tem ${ramGb} GB`}
                    </span>
                  ) : null}
                </div>
                <dl className={`reqs ${reqOpen ? 'open' : ''}`}>
                  {game.minRequirements.split('\n').map((line, i) => {
                    const m = line.match(/^([^:]{2,28}):\s*(.+)$/)
                    return m ? (
                      <div key={i}>
                        <dt>{m[1]}</dt>
                        <dd>{m[2]}</dd>
                      </div>
                    ) : (
                      <div key={i} className="req-note">
                        <dd>{line}</dd>
                      </div>
                    )
                  })}
                </dl>
                {game.minRequirements.split('\n').length > 5 ? (
                  <button className="link more" onClick={() => setReqOpen((v) => !v)}>
                    {reqOpen ? 'Mostrar menos' : 'Ver todos'}
                  </button>
                ) : null}
              </section>
            ) : null}
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
              {game.platform === 'manual' && !game.emuSystem ? (
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
        </>
        ) : null}
      </div>
    </div>
  )
}

type Tab = 'overview' | 'achievements' | 'reviews' | 'workshop'

function steamUrl(g: Game): string | null {
  return g.platform === 'steam' ? `https://store.steampowered.com/app/${g.platformId}` : null
}

/** Todas as conquistas: desbloqueadas primeiro (mais recentes no topo), depois as que faltam. */
function AchievementsTab({ list }: { list: Achievement[] }) {
  const [show, setShow] = useState<'all' | 'done' | 'todo'>('all')
  const done = list.filter((a) => a.unlockedAt != null).sort((a, b) => (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0))
  const todo = list.filter((a) => a.unlockedAt == null)
  const rows = show === 'done' ? done : show === 'todo' ? todo : [...done, ...todo]
  const pct = Math.round((100 * done.length) / Math.max(1, list.length))
  return (
    <section className="glass card pad tab-panel">
      <div className="section-head">
        <div className="ach-summary">
          <b>{pct}%</b>
          <span>
            {done.length} de {list.length} conquistas
          </span>
        </div>
        <div className="segmented sm" role="tablist" aria-label="Filtrar conquistas">
          {(
            [
              ['all', 'Todas'],
              ['done', 'Desbloqueadas'],
              ['todo', 'Bloqueadas']
            ] as const
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={show === id} className={show === id ? 'on' : ''} onClick={() => setShow(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="ach-bar">
        <i style={{ width: `${pct}%` }} />
      </div>
      <ul className="ach-list full">
        {rows.map((a) => (
          <li key={a.apiName} className={a.unlockedAt == null ? 'locked' : undefined}>
            {a.icon ? <img src={a.icon} alt="" loading="lazy" /> : <span className="ach-dot" />}
            <div>
              <b>{a.name}</b>
              {a.description ? <span>{a.description}</span> : null}
            </div>
            <time>{a.unlockedAt ? formatDate(a.unlockedAt) : 'Bloqueada'}</time>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ReviewsTab({ info, steamUrl }: { info: ReviewsInfo; steamUrl: string | null }) {
  const tone = info.pct == null ? '' : info.pct >= 70 ? 'good' : info.pct >= 40 ? 'mixed' : 'bad'
  return (
    <div className="tab-panel">
      <section className="glass card pad rev-summary">
        <div className={`rev-score ${tone}`}>{info.pct != null ? `${info.pct}%` : '—'}</div>
        <div>
          <b>{info.label ?? 'Sem avaliações suficientes'}</b>
          <span className="muted">{info.total.toLocaleString('pt-BR')} análises na Steam</span>
        </div>
        {steamUrl ? (
          <button className="btn ghost sm" onClick={() => window.nexus.shell.openExternal(`${steamUrl}/#app_reviews_hash`)}>
            Ver todas
            <IconExternal width={13} height={13} />
          </button>
        ) : null}
      </section>
      {info.reviews.length ? (
        <div className="rev-list">
          {info.reviews.map((r, i) => (
            <Review key={i} r={r} />
          ))}
        </div>
      ) : (
        <p className="muted">Nenhuma análise escrita para mostrar.</p>
      )}
    </div>
  )
}

function Review({ r }: { r: ReviewsInfo['reviews'][number] }) {
  const [open, setOpen] = useState(false)
  const long = r.text.length > 320
  return (
    <article className={`glass card rev ${r.up ? 'up' : 'down'}`}>
      <header>
        <span className="rev-thumb">
          <IconThumb width={15} height={15} down={!r.up} />
          {r.up ? 'Recomendado' : 'Não recomendado'}
        </span>
        <span className="muted small">
          {r.hours ? `${r.hours.toLocaleString('pt-BR')} h jogadas · ` : ''}
          {formatDate(r.date)}
          {r.lang !== 'brazilian' ? ' · em inglês' : ''}
        </span>
      </header>
      <p className={open || !long ? '' : 'clamp'}>{r.text}</p>
      <footer>
        {long ? (
          <button className="link" onClick={() => setOpen((v) => !v)}>
            {open ? 'Mostrar menos' : 'Ler tudo'}
          </button>
        ) : (
          <span />
        )}
        {r.votes ? <span className="muted small">{r.votes.toLocaleString('pt-BR')} acharam útil</span> : null}
      </footer>
    </article>
  )
}

function WorkshopTab({ items, steamUrl }: { items: WorkshopItem[]; steamUrl: string | null }) {
  return (
    <div className="tab-panel">
      <div className="section-head">
        <h2>Em alta na Oficina</h2>
        {steamUrl ? (
          <button className="btn ghost sm" onClick={() => window.nexus.shell.openExternal(steamUrl.replace('store.steampowered.com/app', 'steamcommunity.com/app') + '/workshop/')}>
            Abrir a Oficina
            <IconExternal width={13} height={13} />
          </button>
        ) : null}
      </div>
      <div className="ws-grid">
        {items.map((w) => (
          <button key={w.id} className="ws-item glass" onClick={() => window.nexus.shell.openExternal(w.url)} title={w.title}>
            <img src={w.image} alt="" loading="lazy" />
            <span>{w.title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Notas agregadas conhecidas: Steam (% positivas) e Metacritic. */
function scores(g: Game): string | null {
  const parts: string[] = []
  if (g.reviewPct != null) parts.push(`Steam ${g.reviewPct}%`)
  if (g.metacritic) parts.push(`Metacritic ${g.metacritic}`)
  return parts.length ? parts.join(' · ') : null
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
