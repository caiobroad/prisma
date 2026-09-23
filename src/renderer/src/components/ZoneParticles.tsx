import { useEffect, useRef } from 'react'
import type { ParticleKind } from '../lib/zones'
import { hexToRgb } from '../lib/color'

interface Props {
  kind: ParticleKind
  density: number
  accent: string
  accent2: string
  enabled: boolean
  paused: boolean
  lowFps: boolean
  light: boolean
}

type RGB = [number, number, number]

interface P {
  kind: ParticleKind
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rot: number
  age: number
  life: number
  seed: number
  color: RGB
  /** Cor pronta em string, criada uma vez (nada de strings novas a cada quadro). */
  css: string
  dying: number
}

/** Quantidade base por tipo, para uma janela de 1600×900. */
const BASE: Record<ParticleKind, number> = {
  none: 0,
  dust: 60,
  ash: 70,
  embers: 55,
  fog: 8,
  cubes: 28,
  bubbles: 40,
  neon: 30,
  snow: 110,
  rain: 120,
  spores: 45,
  sparks: 34
}

/** Resolução interna do canvas em relação ao CSS: partículas são suaves, não precisam de alta densidade. */
const SCALE = 0.6
/** 30 FPS bastam para partículas lentas; 20 no Modo Performance. */
const FRAME_MS = 1000 / 30
const FRAME_MS_LOW = 1000 / 20

