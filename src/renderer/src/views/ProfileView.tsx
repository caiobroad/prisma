import { useEffect, useMemo, useState } from 'react'
import type { Friend, FriendLibrary, ProfileStats } from '@shared/types'
import { Avatar } from '../components/Avatar'
import { DnaRadar, renderDnaCard } from '../components/DnaRadar'
import { IconCamera, IconCopy, IconEdit, IconExternal, IconShare, IconSwitch, IconUsers } from '../components/Icons'
import { ScrollView } from '../components/ScrollView'
import { artStyle } from '../lib/covers'
import { DNA_AXES, DNA_TITLES, dnaMatch, type Dna } from '../lib/dna'
import { formatDuration, formatHours } from '../lib/format'
import { friendStatus, gamesByAppKey, invalidateSocial, libraryDna, useFriends, useLibrary } from '../lib/social'
import { saveProfile, switchProfile, toast, useStore } from '../lib/store'

interface Props {
  /** Perfil de um amigo; ausente = o próprio perfil. */
  friend?: Friend | null
  onFriend: (f: Friend) => void
  onFriends: () => void
}

/** Página de perfil: banner, foto, estatísticas, Game DNA e comparações com amigos. */
export function ProfileView({ friend, onFriend, onFriends }: Props) {
  const me = useStore((s) => s.profile)
  const profiles = useStore((s) => s.profiles)
  const games = useStore((s) => s.games)
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [editing, setEditing] = useState(false)
  const [nick, setNick] = useState(me?.nickname ?? '')
  const [compareId, setCompareId] = useState<string | null>(null)
  const friends = useFriends()

  const own = !friend
  const localFriend = friend?.source === 'local' ? profiles.find((p) => `local:${p.id}` === friend.id) : null
  const myLib = useLibrary('me', games.length)
  const theirLib = useLibrary(friend ? friend.id : compareId)

  useEffect(() => {
    const id = own ? me?.id : localFriend?.id
    if (id == null) return setStats(null)
    let alive = true
    void window.nexus.profiles.stats(id).then((s) => alive && setStats(s))
    return () => {
      alive = false
    }
  }, [own, me?.id, localFriend?.id, games.length])

  const myDna = useMemo(() => (myLib ? libraryDna(myLib) : null), [myLib])
  const theirDna = useMemo(() => (theirLib?.available ? libraryDna(theirLib) : null), [theirLib])
  const shownDna = own ? myDna : theirDna

  const name = own ? (me?.nickname ?? 'Jogador') : friend!.name
  const avatar = own ? (me?.avatar ?? null) : friend!.avatar
  const banner = own ? (me?.banner ?? null) : (localFriend?.banner ?? null)
  const completed = useMemo(() => games.filter((g) => g.completed).length, [games])

  const pick = async (kind: 'avatar' | 'banner'): Promise<void> => {
    if (!me) return
    const img = await window.nexus.profiles.pickImage(kind)
    if (!img) return
    await saveProfile(me.id, { [kind]: img })
    invalidateSocial()
    toast(kind === 'avatar' ? 'Foto atualizada' : 'Banner atualizado')
  }

  const share = async (mode: 'save' | 'copy'): Promise<void> => {
    if (!shownDna) return
    const cs = getComputedStyle(document.querySelector('.app') as HTMLElement)
    const url = await renderDnaCard(shownDna, name, cs.getPropertyValue('--z-accent').trim() || '#7c9cff', cs.getPropertyValue('--z-accent-2').trim() || '#3dd9eb', avatar)
    if (mode === 'copy') {
      window.nexus.shell.copyImage(url)
      toast('Game DNA copiado: cole em qualquer conversa')
    } else if (await window.nexus.shell.saveImage(url, `Game DNA - ${name}`)) toast('Imagem salva')
  }

  const online = (friends?.friends ?? []).filter((f) => f.state === 'playing' || f.state === 'online' || f.state === 'away')
  const compareTargets = (friends?.friends ?? []).filter((f) => f.source === 'local' || friends?.mode === 'api')

  return (
    <ScrollView>
      <div className="prof">
        <div className="prof-banner" style={banner ? undefined : artStyle(name + ' banner')}>
          {banner ? <img src={banner} alt="" draggable={false} /> : null}
          <div className="prof-banner-shade" />
          {own ? (
            <button className="btn ghost sm prof-banner-edit" onClick={() => void pick('banner')}>
              <IconCamera width={15} height={15} />
              Trocar banner
            </button>
          ) : null}
        </div>

        <div className="prof-head">
          <div className="prof-avatar">
            <Avatar src={avatar} name={name} size={128} ring="var(--accent)" />
            {own ? (
              <button className="prof-avatar-edit" onClick={() => void pick('avatar')} aria-label="Trocar foto" title="Trocar foto">
                <IconCamera width={16} height={16} />
              </button>
            ) : null}
          </div>
          <div className="prof-name">
            {own && editing ? (
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (me) void saveProfile(me.id, { nickname: nick }).then(() => setEditing(false))
                }}
              >
                <input className="input" value={nick} maxLength={32} autoFocus onChange={(e) => setNick(e.target.value)} aria-label="Nickname" />
                <button className="btn sm" type="submit">
                  Salvar
                </button>
              </form>
            ) : (
              <h1>
                {name}
                {own ? (
                  <button className="tb-icon" onClick={() => (setNick(me?.nickname ?? ''), setEditing(true))} aria-label="Editar nickname" title="Editar nickname">
                    <IconEdit width={15} height={15} />
                  </button>
                ) : null}
              </h1>
            )}
            <p className="muted">
              {shownDna?.dominant ? DNA_TITLES[shownDna.dominant] : own ? 'Perfil neste PC' : friendStatus(friend!)}
              {!own && friend?.source === 'steam' ? ' · Steam' : ''}
              {own && me?.steamLinked ? ' · dono da conta Steam deste PC' : ''}
            </p>
          </div>
          <div className="prof-actions">
            {own ? (
              <>
                <button className="btn ghost sm" onClick={onFriends}>
                  <IconUsers width={15} height={15} />
                  Amigos
                </button>
                <button className="btn ghost sm" onClick={switchProfile}>
                  <IconSwitch width={15} height={15} />
                  Trocar perfil
                </button>
              </>
            ) : friend?.profileUrl ? (
              <button className="btn ghost sm" onClick={() => window.nexus.shell.openExternal(friend.profileUrl!)}>
                <IconExternal width={15} height={15} />
                Perfil na Steam
              </button>
            ) : null}
          </div>
        </div>

        <div className="stat-strip prof-stats">
          {own || localFriend ? (
            <>
              <Stat label="Horas jogadas" value={stats ? formatHours(stats.hours * 3600) : '…'} />
              <Stat label="Jogos jogados" value={stats ? String(stats.gamesPlayed) : '…'} />
              <Stat label="Sessões no Prisma" value={stats ? String(stats.sessions) : '…'} />
              <Stat label="Maior sessão" value={stats?.longestSessionSeconds ? formatDuration(stats.longestSessionSeconds) : '—'} />
              {own ? <Stat label="Conquistas" value={stats ? stats.achievements.toLocaleString('pt-BR') : '…'} /> : null}
              {own ? <Stat label="Concluídos" value={String(completed)} /> : null}
            </>
          ) : theirLib?.available ? (
            <>
              <Stat label="Jogos na conta" value={theirLib.games.length.toLocaleString('pt-BR')} />
              <Stat label="Horas jogadas" value={formatHours(theirLib.games.reduce((n, g) => n + g.minutes, 0) * 60)} />
              <Stat label="Jogos jogados" value={String(theirLib.games.filter((g) => g.minutes > 0).length)} />
            </>
          ) : (
            <Stat label="Biblioteca" value={theirLib ? 'Indisponível' : 'Carregando…'} />
          )}
        </div>

        <div className="prof-grid">
          <section className="glass card pad dna-card">
            <div className="section-head">
              <h2>Game DNA</h2>
              {shownDna?.hours ? <span className="muted small">{Math.round(shownDna.hours).toLocaleString('pt-BR')} h analisadas</span> : null}
            </div>
            {shownDna && shownDna.dominant ? (
              <>
                <div className="dna-body">
                  <DnaRadar dna={shownDna} compare={own ? theirDna : myDna} />
                  <ul className="dna-bars">
                    {[...DNA_AXES]
                      .sort((a, b) => shownDna.share[b] - shownDna.share[a])
                      .map((a) => (
                        <li key={a} className={shownDna.dominant === a ? 'dom' : ''}>
                          <span>{a}</span>
                          <i>
                            <b style={{ width: `${shownDna.values[a]}%` }} />
                          </i>
                          <em>{Math.round(shownDna.share[a] * 100)}%</em>
                        </li>
                      ))}
                  </ul>
                </div>
                {(own ? theirDna : myDna) ? (
                  <p className="muted small dna-legend">
                    <i className="dna-key me" /> {own ? 'Você' : name} <i className="dna-key other" /> {own ? (friends?.friends.find((f) => f.id === compareId)?.name ?? 'Amigo') : 'Você'} · afinidade{' '}
                    <b>{dnaMatch(shownDna, (own ? theirDna : myDna)!)}%</b>
                  </p>
                ) : null}
                <div className="row">
                  <button className="btn ghost sm" onClick={() => void share('copy')}>
                    <IconCopy width={14} height={14} />
                    Copiar imagem
                  </button>
                  <button className="btn ghost sm" onClick={() => void share('save')}>
                    <IconShare width={14} height={14} />
                    Salvar PNG
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">{(own ? myLib : theirLib) ? 'Jogue um pouco mais (ou aguarde as tags da loja) para formar o seu DNA.' : 'Calculando…'}</p>
            )}
          </section>

          <div className="prof-col">
            <Comparison
              own={own}
              name={name}
              mine={myLib}
              theirs={theirLib}
              targets={own ? compareTargets : []}
              compareId={compareId}
              onCompare={setCompareId}
              theirDna={theirDna}
              myDna={myDna}
              note={friends?.mode !== 'api' && own ? friends?.message : null}
            />
            {own ? (
              <section className="glass card pad">
                <div className="section-head">
                  <h2>Amigos online</h2>
                  <button className="link" onClick={onFriends}>
                    Ver todos
                  </button>
                </div>
                {online.length ? (
                  <ul className="friend-mini">
                    {online.slice(0, 6).map((f) => (
                      <li key={f.id}>
                        <button onClick={() => onFriend(f)}>
                          <Avatar src={f.avatar} name={f.name} size={34} ring={f.state === 'playing' ? 'var(--ok)' : 'var(--steam)'} />
                          <span>
                            <b>{f.name}</b>
                            <small className={`fs-${f.state}`}>{friendStatus(f)}</small>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">{friends ? (friends.mode === 'api' ? 'Ninguém online agora.' : (friends.message ?? 'Sem amigos por aqui.')) : 'Carregando…'}</p>
                )}
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </ScrollView>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

interface CompareProps {
  own: boolean
  name: string
  mine: FriendLibrary | null
  theirs: FriendLibrary | null
  targets: Friend[]
  compareId: string | null
  onCompare: (id: string | null) => void
  myDna: Dna | null
  theirDna: Dna | null
  note: string | null | undefined
}

/** Horas lado a lado, biblioteca comparada e jogos em comum. */
function Comparison({ own, name, mine, theirs, targets, compareId, onCompare, note }: CompareProps) {
  const local = useMemo(() => gamesByAppKey(), [])
  const data = useMemo(() => {
    if (!mine || !theirs?.available) return null
    const theirMap = new Map(theirs.games.map((g) => [g.appid, g]))
    const common = mine.games
      .filter((g) => theirMap.has(g.appid))
      .map((g) => ({ appid: g.appid, name: g.name, me: g.minutes, them: theirMap.get(g.appid)!.minutes }))
      .sort((a, b) => b.me + b.them - (a.me + a.them))
    const hMe = mine.games.reduce((n, g) => n + g.minutes, 0) / 60
    const hThem = theirs.games.reduce((n, g) => n + g.minutes, 0) / 60
    return { common, hMe, hThem, nMe: mine.games.length, nThem: theirs.games.length }
  }, [mine, theirs])
  const who = own ? (targets.find((t) => t.id === compareId)?.name ?? 'Amigo') : name
  const max = data ? Math.max(data.hMe, data.hThem, 1) : 1

  return (
    <section className="glass card pad">
      <div className="section-head">
        <h2>{own ? 'Comparar com amigos' : 'Você e ' + name}</h2>
        {own && targets.length ? (
          <label className="select">
            <select value={compareId ?? ''} onChange={(e) => onCompare(e.target.value || null)} aria-label="Amigo para comparar">
              <option value="">Escolher amigo…</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.source === 'local' ? ' (este PC)' : ''}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {!own || compareId ? (
        !theirs ? (
          <p className="muted small">Carregando biblioteca…</p>
        ) : !theirs.available ? (
          <p className="muted small">{theirs.reason}</p>
        ) : data ? (
          <>
            <div className="cmp-bars">
              <div>
                <span>Você</span>
                <i>
                  <b style={{ width: `${(100 * data.hMe) / max}%` }} />
                </i>
                <em>{formatHours(data.hMe * 3600)}</em>
              </div>
              <div className="them">
                <span>{who}</span>
                <i>
                  <b style={{ width: `${(100 * data.hThem) / max}%` }} />
                </i>
                <em>{formatHours(data.hThem * 3600)}</em>
              </div>
            </div>
            <p className="muted small">
              Bibliotecas: {data.nMe.toLocaleString('pt-BR')} × {data.nThem.toLocaleString('pt-BR')} jogos · <b>{data.common.length}</b> em comum
            </p>
            {data.common.length ? (
              <ul className="common-list">
                {data.common.slice(0, 8).map((c) => {
                  const g = local.get(c.appid)
                  return (
                    <li key={c.appid}>
                      {g?.coverUrl ? <img src={g.coverUrl} alt="" loading="lazy" /> : <span className="cl-ph" style={artStyle(c.name)} />}
                      <b title={c.name}>{g?.title ?? c.name}</b>
                      <span>
                        {formatHours(c.me * 60)} <em>×</em> {formatHours(c.them * 60)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </>
        ) : null
      ) : (
        <p className="muted small">
          {targets.length ? 'Escolha um amigo para ver horas, bibliotecas e jogos em comum.' : 'Crie outro perfil neste PC ou adicione sua chave da Steam Web API (Ajustes → Amigos) para comparar.'}
          {note && targets.length ? <span className="block-note">{note}</span> : null}
        </p>
      )}
    </section>
  )
}
