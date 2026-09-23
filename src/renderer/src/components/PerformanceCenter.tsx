import { useEffect } from 'react'
import type { Game } from '@shared/types'
import { PerfGrid, usePerfHistory } from './PerfMetrics'
import { IconPlay } from './Icons'
import { cancelLaunch, startGame, updateSettings, useStore } from '../lib/store'

/** Painel opcional antes do jogo abrir: sistema em tempo real e o Modo Performance. */
export function PerformanceCenter({ game }: { game: Game }) {
  const hist = usePerfHistory()
  const perfMode = useStore((s) => s.settings.performanceMode)
  const heavy = useStore((s) => s.settings.heavyProcesses)
  const showOnLaunch = useStore((s) => s.settings.perfCenterOnLaunch)
  const gpuName = hist[hist.length - 1]?.gpuName

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') cancelLaunch()
      if (e.key === 'Enter') void startGame(game)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [game])

  return (
    <div className="sheet" onMouseDown={(e) => e.target === e.currentTarget && cancelLaunch()}>
      <div className="pane pc-pane" role="dialog" aria-label="Performance Center">
        <div className="pc-head">
          <div>
            <span className="eyebrow">Performance Center</span>
            <h3>{game.title}</h3>
            <p className="muted small">{gpuName ? gpuName : 'Leitura do sistema em tempo real'}</p>
          </div>
          <button
            className={`perf-toggle ${perfMode ? 'on' : ''}`}
            onClick={() => void updateSettings({ performanceMode: !perfMode })}
            aria-pressed={perfMode}
          >
            <span className="perf-toggle-dot" />
            <span>
              <b>Modo Performance</b>
              <em>{perfMode ? (heavy.length ? `fecha ${heavy.length} processo${heavy.length > 1 ? 's' : ''} e libera a memória do launcher` : 'libera a memória do launcher durante o jogo') : 'desligado'}</em>
            </span>
          </button>
        </div>

        <PerfGrid hist={hist} />

        <div className="pc-foot">
          <label className="check">
            <input id="pc-show" type="checkbox" checked={showOnLaunch} onChange={(e) => void updateSettings({ perfCenterOnLaunch: e.target.checked })} />
            Mostrar antes de jogar
          </label>
          <div className="row">
            <button className="btn ghost" onClick={cancelLaunch}>
              Cancelar
            </button>
            <button className="btn btn-play" autoFocus onClick={() => void startGame(game)}>
              <IconPlay width={15} height={15} />
              Jogar agora
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
