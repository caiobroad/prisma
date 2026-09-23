import { memo, useEffect, useRef, useState } from 'react'
import type { PerfSample } from '@shared/types'
import { useStore } from '../lib/store'

const HISTORY = 60

/** Liga o monitor em tempo real enquanto o componente existir e guarda os últimos 60 s. */
export function usePerfHistory(): PerfSample[] {
  const sample = useStore((s) => s.perf)
  const [hist, setHist] = useState<PerfSample[]>([])
  useEffect(() => {
    window.nexus.perf.watch(true)
    void window.nexus.perf.last().then((s) => s && setHist([s]))
    return () => window.nexus.perf.watch(false)
  }, [])
  const lastT = useRef(0)
  useEffect(() => {
    if (!sample || sample.t === lastT.current) return
    lastT.current = sample.t
    setHist((h) => [...h.slice(-(HISTORY - 1)), sample])
  }, [sample])
  return hist
}

const GB = 1024 ** 3

interface Metric {
  id: string
  label: string
  unit: string
  max: number
  value: (s: PerfSample) => number | null
  display?: (s: PerfSample) => string
  missing: string
  warn?: number
}

export const METRICS: Metric[] = [
  { id: 'gpu', label: 'Uso da GPU', unit: '%', max: 100, value: (s) => s.gpu, missing: 'Sem leitura de GPU', warn: 95 },
  { id: 'cpu', label: 'Uso da CPU', unit: '%', max: 100, value: (s) => s.cpu, missing: '—', warn: 90 },
  {
    id: 'ram',
    label: 'Memória RAM',
    unit: '%',
    max: 100,
    value: (s) => (100 * s.ramUsed) / s.ramTotal,
    display: (s) => `${(s.ramUsed / GB).toFixed(1)} / ${(s.ramTotal / GB).toFixed(0)} GB`,
    missing: '—',
    warn: 90
  },
  { id: 'cpuTemp', label: 'Temperatura do processador', unit: '°C', max: 105, value: (s) => s.cpuTemp, missing: 'Sensor ACPI indisponível', warn: 90 },
  { id: 'gpuTemp', label: 'Temperatura da GPU', unit: '°C', max: 100, value: (s) => s.gpuTemp, missing: 'Requer GPU NVIDIA', warn: 85 },
  { id: 'fps', label: 'FPS no jogo', unit: '', max: 240, value: (s) => s.fps, missing: 'Durante o jogo, com PresentMon' },
  {
    id: 'vram',
    label: 'VRAM utilizada',
    unit: '%',
    max: 100,
    value: (s) => (s.vramUsed != null && s.vramTotal ? (100 * s.vramUsed) / s.vramTotal : s.vramUsed != null ? null : null),
    display: (s) => (s.vramUsed == null ? '—' : s.vramTotal ? `${(s.vramUsed / GB).toFixed(1)} / ${(s.vramTotal / GB).toFixed(0)} GB` : `${(s.vramUsed / GB).toFixed(1)} GB`),
    missing: 'Sem leitura de VRAM'
  }
]

function Spark({ values, max }: { values: Array<number | null>; max: number }) {
  const pts = values.map((v, i) => (v == null ? null : [(i / (HISTORY - 1)) * 100, 30 - (Math.min(v, max) / max) * 28])).filter((p): p is number[] => !!p)
  if (pts.length < 2) return <svg className="spark" viewBox="0 0 100 30" preserveAspectRatio="none" />
  const offset = 100 - pts[pts.length - 1][0]
  const line = pts.map((p) => `${(p[0] + offset).toFixed(2)},${p[1].toFixed(2)}`).join(' ')
  const area = `${(pts[0][0] + offset).toFixed(2)},30 ${line} 100,30`
  return (
    <svg className="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <polygon points={area} className="spark-area" />
      <polyline points={line} className="spark-line" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export const MetricTile = memo(function MetricTile({ m, hist }: { m: Metric; hist: PerfSample[] }) {
  const last = hist[hist.length - 1]
  const v = last ? m.value(last) : null
  const shown = last && m.display ? m.display(last) : v == null ? '—' : `${Math.round(v)}${m.unit}`
  const unavailable = !!last && v == null && (!m.display || shown === '—')
  const hot = v != null && m.warn != null && v >= m.warn
  return (
    <div className={`metric glass ${unavailable ? 'off' : ''} ${hot ? 'hot' : ''}`}>
      <span className="metric-label">{m.label}</span>
      <b className="metric-value">{last ? shown : '…'}</b>
      {unavailable ? <span className="metric-note">{m.missing}</span> : <Spark values={hist.map(m.value)} max={m.max} />}
    </div>
  )
})

export function PerfGrid({ hist }: { hist: PerfSample[] }) {
  return (
    <div className="metrics">
      {METRICS.map((m) => (
        <MetricTile key={m.id} m={m} hist={hist} />
      ))}
    </div>
  )
}
