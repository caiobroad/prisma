import { useEffect, useRef, useState } from 'react'

export type PadAction = 'left' | 'right' | 'up' | 'down' | 'confirm' | 'back' | 'y' | 'x' | 'lb' | 'rb' | 'lt' | 'rt' | 'l3' | 'r3' | 'start' | 'select'

/** Qualquer atividade (mouse, teclado, controle) reinicia o contador de ociosidade. */
export const ACTIVITY = 'nexus-activity'

export function signalActivity(): void {
  window.dispatchEvent(new Event(ACTIVITY))
}

/** Verdadeiro depois de `ms` sem interação. Desliga sozinho quando `enabled` é falso. */
export function useIdle(ms: number, enabled: boolean): [boolean, () => void] {
  const [idle, setIdle] = useState(false)
  const timer = useRef<number | null>(null)
  const reset = useRef<() => void>(() => undefined)

  useEffect(() => {
    if (!enabled) {
      setIdle(false)
      return
    }
    const arm = (): void => {
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setIdle(true), ms)
    }
    const onActivity = (): void => {
      setIdle(false)
      arm()
    }
    reset.current = onActivity
    const evs = ['pointermove', 'pointerdown', 'keydown', 'wheel', ACTIVITY] as const
    evs.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    arm()
    return () => {
      evs.forEach((e) => window.removeEventListener(e, onActivity))
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [ms, enabled])

  return [idle, () => reset.current()]
}

const MAP: Record<number, PadAction> = {
  0: 'confirm',
  1: 'back',
  2: 'x',
  3: 'y',
  4: 'lb',
  5: 'rb',
  6: 'lt',
  7: 'rt',
  8: 'select',
  9: 'start',
  10: 'l3',
  11: 'r3',
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right'
}

const DIRS = new Set<PadAction>(['left', 'right', 'up', 'down'])
/** Sensibilidade 1–3: atraso até repetir e intervalo entre repetições dos direcionais. */
const REPEAT: Record<number, [number, number]> = { 1: [480, 150], 2: [380, 95], 3: [270, 55] }

export interface PadOptions {
  /** 1 (lenta) a 3 (rápida). */
  sensitivity?: number
  /** Analógico direito (cursor virtual): deflexão -1..1 já com zona morta, e ms desde a última leitura. */
  onRightStick?: (x: number, y: number, dt: number) => void
}

/**
 * Controle via Gamepad API. A leitura roda a ~60 Hz (não no ritmo do monitor de 165 Hz) e só
 * com a janela em foco e um controle conectado; direcionais repetem ao segurar.
 */
export function useGamepad(onAction: (a: PadAction) => void, active = true, opts: PadOptions = {}): boolean {
  const [connected, setConnected] = useState(false)
  const cb = useRef(onAction)
  cb.current = onAction
  const o = useRef(opts)
  o.current = opts

  useEffect(() => {
    const check = (): void => setConnected(navigator.getGamepads().some((g) => !!g))
    window.addEventListener('gamepadconnected', check)
    window.addEventListener('gamepaddisconnected', check)
    check()
    return () => {
      window.removeEventListener('gamepadconnected', check)
      window.removeEventListener('gamepaddisconnected', check)
    }
  }, [])

  useEffect(() => {
    if (!active || !connected) return
    const held = new Map<PadAction, number>()
    let last = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const dt = now - last
      last = now
      if (!document.hasFocus()) return
      const pad = navigator.getGamepads().find((g) => !!g)
      if (!pad) return
      const pressed = new Set<PadAction>()
      pad.buttons.forEach((b, i) => {
        const a = MAP[i]
        if (a && (b.pressed || ((i === 6 || i === 7) && b.value > 0.55))) pressed.add(a)
      })
      const [ax = 0, ay = 0, rx = 0, ry = 0] = pad.axes
      if (ax < -0.5) pressed.add('left')
      if (ax > 0.5) pressed.add('right')
      if (ay < -0.5) pressed.add('up')
      if (ay > 0.5) pressed.add('down')
      const stick = o.current.onRightStick
      if (stick) {
        const mag = Math.hypot(rx, ry)
        if (mag > 0.18) {
          const k = (mag - 0.18) / (1 - 0.18) / mag
          stick(rx * k, ry * k, dt)
          signalActivity()
        }
      }
      const [delay, rate] = REPEAT[o.current.sensitivity ?? 2] ?? REPEAT[2]
      for (const a of pressed) {
        const since = held.get(a)
        if (since == null) {
          held.set(a, now)
          cb.current(a)
          signalActivity()
        } else if (DIRS.has(a) && now - since > delay) {
          held.set(a, now - delay + rate)
          cb.current(a)
          signalActivity()
        }
      }
      for (const a of [...held.keys()]) if (!pressed.has(a)) held.delete(a)
    }, 16)
    return () => window.clearInterval(timer)
  }, [active, connected])

  return connected
}