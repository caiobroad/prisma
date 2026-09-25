import { memo } from 'react'
import { IconDrive, IconGamepad, IconGrid, IconHome, IconPlus, IconRetro, IconStore, IconUser, IconUsers } from './Icons'
import { useStore } from '../lib/store'

export type Section =
  | 'home'
  | 'installed'
  | 'library'
  | 'collection'
  | 'emulation'
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
  /** Perfil de um amigo aberto: acende "Amigos", não "Perfil". */
  viewingFriend: boolean
  onAdd: () => void
  onController: () => void
}

/** Os lugares do dia a dia. Desempenho e Mood ficam no menu de modos; Ajustes, na engrenagem. */
const NAV: Array<{ id: Section; label: string; Icon: typeof IconHome; also?: Section[] }> = [
  { id: 'home', label: 'Início', Icon: IconHome },
  { id: 'installed', label: 'Instalados', Icon: IconDrive },
  { id: 'library', label: 'Biblioteca', Icon: IconGrid, also: ['collection'] },
  { id: 'emulation', label: 'Emulação', Icon: IconRetro },
  { id: 'store', label: 'Loja', Icon: IconStore },
  { id: 'friends', label: 'Amigos', Icon: IconUsers },
  { id: 'profile', label: 'Perfil', Icon: IconUser, also: ['timeline'] }
]

/** Ordem das telas para L2/R2 no controle e Ctrl+↑/↓ no teclado. */
export const SECTION_ORDER: Section[] = NAV.map((n) => n.id)

export const Sidebar = memo(function Sidebar({ section, onSection, viewingFriend, onAdd, onController }: Props) {
  const total = useStore((s) => s.games.reduce((n, g) => n + (g.emuSystem ? 0 : 1), 0))
  const installed = useStore((s) => s.games.reduce((n, g) => n + (g.installed ? 1 : 0), 0))
  const emu = useStore((s) => s.games.reduce((n, g) => n + (g.emuSystem ? 1 : 0), 0))
  const running = useStore((s) => s.running.size)

  const badge = (id: Section): string | number | null =>
    id === 'library'
      ? total.toLocaleString('pt-BR')
      : id === 'installed'
        ? installed || null
        : id === 'emulation'
          ? emu || null
          : id === 'home' && running
            ? 'em jogo'
            : null

  const isOn = (id: Section, also?: Section[]): boolean => {
    if (section === 'profile') return viewingFriend ? id === 'friends' : id === 'profile'
    return section === id || !!also?.includes(section)
  }

  return (
    <nav className="sidebar glass" aria-label="Navegação">
      <div className="side-nav">
        {NAV.map(({ id, label, Icon, also }) => {
          const on = isOn(id, also)
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
      <div className="side-actions">
        <button className="side-item action" onClick={onAdd}>
          <IconPlus width={19} height={19} />
          <span>Adicionar jogo</span>
        </button>
        <button className="side-item action pad" onClick={onController}>
          <IconGamepad width={19} height={19} />
          <span>Modo Controle</span>
          <kbd className="side-kbd" title="Start / Options no controle">Start</kbd>
        </button>
      </div>
    </nav>
  )
})
