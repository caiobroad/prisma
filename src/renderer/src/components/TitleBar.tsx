import { memo, useEffect, useRef, useState } from 'react'
import type { Game } from '@shared/types'
import {
  IconBack,
  IconExitFullscreen,
  IconFullscreen,
  IconGamepad,
  IconGauge,
  IconModes,
  IconSettings,
  IconSpark,
  IconThermo,
  IconWinClose,
  IconWinMax,
  IconWinMin,
  IconWinRestore
} from './Icons'
import { Avatar } from './Avatar'
import { MoodPicker } from './MoodPicker'
import { SearchBox } from './SearchBox'
import { updateSettings, useStore } from '../lib/store'

interface Props {
  query: string
  onQuery: (q: string) => void
  onOpenGame: (g: Game) => void
  canBack: boolean
  onBack: () => void
  onController: () => void
  onProfile: () => void
  onSettings: () => void
  onPerformance: () => void
  settingsOn: boolean
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

/**
 * Barra de cima enxuta: busca no centro; à direita, o menu de modos (Performance, Controle,
 * Mood, Zona e desempenho), o perfil e a engrenagem. A sincronização é automática.
 */
export const TitleBar = memo(function TitleBar(p: Props) {
  const win = useStore((s) => s.win)
  const profile = useStore((s) => s.profile)
  const perfMode = useStore((s) => s.settings.performanceMode)
  const status = useStore((s) => (s.scanning ? 'syncing' : s.running.size > 0 ? 'playing' : 'online'))

  return (
    <header className="titlebar" onDoubleClick={(e) => e.target === e.currentTarget && window.nexus.window.toggleMaximize()}>
      <div className="brand">
        <PrismaMark />
        Prisma
      </div>
      <div className="tb-left">
        <button className="tb-icon" onClick={p.onBack} disabled={!p.canBack} aria-label="Voltar" title="Voltar (Esc)">
          <IconBack width={16} height={16} />
        </button>
      </div>
      <SearchBox query={p.query} onQuery={p.onQuery} onOpenGame={p.onOpenGame} />
      <div className="tb-right">
        {perfMode ? (
          <span className="tb-flag" title="Modo Performance ligado">
            <IconGauge width={13} height={13} />
            Performance
          </span>
        ) : null}
        <ModesMenu onController={p.onController} onPerformance={p.onPerformance} />
        {profile ? (
          <button
            className={`tb-profile st-${status}`}
            onClick={p.onProfile}
            title={`${profile.nickname} · ${status === 'playing' ? 'em jogo' : status === 'syncing' ? 'sincronizando a biblioteca' : 'online'}`}
            aria-label={`Perfil de ${profile.nickname}`}
          >
            <Avatar src={profile.avatar} name={profile.nickname} size={28} />
          </button>
        ) : null}
        <button className={`tb-icon ${p.settingsOn ? 'on' : ''}`} onClick={p.onSettings} aria-label="Ajustes" title="Ajustes">
          <IconSettings width={17} height={17} />
        </button>
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

function ModesMenu({ onController, onPerformance }: { onController: () => void; onPerformance: () => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const perfMode = useStore((s) => s.settings.performanceMode)
  const zoneOn = useStore((s) => s.settings.zoneMode)

  useEffect(() => {
    if (!open) return
    const off = (e: PointerEvent): void => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', off)
    window.addEventListener('keydown', esc, true)
    return () => {
      window.removeEventListener('pointerdown', off)
      window.removeEventListener('keydown', esc, true)
    }
  }, [open])

  const go = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  return (
    <div className="mood-pick modes" ref={box}>
      <button className={`tb-icon ${open ? 'on' : ''}`} onClick={() => setOpen((v) => !v)} aria-label="Modos" title="Modos e atmosfera" aria-expanded={open}>
        <IconModes width={18} height={18} />
      </button>
      {open ? (
        <div className="mood-pop modes-pop glass frost" data-nav-layer>
          <div className="modes-rows">
            <button className="modes-row" onClick={() => void updateSettings({ performanceMode: !perfMode })}>
              <IconGauge width={17} height={17} />
              <span>
                <b>Modo Performance</b>
                <small>Libera recursos para o jogo ao clicar em Jogar</small>
              </span>
              <i className="tg" role="switch" aria-checked={perfMode} />
            </button>
            <button className="modes-row" onClick={() => void updateSettings({ zoneMode: !zoneOn })}>
              <IconSpark width={17} height={17} />
              <span>
                <b>Modo Zona</b>
                <small>A atmosfera muda com cada jogo</small>
              </span>
              <i className="tg" role="switch" aria-checked={zoneOn} />
            </button>
            <button className="modes-row" onClick={go(onController)}>
              <IconGamepad width={17} height={17} />
              <span>
                <b>Modo Controle</b>
                <small>Interface de console · Start/Options no controle</small>
              </span>
            </button>
            <button className="modes-row" onClick={go(onPerformance)}>
              <IconThermo width={17} height={17} />
              <span>
                <b>Desempenho</b>
                <small>CPU, GPU, temperaturas e FPS ao vivo; histórico das sessões</small>
              </span>
            </button>
          </div>
          <div className="mood-pop-head">
            <b>Mood da Biblioteca</b>
            <span>A atmosfera do launcher quando nenhum jogo define a zona</span>
          </div>
          <MoodPicker inline />
        </div>
      ) : null}
    </div>
  )
}
