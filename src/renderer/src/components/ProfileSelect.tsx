import { useEffect, useRef, useState } from 'react'
import { Avatar } from './Avatar'
import { IconPlus } from './Icons'
import { PrismaMark } from './TitleBar'
import { SteamAccountPicker, useSteamAccounts } from './SteamAccountPicker'
import { refreshProfiles, selectProfile, toast, useStore } from '../lib/store'
import { relativeTime } from '../lib/format'
import { sfx } from '../lib/sounds'

/**
 * "Quem está jogando?": aparece a cada abertura do app. Num PC novo, é onde se cria o primeiro
 * perfil (nada de "Jogador 1" automático). Cada perfil escolhe a conta Steam que vai usar e
 * só vê os jogos dela. Funciona com mouse, setas ou controle.
 */
export function ProfileSelect() {
  const profiles = useStore((s) => s.profiles)
  const current = useStore((s) => s.profile)
  const [creating, setCreating] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const first = useRef<HTMLButtonElement>(null)
  const firstRun = profiles.length === 0

  useEffect(() => {
    if (!creating) first.current?.focus({ preventScroll: true })
  }, [profiles.length, creating])

  const choose = (id: number): void => {
    if (leaving) return
    sfx('confirm', true)
    setLeaving(true)
    // A tela se dissolve enquanto o perfil carrega os ajustes dele.
    window.setTimeout(() => void selectProfile(id), 260)
  }

  return (
    <div className={`psel ${leaving ? 'leaving' : ''} ${firstRun ? 'first' : ''}`} data-nav-layer role="dialog" aria-label={firstRun ? 'Criar perfil' : 'Escolher perfil'}>
      <div className="psel-glow" />
      {firstRun ? (
        <div className="psel-inner">
          <div className="psel-mark">
            <PrismaMark />
          </div>
          <p className="eyebrow">Bem-vindo ao Prisma</p>
          <h1>Crie o seu perfil</h1>
          <p className="psel-lead">Cada pessoa da casa tem o próprio perfil, com foto, ajustes, sessões e a sua conta da Steam.</p>
          <NewProfile first onDone={(id) => choose(id)} />
        </div>
      ) : (
        <div className="psel-inner">
          <p className="eyebrow">Prisma</p>
          <h1>{creating ? 'Novo perfil' : 'Quem está jogando?'}</h1>
          {creating ? (
            <NewProfile
              onCancel={() => setCreating(false)}
              onDone={() => {
                setCreating(false)
              }}
            />
          ) : (
            <>
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
                {profiles.length < 8 ? (
                  <button className="psel-tile" onClick={() => setCreating(true)}>
                    <span className="psel-av add">
                      <IconPlus width={34} height={34} />
                    </span>
                    <b>Adicionar perfil</b>
                    <small>Foto, ajustes e conta Steam próprios</small>
                  </button>
                ) : null}
              </div>
              <p className="psel-hint muted small">Setas ou direcional para escolher · Enter ou A para entrar</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Formulário de perfil novo: nickname e conta Steam. */
function NewProfile({ first, onDone, onCancel }: { first?: boolean; onDone: (id: number) => void; onCancel?: () => void }) {
  const accounts = useSteamAccounts()
  const profiles = useStore((s) => s.profiles)
  const [name, setName] = useState('')
  const [account, setAccount] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    input.current?.focus()
  }, [])
  // Sugere a conta Steam mais recente que ainda não é de outro perfil.
  useEffect(() => {
    if (account != null || !accounts) return
    const used = new Set(profiles.map((p) => p.steamAccount))
    setAccount(accounts.find((a) => !used.has(a.accountId))?.accountId ?? accounts[0]?.accountId ?? '')
  }, [accounts, profiles, account])

  const create = async (): Promise<void> => {
    const nick = name.trim()
    if (!nick || busy) return
    setBusy(true)
    try {
      const p = await window.nexus.profiles.create(nick, account ?? '')
      await refreshProfiles()
      if (!first) toast(`Perfil ${p.nickname} criado`)
      onDone(p.id)
    } catch (e) {
      toast((e as Error).message.replace(/^.*Error: /, ''), 'err')
      setBusy(false)
    }
  }

  return (
    <form
      className="psel-form glass frost"
      onSubmit={(e) => {
        e.preventDefault()
        void create()
      }}
    >
      <label className="psel-field">
        <span>Como quer ser chamado?</span>
        <input
          ref={input}
          className="input"
          value={name}
          maxLength={32}
          placeholder="Seu nickname"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && onCancel) {
              e.stopPropagation()
              onCancel()
            }
          }}
          aria-label="Nickname do perfil"
        />
      </label>
      <div className="psel-field">
        <span>Qual conta da Steam este perfil usa?</span>
        <small className="muted">A biblioteca da Steam mostra só os jogos da conta escolhida. Dá para trocar depois em Ajustes → Perfis.</small>
        <SteamAccountPicker value={account ?? ''} onChange={setAccount} />
      </div>
      <div className="psel-actions">
        {onCancel ? (
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancelar
          </button>
        ) : null}
        <button type="submit" className="btn" disabled={!name.trim() || busy || account == null}>
          {first ? 'Criar e entrar' : 'Criar perfil'}
        </button>
      </div>
    </form>
  )
}
