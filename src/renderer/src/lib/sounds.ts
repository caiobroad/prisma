import { getState } from './store'

/**
 * Sons de sistema estilo console, sintetizados na hora (nenhum arquivo de áudio).
 * O AudioContext só nasce no primeiro som e é suspenso depois de 20 s de silêncio,
 * para não manter a thread de áudio acordada.
 */
export type Sfx = 'move' | 'confirm' | 'back' | 'tab' | 'boot' | 'error' | 'open'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let idleTimer: number | null = null
let lastMove = 0

function audio(): { ctx: AudioContext; out: GainNode } {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: 'interactive' })
    master = ctx.createGain()
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  if (idleTimer) window.clearTimeout(idleTimer)
  idleTimer = window.setTimeout(() => void ctx?.suspend(), 20_000)
  return { ctx, out: master! }
}

function tone(freq: number, at: number, dur: number, gain: number, type: OscillatorType = 'sine', glideTo?: number): void {
  const { ctx, out } = audio()
  const t = ctx.currentTime + at
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + dur + 0.02)
}

/** Varredura de ruído filtrado (troca de aba). */
function whoosh(at: number, dur: number, gain: number): void {
  const { ctx, out } = audio()
  const t = ctx.currentTime + at
  const len = Math.floor(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = ctx.createBufferSource()
  src.buffer = buf
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = 1.2
  f.frequency.setValueAtTime(600, t)
  f.frequency.exponentialRampToValueAtTime(3200, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(gain, t)
  src.connect(f).connect(g).connect(out)
  src.start(t)
}

export function sfx(kind: Sfx, force = false): void {
  const c = getState().settings.controller
  if (!force && !c.sounds) return
  try {
    const { out } = audio()
    out.gain.value = Math.max(0, Math.min(1, c.volume))
    switch (kind) {
      case 'move': {
        // Repetição rápida do direcional não vira metralhadora.
        const now = performance.now()
        if (now - lastMove < 45) return
        lastMove = now
        tone(1850, 0, 0.05, 0.08, 'sine')
        tone(3700, 0, 0.03, 0.02, 'sine')
        break
      }
      case 'confirm':
        tone(880, 0, 0.12, 0.13, 'sine')
        tone(1320, 0.06, 0.2, 0.12, 'sine')
        break
      case 'open':
        tone(660, 0, 0.14, 0.1, 'triangle')
        tone(990, 0.05, 0.22, 0.09, 'sine')
        break
      case 'back':
        tone(1100, 0, 0.1, 0.11, 'sine', 620)
        break
      case 'tab':
        whoosh(0, 0.16, 0.08)
        tone(1480, 0.02, 0.06, 0.05)
        break
      case 'error':
        tone(220, 0, 0.18, 0.12, 'triangle')
        tone(196, 0.1, 0.22, 0.1, 'triangle')
        break
      case 'boot': {
        // Acorde que cresce: fundamental, quinta, oitava e um brilho no fim.
        const notes = [130.8, 196, 261.6, 329.6, 392]
        notes.forEach((n, i) => tone(n, i * 0.09, 2.4 - i * 0.2, 0.07, i < 2 ? 'triangle' : 'sine'))
        tone(1567.98, 0.9, 1.4, 0.04, 'sine')
        tone(2093, 1.05, 1.2, 0.025, 'sine')
        break
      }
    }
  } catch {
    /* sem dispositivo de áudio */
  }
}

/** Reverb sintético (ruído com decaimento), para os sons longos da introdução. */
function reverb(ctx: AudioContext, seconds: number): ConvolverNode {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6)
  }
  const c = ctx.createConvolver()
  c.buffer = buf
  return c
}

/**
 * Som de abertura, no espírito dos consoles: um acorde que cresce devagar com o filtro se
 * abrindo, um grave por baixo e brilhos agudos no topo, tudo com um reverb longo. Sintetizado
 * aqui (nenhum arquivo, nenhum som de terceiros).
 */
