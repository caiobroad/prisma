import { memo } from 'react'
import type { Platform } from '@shared/types'
import { IconDrive, IconGrid, IconHome, IconStore, IconUsers } from './Icons'
import { useStore } from '../lib/store'

export type Section =
  | 'home'
  | 'installed'
  | 'library'
  | 'collection'
  | 'store'
  | 'recent'
  | 'favorites'
  | 'friends'
  | 'timeline'
  | 'performance'
  | 'settings'
  | 'profile'
  | 'credits'

interface Props {
  section: Section
  onSection: (s: Section) => void
  platform: Platform | 'all' | 'emu'
}

/** Menu enxuto: só os lugares do dia a dia. O resto fica dentro das telas, no menu de modos ou na engrenagem. */
const NAV: Array<{ id: Section; label: string; Icon: typeof IconHome; also?: Section[] }> = [
  { id: 'home', label: 'Início', Icon: IconHome },
  { id: 'installed', label: 'Instalados', Icon: IconDrive },
  { id: 'library', label: 'Biblioteca', Icon: IconGrid, also: ['collection'] },
  { id: 'store', label: 'Loja', Icon: IconStore },
  { id: 'friends', label: 'Amigos', Icon: IconUsers, also: ['profile'] }
]

/** Ordem das telas para L2/R2 no controle e Ctrl+↑/↓ no teclado. */
export const SECTION_ORDER: Section[] = NAV.map((n) => n.id)

export const Sidebar = memo(function Sidebar({ section, onSection }: Props) {
  const total = useStore((s) => s.games.length)
  const installed = useStore((s) => s.games.reduce((n, g) => n + (g.installed ? 1 : 0), 0))
  const running = useStore((s) => s.running.size)

  const badge = (id: Section): string | number | null =>
    id === 'library' ? total.toLocaleString('pt-BR') : id === 'installed' ? installed || null : id === 'home' && running ? 'em jogo' : null

  return (
    <nav className="sidebar glass" aria-label="Navegação">
      <div className="side-nav">
        {NAV.map(({ id, label, Icon, also }) => {
          const on = section === id || !!also?.includes(section)
          const b = badge(id)
          return (
            <button key={id} className={`side-item ${on ? 'on' : ''}`} onClick={() => onSection(id)} aria-current={on ? 'page' : undefined}>
              <Icon width={19} height={19} />
              <span>{label}</span>
              {b != null ? <em>{b}</em> : null}
            </button>
          )
        })}
      </div>
    </nav>
  )
})
