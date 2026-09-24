import { memo } from 'react'
import { DNA_AXES, DNA_TITLES, type Dna } from '../lib/dna'

const SIZE = 260
const C = SIZE / 2
const R = 96

function point(i: number, v: number): [number, number] {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / DNA_AXES.length
  return [C + Math.cos(a) * R * v, C + Math.sin(a) * R * v]
}

const poly = (vals: number[]): string => vals.map((v, i) => point(i, v).map((n) => n.toFixed(1)).join(',')).join(' ')

/** Margem lateral do desenho para os rótulos ("Sobrevivência" é longo). */
const PAD_X = 64
const PAD_Y = 12

/** Radar de seis eixos. Com `compare`, desenha o DNA de outra pessoa por baixo, tracejado. */
export const DnaRadar = memo(function DnaRadar({ dna, compare, size = SIZE }: { dna: Dna; compare?: Dna | null; size?: number }) {
  const w = SIZE + PAD_X * 2
  const h = SIZE + PAD_Y * 2
  const vals = DNA_AXES.map((a) => Math.max(0.04, dna.values[a] / 100))
  return (
    <svg className="dna-radar" viewBox={`${-PAD_X} ${-PAD_Y} ${w} ${h}`} width={(size * w) / SIZE} height={(size * h) / SIZE} role="img" aria-label="Game DNA">
      <defs>
        <radialGradient id="dnaFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent-2)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.25" />
        </radialGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon key={k} points={poly(DNA_AXES.map(() => k))} className="dna-ring" />
      ))}
      {DNA_AXES.map((_, i) => {
        const [x, y] = point(i, 1)
        return <line key={i} x1={C} y1={C} x2={x} y2={y} className="dna-spoke" />
      })}
      {compare ? <polygon points={poly(DNA_AXES.map((a) => Math.max(0.04, compare.values[a] / 100)))} className="dna-compare" /> : null}
      <polygon points={poly(vals)} className="dna-shape" fill="url(#dnaFill)" />
      {vals.map((v, i) => {
        const [x, y] = point(i, v)
        return <circle key={i} cx={x} cy={y} r={3.2} className="dna-dot" />
      })}
      {DNA_AXES.map((a, i) => {
        const [x, y] = point(i, 1.2)
        return (
          <text key={a} x={x} y={y} className={`dna-label ${dna.dominant === a ? 'dom' : ''}`} textAnchor={Math.abs(x - C) < 4 ? 'middle' : x > C ? 'start' : 'end'} dominantBaseline="middle">
            {a}
          </text>
        )
      })}
    </svg>
  )
})

/** Cartão 1200×630 em PNG para compartilhar: radar, nickname, título e fatias. */
export async function renderDnaCard(dna: Dna, name: string, accentIn: string, accent2In: string, avatar: string | null): Promise<string> {
  const W = 1200
  const H = 630
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')!
  // As variáveis da zona chegam como "rgb(…)"; o canvas devolve qualquer cor válida como #rrggbb,
  // e é nesse formato que dá para acrescentar transparência ("#rrggbb55").
  const hex = (c: string, fallback: string): string => {
    ctx.fillStyle = fallback
    ctx.fillStyle = c || fallback
    const v = String(ctx.fillStyle)
    return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback
  }
  const accent = hex(accentIn, '#7c9cff')
  const accent2 = hex(accent2In, '#3dd9eb')
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#0b0e18')
  bg.addColorStop(1, '#151a2c')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(380, 300, 20, 380, 300, 420)
  glow.addColorStop(0, accent + '55')
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // Radar
  const cx = 380
  const cy = 330
  const r = 210
  const pt = (i: number, v: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / DNA_AXES.length
    return [cx + Math.cos(a) * r * v, cy + Math.sin(a) * r * v]
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 1.5
  for (const k of [0.25, 0.5, 0.75, 1]) {
    ctx.beginPath()
    DNA_AXES.forEach((_, i) => {
      const [x, y] = pt(i, k)
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    })
    ctx.closePath()
    ctx.stroke()
  }
  ctx.beginPath()
  DNA_AXES.forEach((a, i) => {
    const [x, y] = pt(i, Math.max(0.04, dna.values[a] / 100))
    if (i) ctx.lineTo(x, y)
    else ctx.moveTo(x, y)
  })
  ctx.closePath()
  const fill = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
  fill.addColorStop(0, accent2 + 'aa')
  fill.addColorStop(1, accent + '55')
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = accent
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.font = '600 22px "Segoe UI Variable Display", "Segoe UI", sans-serif'
  ctx.textBaseline = 'middle'
  DNA_AXES.forEach((a, i) => {
    const [x, y] = pt(i, 1.17)
    ctx.textAlign = Math.abs(x - cx) < 4 ? 'center' : x > cx ? 'left' : 'right'
    ctx.fillStyle = dna.dominant === a ? accent : 'rgba(255,255,255,0.75)'
    ctx.fillText(a, x, y)
  })

  // Texto
  const x0 = 690
  if (avatar) {
    try {
      const img = new Image()
      img.src = avatar
      await img.decode()
      ctx.save()
      ctx.beginPath()
      ctx.arc(x0 + 44, 118, 44, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, x0, 74, 88, 88)
      ctx.restore()
    } catch {
      /* avatar ilegível */
    }
  }
  const tx = avatar ? x0 + 108 : x0
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '700 18px "Segoe UI", sans-serif'
  ctx.fillText('GAME DNA', tx, 100)
  ctx.fillStyle = '#fff'
  ctx.font = '700 40px "Segoe UI Variable Display", "Segoe UI", sans-serif'
  ctx.fillText(name.slice(0, 22), tx, 140)
  ctx.fillStyle = accent
  ctx.font = '600 26px "Segoe UI", sans-serif'
  ctx.fillText(dna.dominant ? DNA_TITLES[dna.dominant] : 'Explorador', x0, 222)

  const sorted = [...DNA_AXES].sort((a, b) => dna.share[b] - dna.share[a])
  sorted.forEach((a, i) => {
    const y = 280 + i * 50
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.font = '600 20px "Segoe UI", sans-serif'
    ctx.fillText(a, x0, y)
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.fillRect(x0 + 170, y - 6, 260, 12)
    const g = ctx.createLinearGradient(x0 + 170, 0, x0 + 430, 0)
    g.addColorStop(0, accent)
    g.addColorStop(1, accent2)
    ctx.fillStyle = g
    ctx.fillRect(x0 + 170, y - 6, 260 * (dna.values[a] / 100), 12)
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.textAlign = 'right'
    ctx.fillText(`${Math.round(dna.share[a] * 100)}%`, x0 + 490, y)
    ctx.textAlign = 'left'
  })
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.font = '600 16px "Segoe UI", sans-serif'
  ctx.fillText(`${Math.round(dna.hours).toLocaleString('pt-BR')} h analisadas · Prisma`, x0, 590)
  return cv.toDataURL('image/png')
}
