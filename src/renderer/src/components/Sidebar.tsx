import { memo } from 'react'
import type { Platform } from '@shared/types'
import { IconClock, IconDrive, IconGauge, IconGrid, IconHeart, IconHome, IconPlus, IconSettings, IconShelf, IconSpark, IconStar, IconTimeline, IconUsers } from './Icons'
import { PF } from '../lib/format'
import { updateSettings, useStore } from '../lib/store'

export type Section =
  | 'home'
  | 'installed'
  | 'library'
  | 'collection'
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
  platform: Platform | 'all'
  onPlatform: (p: Platform) => void
  onAdd: () => void
}

const NAV: Array<{ id: Section; label: string; Icon: typeof IconHome; sub?: boolean }> = [
  { id: 'home', label: 'Início', Icon: IconHome },
  { id: 'installed', label: 'Instalados', Icon: IconDrive },
  { id: 'library', label: 'Biblioteca', Icon: IconGrid },
  { id: 'collection', label: 'Coleção', Icon: IconShelf, sub: true },
  { id: 'recent', label: 'Recentes', Icon: IconClock },
  { id: 'favorites', label: 'Favoritos', Icon: IconStar },
  { id: 'friends', label: 'Amigos', Icon: IconUsers },
  { id: 'timeline', label: 'Timeline Gamer', Icon: IconTimeline },
  { id: 'performance', label: 'Performance', Icon: IconGauge },
  { id: 'settings', label: 'Ajustes', Icon: IconSettings }
]

/** Ordem das telas para L2/R2 no controle e Ctrl+↑/↓ no teclado. */
export const SECTION_ORDER: Section[] = NAV.map((n) => n.id)

export const Sidebar = memo(function Sidebar({ section, onSection, platform, onPlatform, onAdd }: Props) {
  const sources = useStore((s) => s.sources)
  const total = useStore((s) => s.games.length)
  const installed = useStore((s) => s.games.reduce((n, g) => n + (g.installed ? 1 : 0), 0))
  const favorites = useStore((s) => s.games.reduce((n, g) => n + (g.favorite ? 1 : 0), 0))
  const running = useStore((s) => s.running.size)
  const zoneOn = useStore((s) => s.settings.zoneMode)

  const badge = (id: Section): string | number | null =>
    id === 'library'
      ? total.toLocaleString('pt-BR')
      : id === 'installed'
        ? installed || null
        : id === 'favorites'
          ? favorites || null
          : id === 'recent' && running
            ? `${running} ativo`
            : null

  return (
    <nav className="sidebar glass" aria-label="Navegação">
      <div className="side-nav">
        {NAV.map(({ id, label, Icon, sub }) => {
          const on = section === id && (id !== 'library' || platform === 'all')
          const b = badge(id)
          return (
            <button key={id} className={`side-item ${sub ? 'sub' : ''} ${on ? 'on' : ''}`} onClick={() => onSection(id)} aria-current={on ? 'page' : undefined}>
              <Icon width={sub ? 17 : 19} height={sub ? 17 : 19} />
              <span>{label}</span>
              {b != null ? <em>{b}</em> : null}
            </button>
          )
        })}
      </div>

      <div className="side-section">
        <h6>Plataformas</h6>
        {sources
          .filter((s) => s.count > 0 || s.platform === 'manual')
          .map((s) => {
            const on = section === 'library' && platform === s.platform
            return (
              <button
                key={s.platform}
                className={`side-item small ${on ? 'on' : ''}`}
                style={{ '--c': PF[s.platform].color } as React.CSSProperties}
                onClick={() => onPlatform(s.platform)}
                title={s.detail}
              >
                <i className="pf-dot" />
                <span>{PF[s.platform].name}</span>
                <em>{s.count}</em>
              </button>
            )
          })}
      </div>

      <div className="side-foot">
        <div className="zone-toggle">
          <IconSpark width={17} height={17} />
          <div>
            <b>Modo Zona</b>
            <span>Atmosfera por jogo</span>
          </div>
          <button id="zone-toggle" className="tg" role="switch" aria-checked={zoneOn} aria-label="Modo Zona" onClick={() => void updateSettings({ zoneMode: !zoneOn })} />
        </div>
        <div className="row side-foot-row">
          <button className="btn ghost add-btn" onClick={onAdd}>
            <IconPlus width={15} height={15} />
            Adicionar jogo
          </button>
          <button className={`tb-icon credits-btn ${section === 'credits' ? 'on' : ''}`} onClick={() => onSection('credits')} aria-label="Créditos" title="Créditos">
            <IconHeart width={16} height={16} />
          </button>
        </div>
      </div>
    </nav>
  )
})
