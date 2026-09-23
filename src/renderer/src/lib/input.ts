import { useEffect, useRef, useState } from 'react'

export type PadAction = 'left' | 'right' | 'up' | 'down' | 'confirm' | 'back' | 'y' | 'x' | 'lb' | 'rb' | 'start' | 'select'

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
  8: 'select',
  9: 'start',
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right'
}

/**
 * Controle via Gamepad API. O polling (requestAnimationFrame) só roda com a janela
 * em foco e um controle conectado; direcionais repetem ao segurar.
 */
export function useGamepad(onAction: (a: PadAction) => void, active = true): boolean {
  const [connected, setConnected] = useState(false)
  const cb = useRef(onAction)
  cb.current = onAction

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
    let raf = 0
    const held = new Map<PadAction, number>()
    const loop = (): void => {
      raf = requestAnimationFrame(loop)
      if (!document.hasFocus()) return
      const pad = navigator.getGamepads().find((g) => !!g)
      if (!pad) return
      const now = performance.now()
      const pressed = new Set<PadAction>()
      pad.buttons.forEach((b, i) => {
        const a = MAP[i]
        if (a && b.pressed) pressed.add(a)
      })
      const [ax = 0, ay = 0] = pad.axes
      if (ax < -0.5) pressed.add('left')
      if (ax > 0.5) pressed.add('right')
      if (ay < -0.5) pressed.add('up')
      if (ay > 0.5) pressed.add('down')
      for (const a of pressed) {
        const since = held.get(a)
        const repeatable = a === 'left' || a === 'right' || a === 'up' || a === 'down'
        if (since == null) {
          held.set(a, now)
          cb.current(a)
          signalActivity()
        } else if (repeatable && now - since > 380) {
          held.set(a, now - 380 + 90)
          cb.current(a)
          signalActivity()
        }
      }
      for (const a of [...held.keys()]) if (!pressed.has(a)) held.delete(a)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active, connected])

  return connected
}
