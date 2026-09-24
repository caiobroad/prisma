import { useMemo, useState } from 'react'
import type { Friend } from '@shared/types'
import { Avatar } from '../components/Avatar'
import { IconExternal, IconRefresh } from '../components/Icons'
import { ScrollView } from '../components/ScrollView'
import { friendStatus, loadFriends, useFriends } from '../lib/social'

interface Props {
  onFriend: (f: Friend) => void
  onSettings: () => void
}

const GROUPS: Array<{ id: string; title: string; test: (f: Friend) => boolean }> = [
  { id: 'local', title: 'Perfis neste PC', test: (f) => f.source === 'local' },
  { id: 'playing', title: 'Jogando agora', test: (f) => f.source === 'steam' && f.state === 'playing' },
  { id: 'online', title: 'Online', test: (f) => f.source === 'steam' && (f.state === 'online' || f.state === 'away') },
  {
    id: 'recent',
    title: 'Offline recentemente',
    test: (f) => f.source === 'steam' && f.state === 'offline' && !!f.lastOnline && Date.now() - f.lastOnline < 24 * 3600_000
  },
  { id: 'offline', title: 'Offline', test: (f) => f.source === 'steam' && f.state === 'offline' && !(f.lastOnline && Date.now() - f.lastOnline < 24 * 3600_000) },
  { id: 'unknown', title: 'Amigos da Steam', test: (f) => f.source === 'steam' && f.state === 'unknown' }
]

/** Amigos: Steam (status em tempo real com a chave da Web API; senão o cache local do cliente) e perfis deste PC. */
export function FriendsView({ onFriend, onSettings }: Props) {
  const initial = useFriends()
  const [fresh, setFresh] = useState<typeof initial>(null)
  const [busy, setBusy] = useState(false)
  const data = fresh ?? initial

  const groups = useMemo(() => GROUPS.map((g) => ({ ...g, list: (data?.friends ?? []).filter(g.test) })).filter((g) => g.list.length), [data])

  const reload = async (): Promise<void> => {
    setBusy(true)
    try {
      setFresh(await loadFriends(true))
    } finally {
      setBusy(false)
    }
  }

  const steamCount = data?.friends.filter((f) => f.source === 'steam').length ?? 0
  const onlineCount = data?.friends.filter((f) => f.source === 'steam' && (f.state === 'online' || f.state === 'playing' || f.state === 'away')).length ?? 0

  return (
    <ScrollView>
      <header className="view-head">
        <div className="view-title">
          <h1>Amigos</h1>
          <p>
            {data
              ? data.mode === 'api'
                ? `${onlineCount} online · ${steamCount} amigos na Steam`
                : `${steamCount} amigos no cache da Steam deste PC`
              : 'Carregando…'}
          </p>
        </div>
        <div className="toolbar">
          <button className={`btn ghost sm ${busy ? 'spin' : ''}`} onClick={() => void reload()} disabled={busy}>
            <IconRefresh width={14} height={14} />
            Atualizar
          </button>
        </div>
      </header>

      {data?.message ? (
        <div className="notice glass">
          <span>{data.message}</span>
          {data.mode !== 'api' ? (
            <button className="btn ghost sm" onClick={onSettings}>
              Configurar
            </button>
          ) : null}
        </div>
      ) : null}
      <p className="muted small friends-note">A Epic Games não oferece lista de amigos pública para apps de terceiros; por enquanto, só Steam e perfis locais.</p>

      {groups.map((g) => (
        <section key={g.id} className="block">
          <div className="section-head">
            <h2>{g.title}</h2>
            <span className="muted small">{g.list.length}</span>
          </div>
          <div className="friend-grid">
            {g.list.map((f) => (
              <div key={f.id} className={`friend glass fs-${f.state}`}>
                <button className="friend-main" onClick={() => onFriend(f)}>
                  <Avatar src={f.avatar} name={f.name} size={46} ring={f.state === 'playing' ? 'var(--ok)' : f.state === 'online' ? 'var(--steam)' : f.state === 'away' ? 'var(--warn)' : undefined} />
                  <span>
                    <b>{f.name}</b>
                    <small>{friendStatus(f)}</small>
                  </span>
                </button>
                {f.profileUrl ? (
                  <button className="tb-icon" onClick={() => window.nexus.shell.openExternal(f.profileUrl!)} aria-label={`Perfil de ${f.name} na Steam`} title="Abrir na Steam">
                    <IconExternal width={15} height={15} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ))}
      {data && !groups.length ? (
        <div className="empty glass">
          <b>Nenhum amigo encontrado</b>
          <span>Entre na Steam neste PC ou crie outro perfil do Prisma.</span>
        </div>
      ) : null}
    </ScrollView>
  )
}
