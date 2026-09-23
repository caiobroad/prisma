import { memo, useEffect, useRef } from 'react'
import {
  IconBack,
  IconExitFullscreen,
  IconFullscreen,
  IconGamepad,
  IconGauge,
  IconMoon,
  IconRefresh,
  IconSearch,
  IconSun,
  IconWinClose,
  IconWinMax,
  IconWinMin,
  IconWinRestore
} from './Icons'
import { scan, updateSettings, useStore } from '../lib/store'

interface Props {
  query: string
  onQuery: (q: string) => void
  canBack: boolean
  onBack: () => void
  zoneName: string | null
  dark: boolean
  onController: () => void
}

/** Marca do Prisma: o prisma com o feixe de luz. As faces seguem o acento da zona. */
function PrismaMark() {
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

export const TitleBar = memo(function TitleBar({ query, onQuery, canBack, onBack, zoneName, dark, onController }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const scanning = useStore((s) => s.scanning)
  const win = useStore((s) => s.win)
  const perfMode = useStore((s) => s.settings.performanceMode)
  const zoneOn = useStore((s) => s.settings.zoneMode)
  const status = useStore((s) => (s.scanning ? 'syncing' : s.running.size > 0 ? 'playing' : 'online'))

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        ref.current?.focus()
        ref.current?.select()
      }
      if (e.key === 'Escape' && document.activeElement === ref.current) {
        onQuery('')
        ref.current?.blur()
        e.stopPropagation()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onQuery])

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
      <label className="search">
        <IconSearch width={15} height={15} />
        <input
          id="search"
          ref={ref}
          type="search"
          placeholder="Buscar na biblioteca"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          aria-label="Buscar na biblioteca"
        />
        <kbd>Ctrl K</kbd>
      </label>
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
        <button className="tb-icon" onClick={() => void updateSettings({ theme: dark ? 'light' : 'dark' })} aria-label={dark ? 'Modo claro' : 'Modo escuro'} title={dark ? 'Modo claro' : 'Modo escuro'}>
          {dark ? <IconSun width={16} height={16} /> : <IconMoon width={16} height={16} />}
        </button>
        <button className={`tb-icon ${scanning ? 'spin' : ''}`} onClick={() => void scan()} disabled={scanning} aria-label="Sincronizar bibliotecas" title="Sincronizar bibliotecas (F5)">
          <IconRefresh width={16} height={16} />
        </button>
        <span className={`status-dot ${status}`} title={status === 'playing' ? 'Em jogo' : status === 'syncing' ? 'Sincronizando' : 'Online'} />
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
