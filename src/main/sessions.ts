import type { ChildProcess } from 'child_process'
import { powershellJson } from './util/exec'
import { endSession, startSession } from './db/games'
import { monitor } from './monitor'
import { activeProfileId } from './profiles'
import type { Game } from '@shared/types'

export type SessionEvent =
  | { type: 'started'; gameId: number; sessionId: number; game: Game }
  | { type: 'ended'; gameId: number; sessionId: number; game: Game; durationSeconds: number; startedAt: number }

type Listener = (ev: SessionEvent) => void

interface Tracked {
  sessionId: number
  game: Game
  child?: ChildProcess
  timer?: NodeJS.Timeout
  graceUntil: number
}

const tracked = new Map<number, Tracked>()
const listeners = new Set<Listener>()

export function onSession(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

function emit(ev: SessionEvent): void {
  for (const l of listeners) l(ev)
}

/** Sessão de um jogo manual/GOG: o processo é filho do Prisma, então o fim é exato. */
export function trackChild(game: Game, child: ChildProcess): void {
  if (tracked.has(game.id)) return
  const sessionId = startSession(game.id, activeProfileId())
  tracked.set(game.id, { sessionId, game, child, graceUntil: 0 })
  monitor.gameStarted(sessionId, child.pid ?? null)
  emit({ type: 'started', gameId: game.id, sessionId, game })
  child.once('exit', () => finish(game.id))
  child.once('error', () => finish(game.id))
}

/**
 * Sessão de um jogo lançado por protocolo: observamos processos que rodam a partir da
 * pasta de instalação. A loja pode levar até 90 s para abrir o jogo.
 */
export function trackByInstallDir(game: Game): void {
  if (tracked.has(game.id) || !game.installDir) return
  const sessionId = startSession(game.id, activeProfileId())
  const t: Tracked = { sessionId, game, graceUntil: Date.now() + 90_000 }
  tracked.set(game.id, t)
  monitor.gameStarted(sessionId, null)
  emit({ type: 'started', gameId: game.id, sessionId, game })
  let seenRunning = false
  const tick = async (): Promise<void> => {
    const pid = await mainProcessIn(game.installDir!)
    if (pid) {
      seenRunning = true
      monitor.gamePid(sessionId, pid)
    }
    if (!pid && (seenRunning || Date.now() > t.graceUntil)) {
      finish(game.id)
      return
    }
    t.timer = setTimeout(tick, seenRunning ? 10000 : 5000)
  }
  t.timer = setTimeout(tick, 6000)
}

/** PID do processo que mais usa memória dentro da pasta do jogo (o executável principal). */
async function mainProcessIn(dir: string): Promise<number | null> {
  const prefix = dir.replace(/[\\/]+$/, '').toLowerCase().replace(/'/g, "''")
  const res = await powershellJson<{ id: number } | null>(
    `$p = '${prefix}'; $x = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.ToLower().StartsWith($p) } | Sort-Object WorkingSet64 -Descending | Select-Object -First 1; if ($x) { ConvertTo-Json @{ id = $x.Id } -Compress } else { 'null' }`,
    10000
  )
  return res?.id ?? null
}

function finish(gameId: number): void {
  const t = tracked.get(gameId)
  if (!t) return
  if (t.timer) clearTimeout(t.timer)
  tracked.delete(gameId)
  monitor.gameEnded(t.sessionId)
  const r = endSession(t.sessionId)
  if (r) emit({ type: 'ended', gameId, sessionId: t.sessionId, game: t.game, durationSeconds: r.durationSeconds, startedAt: r.startedAt })
}

export function isTracked(gameId: number): boolean {
  return tracked.has(gameId)
}

export function anyRunning(): boolean {
  return tracked.size > 0
}

export function finishAll(): void {
  for (const id of [...tracked.keys()]) finish(id)
}
