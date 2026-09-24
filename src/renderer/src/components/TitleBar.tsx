import { memo } from 'react'
import type { Game } from '@shared/types'
import { IconBack, IconExitFullscreen, IconFullscreen, IconGamepad, IconGauge, IconRefresh, IconWinClose, IconWinMax, IconWinMin, IconWinRestore } from './Icons'
import { Avatar } from './Avatar'
import { MoodPicker } from './MoodPicker'
import { SearchBox } from './SearchBox'
import { scan, updateSettings, useStore } from '../lib/store'

interface Props {
  query: string
  onQuery: (q: string) => void
  onOpenGame: (g: Game) => void
  canBack: boolean
  onBack: () => void
  zoneName: string | null
  onController: () => void
  onProfile: () => void
}

/** Marca do Prisma: o prisma com o feixe de luz. As faces seguem o acento da zona. */
export function PrismaMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
      <line x1="7" y1="37" x2="23" y2="32" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <polygon points="31,14 17,46 31,46" fill="var(--accent)" />
      <polygon points="31,14 31,46 45,46" fill="var(--accent-2)" />
      <line x1="40" y1="31" x2="57" y2="26" stroke="#3dd9eb" strokeWidth="3.4" strokeLinecap="round" />
      <line x1="41" y1="34.5" x2="57" y2="34.5" stroke="#7c9cff" strokeWidth="3.4" strokeLinecap="round" />
      <line x1="42" y1="38" x2="57" y2="43" stroke="#c58bff" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  )
}

export const TitleBar = memo(function TitleBar({ query, onQuery, onOpenGame, canBack, onBack, zoneName, onController, onProfile }: Props) {
  const scanning = useStore((s) => s.scanning)
  const win = useStore((s) => s.win)
  const perfMode = useStore((s) => s.settings.performanceMode)
  const zoneOn = useStore((s) => s.settings.zoneMode)
  const profile = useStore((s) => s.profile)
  const enrich = useStore((s) => s.enrich)
  const status = useStore((s) => (s.scanning ? 'syncing' : s.running.size > 0 ? 'playing' : 'online'))

  return (
    <header className="titlebar" onDoubleClick={(e) => e.target === e.currentTarget && window.nexus.window.toggleMaximize()}>
      <div className="brand">
        <PrismaMark />
        Prisma
      </div>
      <div className="tb-left">
        <button className="tb-icon" onClick={onBack} disabled={!canBack} aria-label="Voltar" title="Voltar (Esc)">
          <IconBack width={16} height={16} />
        </button>
      </div>
      <SearchBox query={query} onQuery={onQuery} onOpenGame={onOpenGame} />
      <div className="tb-right">
        {zoneOn && zoneName ? (
          <span className="zone-chip" title="Modo Zona: a atmosfera segue o jogo selecionado">
            <i />
            <span>{zoneName}</span>
          </span>
        ) : null}
        <button
          className={`tb-pill ${perfMode ? 'on' : ''}`}
          onClick={() => void updateSettings({ performanceMode: !perfMode })}
          aria-pressed={perfMode}
          title="Modo Performance: libera recursos para o jogo"
        >
          <IconGauge width={15} height={15} />
          Modo Performance
        </button>
        <button className="tb-icon" onClick={onController} aria-label="Modo Controle" title="Modo Controle (Start / Options no controle)">
          <IconGamepad width={17} height={17} />
        </button>
        <MoodPicker />
        <button
          className={`tb-icon ${scanning ? 'spin' : ''}`}
          onClick={() => void scan()}
          disabled={scanning}
          aria-label="Sincronizar bibliotecas"
          title={enrich ? `Completando a biblioteca: ${enrich.done} de ${enrich.total} jogos` : 'Sincronizar bibliotecas (F5)'}
        >
          <IconRefresh width={16} height={16} />
        </button>
        {profile ? (
          <button
            className={`tb-profile st-${status}`}
            onClick={onProfile}
            title={`${profile.nickname} · ${status === 'playing' ? 'em jogo' : status === 'syncing' ? 'sincronizando' : 'online'} · abrir perfil`}
            aria-label={`Perfil de ${profile.nickname}`}
          >
            <Avatar src={profile.avatar} name={profile.nickname} size={28} />
          </button>
        ) : null}
        <div className="winctl">
          <button onClick={() => window.nexus.window.minimize()} aria-label="Minimizar" title="Minimizar">
            <IconWinMin width={11} height={11} />
          </button>
          <button onClick={() => window.nexus.window.toggleFullscreen()} aria-label={win.fullscreen ? 'Sair da tela cheia' : 'Tela cheia'} title={win.fullscreen ? 'Sair da tela cheia (F11)' : 'Tela cheia (F11)'}>
            {win.fullscreen ? <IconExitFullscreen width={11} height={11} /> : <IconFullscreen width={11} height={11} />}
          </button>
          {!win.fullscreen ? (
            <button onClick={() => window.nexus.window.toggleMaximize()} aria-label={win.maximized ? 'Restaurar' : 'Maximizar'} title={win.maximized ? 'Restaurar' : 'Maximizar'}>
              {win.maximized ? <IconWinRestore width={11} height={11} /> : <IconWinMax width={11} height={11} />}
            </button>
          ) : null}
          <button className="close" onClick={() => window.nexus.window.close()} aria-label="Fechar" title="Fechar">
            <IconWinClose width={11} height={11} />
          </button>
        </div>
      </div>
    </header>
  )
})