const rand = (a: number, b: number): number => a + Math.random() * (b - a)
const rgb = (c: RGB): string => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`

function spawn(kind: ParticleKind, w: number, h: number, a1: RGB, a2: RGB, initial: boolean): P {
  const pick = (): RGB => (Math.random() < 0.6 ? a1 : a2)
  const anywhere = initial || kind === 'dust' || kind === 'cubes' || kind === 'spores'
  const p: P = {
    kind,
    x: rand(0, w),
    y: anywhere ? rand(0, h) : h + 20,
    vx: 0,
    vy: 0,
    size: 1,
    rot: rand(0, Math.PI * 2),
    age: 0,
    life: rand(600, 1400),
    seed: Math.random() * 1000,
    color: pick(),
    css: '',
    dying: 1
  }
  switch (kind) {
    case 'dust':
      p.size = rand(0.6, 1.9)
      p.vx = rand(-0.08, 0.08)
      p.vy = rand(-0.22, -0.04)
      p.color = Math.random() < 0.5 ? [255, 255, 255] : pick()
      break
    case 'ash':
      p.size = rand(1, 2.8)
      p.vx = rand(-0.15, 0.15)
      p.vy = rand(0.15, 0.45)
      if (!initial) p.y = -20
      p.color = [190, 182, 172]
      break
    case 'embers':
      p.size = rand(1, 2.6)
      p.vx = rand(-0.2, 0.2)
      p.vy = rand(-0.9, -0.3)
      p.color = Math.random() < 0.5 ? pick() : [255, 179, 107]
      break
    case 'fog':
      p.size = rand(220, 460)
      p.vx = rand(0.08, 0.32) * (Math.random() < 0.5 ? -1 : 1)
      p.vy = rand(-0.03, 0.03)
      p.y = rand(h * 0.2, h * 1.05)
      if (!initial) p.x = p.vx > 0 ? -p.size : w + p.size
      p.life = rand(1800, 3200)
      p.color = [200, 210, 190]
      break
    case 'cubes':
      p.size = rand(5, 12)
      p.vx = rand(-0.06, 0.06)
      p.vy = rand(-0.35, -0.1)
      break
    case 'bubbles':
      p.size = rand(1.5, 6)
      p.vy = rand(-0.8, -0.25)
      p.color = [210, 245, 255]
      break
    case 'neon':
      p.size = rand(40, 150)
      p.vy = rand(-4, -1.4)
      p.life = rand(200, 500)
      break
    case 'snow':
      p.size = rand(0.8, 3)
      p.vx = rand(-0.2, 0.2)
      p.vy = rand(0.3, 1)
      if (!initial) p.y = -10
      p.color = [240, 248, 255]
      break
    case 'rain':
      p.size = rand(10, 26)
      p.vx = -1.2
      p.vy = rand(7, 11)
      if (!initial) p.y = -30
      p.color = [190, 210, 230]
      break
    case 'spores':
      p.size = rand(1.4, 3.6)
      p.vx = rand(-0.12, 0.12)
      p.vy = rand(-0.12, 0.08)
      break
    case 'sparks':
      p.size = rand(8, 22)
      p.vx = rand(-1.2, 1.2)
      p.vy = rand(-3.2, -1.4)
      p.y = rand(h * 0.35, h + 10)
      p.life = rand(120, 320)
      break
  }
  return p
}

/** Sprites pré-renderizados por cor: brilho radial e névoa. Criados uma vez e reaproveitados. */
const sprites = new Map<string, HTMLCanvasElement>()
function glow(css: string, soft: boolean): HTMLCanvasElement {
  const key = `${soft ? 'f' : 'g'}${css}`
  let c = sprites.get(key)
  if (c) return c
  c = document.createElement('canvas')
  c.width = c.height = soft ? 128 : 32
  const ctx = c.getContext('2d')!
  const r = c.width / 2
  const g = ctx.createRadialGradient(r, r, 0, r, r, r)
  const base = css.replace('rgb(', 'rgba(').replace(')', ',')
  if (soft) {
    g.addColorStop(0, `${base}1)`)
    g.addColorStop(1, `${base}0)`)
  } else {
    g.addColorStop(0, `${base}1)`)
    g.addColorStop(0.3, `${base}0.4)`)
    g.addColorStop(1, `${base}0)`)
  }
  ctx.fillStyle = g
  ctx.fillRect(0, 0, c.width, c.height)
  if (sprites.size > 64) sprites.clear()
  sprites.set(key, c)
  return c
}

function draw(ctx: CanvasRenderingContext2D, p: P, alpha: number, t: number): void {
  switch (p.kind) {
    case 'dust':
      ctx.globalAlpha = alpha * 0.55 * (0.55 + 0.45 * Math.sin(t * 0.002 + p.seed))
      ctx.fillStyle = p.css
      ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2)
      break
    case 'ash':
      ctx.globalAlpha = alpha * 0.45
      ctx.fillStyle = p.css
      ctx.fillRect(p.x - p.size, p.y - p.size * 0.4, p.size * 2, p.size * 0.8)
      break
    case 'embers':
    case 'spores': {
      const pulse = p.kind === 'spores' ? 0.6 + 0.4 * Math.sin(t * 0.0015 + p.seed) : 1
      const s = p.size * 8
      ctx.globalAlpha = alpha * 0.9 * pulse
      ctx.drawImage(glow(p.css, false), p.x - s / 2, p.y - s / 2, s, s)
      break
    }
    case 'fog':
      ctx.globalAlpha = alpha * 0.075
      ctx.drawImage(glow(p.css, true), p.x - p.size, p.y - p.size, p.size * 2, p.size * 2)
      break
    case 'cubes': {
      const s = p.size
      const [r, g, b] = p.color
      ctx.globalAlpha = alpha * 0.55
      ctx.fillStyle = `rgb(${Math.min(255, r + 60)},${Math.min(255, g + 60)},${Math.min(255, b + 60)})`
      ctx.beginPath()
      ctx.moveTo(p.x, p.y - s)
      ctx.lineTo(p.x + s * 0.87, p.y - s * 0.5)
      ctx.lineTo(p.x, p.y)
      ctx.lineTo(p.x - s * 0.87, p.y - s * 0.5)
      ctx.fill()
      ctx.fillStyle = p.css
      ctx.beginPath()
      ctx.moveTo(p.x - s * 0.87, p.y - s * 0.5)
      ctx.lineTo(p.x, p.y)
      ctx.lineTo(p.x, p.y + s)
      ctx.lineTo(p.x - s * 0.87, p.y + s * 0.5)
      ctx.fill()
      ctx.globalAlpha = alpha * 0.35
      ctx.beginPath()
      ctx.moveTo(p.x + s * 0.87, p.y - s * 0.5)
      ctx.lineTo(p.x, p.y)
      ctx.lineTo(p.x, p.y + s)
      ctx.lineTo(p.x + s * 0.87, p.y + s * 0.5)
      ctx.fill()
      break
    }
    case 'bubbles':
      ctx.globalAlpha = alpha * 0.45
      ctx.strokeStyle = p.css
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.stroke()
      break
    case 'neon':
      ctx.globalAlpha = alpha * 0.6
      ctx.fillStyle = p.css
      ctx.fillRect(p.x, p.y, 1.4, p.size * 0.5)
      ctx.globalAlpha = alpha * 0.25
      ctx.fillRect(p.x, p.y + p.size * 0.5, 1.4, p.size * 0.5)
      break
    case 'snow':
      ctx.globalAlpha = alpha * 0.7
      ctx.fillStyle = p.css
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'rain':
      ctx.globalAlpha = alpha * 0.28
      ctx.strokeStyle = p.css
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x + p.vx * 2, p.y + p.size)
      ctx.stroke()
      break
    case 'sparks': {
      const n = Math.hypot(p.vx, p.vy) || 1
      ctx.globalAlpha = alpha * 0.7
      ctx.strokeStyle = p.css
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x - (p.vx / n) * p.size, p.y - (p.vy / n) * p.size)
      ctx.stroke()
      break
    }
  }
}

/**
 * Partículas discretas por zona, desenhadas atrás do vidro. Custo baixo por construção:
 * 30 FPS, resolução interna reduzida, sprites em cache, nenhuma alocação por quadro,
 * e o laço para por completo quando pausado, oculto ou sem partículas.
 */
export function ZoneParticles({ kind, density, accent, accent2, enabled, paused, lowFps, light }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const cfg = useRef({ kind, density, a1: hexToRgb(accent) as RGB, a2: hexToRgb(accent2) as RGB, enabled, paused, lowFps, light })
  const particles = useRef<P[]>([])
  const kick = useRef<() => void>(() => undefined)

  useEffect(() => {
    const prev = cfg.current
    cfg.current = { kind, density, a1: hexToRgb(accent) as RGB, a2: hexToRgb(accent2) as RGB, enabled, paused, lowFps, light }
    if (prev.kind !== kind || !enabled || prev.light !== light) {
      for (const p of particles.current) p.dying = Math.min(p.dying, 0.999)
    } else if (prev.a1.join() !== cfg.current.a1.join()) {
      for (const p of particles.current) {
        if (p.kind === 'ash' || p.kind === 'snow' || p.kind === 'rain' || p.kind === 'bubbles' || p.kind === 'fog') continue
        p.color = Math.random() < 0.6 ? cfg.current.a1 : cfg.current.a2
        p.css = rgb(p.color)
      }
    }
    kick.current()
  }, [kind, density, accent, accent2, enabled, paused, lowFps, light])

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    let w = 0
    let h = 0
    let raf = 0
    let last = 0
    let first = true

    const resize = (): void => {
      w = el.clientWidth
      h = el.clientHeight
      el.width = Math.max(1, Math.round(w * SCALE))
      el.height = Math.max(1, Math.round(h * SCALE))
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    // Só pede quadro quando vai desenhar: em monitores de 144/165 Hz, um rAF contínuo
    // manteria o compositor acordado na taxa do monitor mesmo desenhando a 30 FPS.
    let timer = 0
    let lastInput = performance.now()
    const onInput = (): void => {
      lastInput = performance.now()
    }
    window.addEventListener('pointermove', onInput, { passive: true })
    window.addEventListener('keydown', onInput)
    const schedule = (): void => {
      const c = cfg.current
      // Usuário parado há mais de 15 s: metade da taxa.
      const idle = performance.now() - lastInput > 15_000
      const step = c.lowFps ? FRAME_MS_LOW : idle ? FRAME_MS * 2 : FRAME_MS
      timer = window.setTimeout(() => {
        timer = 0
        raf = requestAnimationFrame(frame)
      }, step)
    }

    const frame = (now: number): void => {
      raf = 0
      const c = cfg.current
      if (c.paused || document.hidden || reduce.matches) return
      schedule()
      const dt = last ? Math.min(4, (now - last) / 16.67) : 1
      last = now
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, w, h)

      const area = (w * h) / (1600 * 900)
      const target = c.enabled ? Math.round(BASE[c.kind] * c.density * Math.max(0.5, area) * (c.lowFps ? 0.5 : 1)) : 0
      let alive = 0
      for (const p of particles.current) if (p.dying === 1 && p.kind === c.kind) alive++
      const budget = first ? target : Math.max(1, Math.round(target / 30))
      for (let i = 0; i < Math.min(budget, target - alive); i++) {
        const p = spawn(c.kind, w, h, c.a1, c.a2, first || c.kind === 'fog')
        if (c.light) {
          const [r, g, b] = p.color
          if (r + g + b > 520 || p.kind === 'ash' || p.kind === 'fog') p.color = [c.a1[0] * 0.55, c.a1[1] * 0.55, c.a1[2] * 0.55]
        }
        p.css = rgb(p.color)
        particles.current.push(p)
      }
      if (target > 0) first = false

      if (!c.light && (c.kind === 'embers' || c.kind === 'neon' || c.kind === 'sparks' || c.kind === 'spores')) ctx.globalCompositeOperation = 'lighter'
      const list = particles.current
      let n = 0
      for (let i = 0; i < list.length; i++) {
        const p = list[i]
        p.age += dt
        if (p.dying < 1) p.dying -= 0.03 * dt
        const sway = Math.sin(p.age * 0.02 + p.seed)
        if (p.kind === 'ash' || p.kind === 'snow') {
          p.x += (p.vx + sway * 0.25) * dt
          p.rot += 0.01 * dt
        } else if (p.kind === 'embers' || p.kind === 'bubbles') p.x += (p.vx + sway * 0.3) * dt
        else p.x += p.vx * dt
        p.y += p.vy * dt
        if (p.kind === 'sparks') p.vy += 0.02 * dt
        const out = p.y < -200 || p.y > h + 200 || p.x < -p.size - 200 || p.x > w + p.size + 200 || p.age > p.life || p.dying <= 0
        if (out) continue
        const alpha = Math.max(0, Math.min(1, p.age / 30) * Math.min(1, (p.life - p.age) / 60) * Math.max(0, p.dying))
        draw(ctx, p, alpha, now)
        list[n++] = p
      }
      list.length = n
      if (!n && target === 0 && timer) {
        window.clearTimeout(timer)
        timer = 0
      }
    }

    kick.current = (): void => {
      if (!raf && !timer) {
        last = 0
        raf = requestAnimationFrame(frame)
      }
    }
    const onVis = (): void => kick.current()
    document.addEventListener('visibilitychange', onVis)
    kick.current()
    return () => {
      if (raf) cancelAnimationFrame(raf)
      if (timer) window.clearTimeout(timer)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pointermove', onInput)
      window.removeEventListener('keydown', onInput)
      particles.current = []
    }
  }, [])

  return <canvas ref={canvas} className="zone-particles" aria-hidden="true" data-paused={paused ? '1' : '0'} />
}