export function startupChime(volume = 0.55): void {
  try {
    const { ctx, out } = audio()
    out.gain.value = volume
    const t0 = ctx.currentTime + 0.05
    const wet = ctx.createGain()
    wet.gain.value = 0.55
    const rv = reverb(ctx, 4.2)
    rv.connect(wet).connect(out)
    const bus = ctx.createGain()
    bus.connect(out)
    bus.connect(rv)

    // Colchão: ré maior com nona, vozes levemente desafinadas, filtro abrindo.
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.value = 0.7
    filter.frequency.setValueAtTime(260, t0)
    filter.frequency.exponentialRampToValueAtTime(3600, t0 + 2.6)
    filter.frequency.exponentialRampToValueAtTime(1400, t0 + 6)
    const pad = ctx.createGain()
    pad.gain.setValueAtTime(0.0001, t0)
    pad.gain.exponentialRampToValueAtTime(0.16, t0 + 1.9)
    pad.gain.setValueAtTime(0.16, t0 + 2.8)
    pad.gain.exponentialRampToValueAtTime(0.0001, t0 + 6.4)
    filter.connect(pad).connect(bus)
    for (const f of [146.83, 220, 293.66, 369.99, 440, 659.25]) {
      for (const det of [-7, 6]) {
        const o = ctx.createOscillator()
        o.type = f < 300 ? 'sawtooth' : 'triangle'
        o.frequency.value = f
        o.detune.value = det
        const g = ctx.createGain()
        g.gain.value = f < 300 ? 0.05 : 0.08
        o.connect(g).connect(filter)
        o.start(t0)
        o.stop(t0 + 6.6)
      }
    }

    // Grave que sobe por baixo.
    const sub = ctx.createOscillator()
    sub.type = 'sine'
    sub.frequency.setValueAtTime(73.42, t0)
    const sg = ctx.createGain()
    sg.gain.setValueAtTime(0.0001, t0)
    sg.gain.exponentialRampToValueAtTime(0.22, t0 + 1.6)
    sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 5.5)
    sub.connect(sg).connect(bus)
    sub.start(t0)
    sub.stop(t0 + 5.6)

    // Sopro de ar no começo.
    const len = Math.floor(ctx.sampleRate * 2.4)
    const nb = ctx.createBuffer(1, len, ctx.sampleRate)
    const nd = nb.getChannelData(0)
    for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1
    const ns = ctx.createBufferSource()
    ns.buffer = nb
    const nf = ctx.createBiquadFilter()
    nf.type = 'bandpass'
    nf.Q.value = 0.9
    nf.frequency.setValueAtTime(400, t0)
    nf.frequency.exponentialRampToValueAtTime(5200, t0 + 2.2)
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.0001, t0)
    ng.gain.exponentialRampToValueAtTime(0.05, t0 + 1.4)
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4)
    ns.connect(nf).connect(ng).connect(bus)
    ns.start(t0)

    // Brilhos: um arpejo agudo que cai no topo do acorde.
    const sparkle = [1174.66, 1479.98, 1760, 2349.32, 2959.96, 3520]
    sparkle.forEach((f, i) => {
      const at = t0 + 1.55 + i * 0.13
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(0.045 - i * 0.004, at + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.6)
      o.connect(g).connect(bus)
      o.start(at)
      o.stop(at + 1.7)
    })
  } catch {
    /* sem dispositivo de áudio */
  }
}

/** Clique para entrar: um acorde curto e brilhante com um sopro subindo. */
export function enterChime(volume = 0.55): void {
  try {
    const { ctx, out } = audio()
    out.gain.value = volume
    whoosh(0, 0.5, 0.07)
    tone(587.33, 0, 0.9, 0.08, 'triangle')
    tone(880, 0.04, 1, 0.07, 'sine')
    tone(1174.66, 0.08, 1.1, 0.06, 'sine')
    tone(1760, 0.14, 1.2, 0.035, 'sine')
  } catch {
    /* sem dispositivo de áudio */
  }
}

/** Vibração curta no controle (quando o controle e o ajuste permitem). */
export function rumble(strength: 'light' | 'strong' = 'light'): void {
  if (!getState().settings.controller.vibration) return
  const pad = navigator.getGamepads().find((g) => !!g) as (Gamepad & { vibrationActuator?: GamepadHapticActuator }) | undefined
  const act = pad?.vibrationActuator
  if (!act) return
  const light = strength === 'light'
  void act
    .playEffect('dual-rumble', {
      duration: light ? 28 : 90,
      strongMagnitude: light ? 0.05 : 0.45,
      weakMagnitude: light ? 0.25 : 0.6
    })
    .catch(() => undefined)
}
