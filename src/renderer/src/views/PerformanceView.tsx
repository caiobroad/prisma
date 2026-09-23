import { useEffect, useState } from 'react'
import type { Session } from '@shared/types'
import { PerfGrid, usePerfHistory } from '../components/PerfMetrics'
import { ScrollView } from '../components/ScrollView'
import { formatBytes, formatDate, formatDuration } from '../lib/format'
import { updateSettings, useStore } from '../lib/store'

export function PerformanceView() {
  const hist = usePerfHistory()
  const settings = useStore((s) => s.settings)
  const byId = useStore((s) => s.byId)
  const [proc, setProc] = useState('')
  const [pmPath, setPmPath] = useState(settings.presentMonPath)
  const [mem, setMem] = useState<number | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const last = hist[hist.length - 1]

  useEffect(() => {
    const read = (): void => void window.nexus.memory().then(setMem)
    read()
    const t = window.setInterval(read, 3000)
    void window.nexus.timeline().then((d) => setSessions(d.sessions.filter((s) => s.avgCpu != null).slice(0, 8)))
    return () => window.clearInterval(t)
  }, [])

  const addProc = (): void => {
    const name = proc.trim()
    if (!name) return
    const exe = /\.exe$/i.test(name) ? name : `${name}.exe`
    if (!settings.heavyProcesses.some((p) => p.toLowerCase() === exe.toLowerCase())) {
      void updateSettings({ heavyProcesses: [...settings.heavyProcesses, exe] })
    }
    setProc('')
  }

  return (
    <ScrollView>
      <header className="view-head">
        <div className="view-title">
          <h1>Performance Center</h1>
          <p>
            {last?.gpuName ?? 'Sistema'} · leitura a cada segundo enquanto esta tela está aberta, a cada 5 s durante o jogo e desligada no resto do tempo
          </p>
        </div>
        <div className="mem-badge glass" title="Soma de todos os processos do launcher">
          <span>Launcher usando</span>
          <b>{mem == null ? '…' : formatBytes(mem)}</b>
        </div>
      </header>

      <PerfGrid hist={hist} />

      <div className="settings-grid">
        <section className="glass card">
          <div className="card-title row between">
            <h2>Modo Performance</h2>
            <button
              id="tg-performanceMode"
              className="tg"
              role="switch"
              aria-checked={settings.performanceMode}
              aria-label="Modo Performance"
              onClick={() => void updateSettings({ performanceMode: !settings.performanceMode })}
            />
          </div>
          <ul className="perf-list">
            <li>Fecha os processos da lista abaixo antes do jogo abrir (pedido normal de fechamento, sem forçar).</li>
            <li>Destrói a janela do launcher enquanto o jogo roda, liberando a memória da interface. Ele volta sozinho quando o jogo fecha.</li>
            <li>Baixa a prioridade dos processos do launcher e suspende trailers, partículas e animações.</li>
            <li>Mantém só a contagem de tempo e o monitor a cada 5 s.</li>
          </ul>
          <div className="proc-editor">
            <div className="proc-chips">
              {settings.heavyProcesses.length === 0 ? <span className="muted small">Nenhum processo configurado.</span> : null}
              {settings.heavyProcesses.map((p) => (
                <span key={p} className="chip on proc">
                  {p}
                  <button aria-label={`Remover ${p}`} onClick={() => void updateSettings({ heavyProcesses: settings.heavyProcesses.filter((x) => x !== p) })}>
                    ×
                  </button>
                </span>
              ))}
            </div>
            <form
              className="field inline"
              onSubmit={(e) => {
                e.preventDefault()
                addProc()
              }}
            >
              <input id="proc-name" value={proc} onChange={(e) => setProc(e.target.value)} placeholder="ex.: chrome.exe" spellCheck={false} />
              <button className="btn ghost sm" type="submit">
                Adicionar
              </button>
            </form>
          </div>
        </section>

        <section className="glass card">
          <h2 className="card-title">Fontes de leitura</h2>
          <dl className="facts pad-x">
            <div>
              <dt>GPU, VRAM e temperatura</dt>
              <dd>{last?.sources.gpu === 'nvidia' ? 'nvidia-smi' : last?.sources.gpu === 'wmi' ? 'Contadores do Windows (sem temperatura)' : 'Aguardando leitura…'}</dd>
            </div>
            <div>
              <dt>Temperatura do processador</dt>
              <dd>{last?.sources.cpuTemp ? 'Zona térmica ACPI (aproximada)' : 'Sensor indisponível'}</dd>
            </div>
            <div>
              <dt>FPS</dt>
              <dd>{settings.presentMonPath ? 'PresentMon, durante o jogo' : 'Requer PresentMon'}</dd>
            </div>
          </dl>
          <form
            className="field pad-x"
            onSubmit={(e) => {
              e.preventDefault()
              void updateSettings({ presentMonPath: pmPath.trim() })
            }}
          >
            <span>Caminho do PresentMon.exe (opcional; costuma exigir executar o Prisma como administrador)</span>
            <div className="with-btn">
              <input id="pm-path" value={pmPath} onChange={(e) => setPmPath(e.target.value)} placeholder="C:\Ferramentas\PresentMon.exe" spellCheck={false} />
              <button className="btn ghost sm" type="submit">
                Salvar
              </button>
            </div>
          </form>
        </section>

        {sessions.length ? (
          <section className="glass card">
            <h2 className="card-title">Últimas sessões monitoradas</h2>
            <div className="table-wrap">
              <table className="perf-table">
                <thead>
                  <tr>
                    <th>Jogo</th>
                    <th>Data</th>
                    <th>Duração</th>
                    <th>CPU</th>
                    <th>GPU</th>
                    <th>FPS</th>
                    <th>GPU máx.</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td>{byId.get(s.gameId)?.title ?? '—'}</td>
                      <td>{formatDate(s.startedAt)}</td>
                      <td>{formatDuration(s.durationSeconds)}</td>
                      <td>{s.avgCpu != null ? `${Math.round(s.avgCpu)}%` : '—'}</td>
                      <td>{s.avgGpu != null ? `${Math.round(s.avgGpu)}%` : '—'}</td>
                      <td>{s.avgFps != null ? Math.round(s.avgFps) : '—'}</td>
                      <td>{s.maxGpuTemp != null ? `${Math.round(s.maxGpuTemp)} °C` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </ScrollView>
  )
}
