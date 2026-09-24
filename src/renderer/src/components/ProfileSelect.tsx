import { useEffect, useRef, useState } from 'react'
import { Avatar } from './Avatar'
import { IconPlus } from './Icons'
import { refreshProfiles, selectProfile, toast, useStore } from '../lib/store'
import { relativeTime } from '../lib/format'
import { sfx } from '../lib/sounds'

/**
 * "Quem está jogando?": aparece a cada abertura do app. Cada perfil tem foto, banner,
 * nickname, ajustes, sessões e Game DNA próprios. Funciona com mouse, setas ou controle.
 */
export function ProfileSelect() {
  const profiles = useStore((s) => s.profiles)
  const current = useStore((s) => s.profile)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [leaving, setLeaving] = useState(false)
  const first = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    first.current?.focus({ preventScroll: true })
  }, [profiles.length])
  useEffect(() => {
    if (creating) input.current?.focus()
  }, [creating])

  const choose = (id: number): void => {
    if (leaving) return
    sfx('confirm', true)
    setLeaving(true)
    // A tela se dissolve enquanto o perfil carrega os ajustes dele.
    window.setTimeout(() => void selectProfile(id), 260)
  }

  const create = async (): Promise<void> => {
    const nick = name.trim()
    if (!nick) return
    const p = await window.nexus.profiles.create(nick)
    await refreshProfiles()
    setCreating(false)
    setName('')
    toast(`Perfil ${p.nickname} criado`)
  }

  return (
    <div className={`psel ${leaving ? 'leaving' : ''}`} data-nav-layer role="dialog" aria-label="Escolher perfil">
      <div className="psel-glow" />
      <div className="psel-inner">
        <p className="eyebrow">Prisma</p>
        <h1>Quem está jogando?</h1>
        <div className="psel-grid">
          {profiles.map((p, i) => (
            <button key={p.id} ref={i === 0 ? first : undefined} className={`psel-tile ${current?.id === p.id ? 'last' : ''}`} onClick={() => choose(p.id)}>
              <span className="psel-av">
                <Avatar src={p.avatar} name={p.nickname} size={116} />
              </span>
              <b>{p.nickname}</b>
              <small>{p.lastUsed ? `Último acesso ${relativeTime(p.lastUsed)}` : 'Novo perfil'}</small>
            </button>
          ))}
          {creating ? (
            <form
              className="psel-tile psel-new"
              onSubmit={(e) => {
                e.preventDefault()
                void create()
              }}
            >
              <span className="psel-av add">
                <IconPlus width={34} height={34} />
              </span>
              <input
                ref={input}
                value={name}
                maxLength={32}
                placeholder="Nickname"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation()
                    setCreating(false)
                  }
                }}
                aria-label="Nickname do novo perfil"
              />
              <div className="row">
                <button type="button" className="btn ghost sm" onClick={() => setCreating(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn sm" disabled={!name.trim()}>
                  Criar
                </button>
              </div>
            </form>
          ) : profiles.length < 8 ? (
            <button className="psel-tile" onClick={() => setCreating(true)}>
              <span className="psel-av add">
                <IconPlus width={34} height={34} />
              </span>
              <b>Adicionar perfil</b>
              <small>Foto, banner e ajustes próprios</small>
            </button>
          ) : null}
        </div>
        <p className="psel-hint muted small">Setas ou direcional para escolher · Enter ou A para entrar</p>
      </div>
    </div>
  )
}
