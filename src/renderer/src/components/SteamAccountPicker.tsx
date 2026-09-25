import { useEffect, useState } from 'react'
import type { SteamAccount } from '@shared/types'
import { Avatar } from './Avatar'
import { IconCheck, IconClose } from './Icons'

let cache: SteamAccount[] | null = null

/** Contas que já entraram na Steam deste PC (lidas uma vez por execução). */
export function useSteamAccounts(): SteamAccount[] | null {
  const [list, setList] = useState<SteamAccount[] | null>(cache)
  useEffect(() => {
    if (cache) return
    let alive = true
    void window.nexus.steam
      .accounts()
      .catch(() => [])
      .then((a) => {
        cache = a
        if (alive) setList(a)
      })
    return () => {
      alive = false
    }
  }, [])
  return list
}

/**
 * Escolha da conta Steam do perfil: cada conta que já entrou na Steam deste PC, ou nenhuma.
 * value: id da conta; '' = sem Steam.
 */
export function SteamAccountPicker({ value, onChange, compact }: { value: string; onChange: (v: string) => void; compact?: boolean }) {
  const accounts = useSteamAccounts()
  if (!accounts) return <div className="sacc-list loading" />
  return (
    <div className={`sacc-list ${compact ? 'compact' : ''}`} role="radiogroup" aria-label="Conta Steam do perfil">
      {accounts.map((a) => (
        <button
          key={a.accountId}
          type="button"
          role="radio"
          aria-checked={value === a.accountId}
          className={`sacc ${value === a.accountId ? 'on' : ''}`}
          onClick={() => onChange(a.accountId)}
        >
          <Avatar src={a.avatar} name={a.name} size={compact ? 30 : 38} />
          <span>
            <b>{a.name}</b>
            <small>{a.mostRecent ? 'Última conta usada na Steam' : 'Conta Steam deste PC'}</small>
          </span>
          {value === a.accountId ? <IconCheck width={16} height={16} /> : null}
        </button>
      ))}
      <button type="button" role="radio" aria-checked={value === ''} className={`sacc none ${value === '' ? 'on' : ''}`} onClick={() => onChange('')}>
        <span className="sacc-none-ico">
          <IconClose width={16} height={16} />
        </span>
        <span>
          <b>Não usar Steam</b>
          <small>{accounts.length ? 'Só Epic, GOG, Xbox, emuladores e jogos adicionados' : 'A Steam não foi encontrada neste PC'}</small>
        </span>
        {value === '' ? <IconCheck width={16} height={16} /> : null}
      </button>
    </div>
  )
}
