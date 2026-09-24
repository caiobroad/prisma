import { app, desktopCapturer, screen } from 'electron'
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Game } from '@shared/types'
import { setSessionScreenshot } from './db/games'
import { findSteamPath } from './scanners/steam'
import { localAsset } from './scanners/types'
import { loadSettings } from './settings'

/**
 * Smart Resume: guarda a "última imagem" de cada sessão.
 * Uma captura da tela aos 45 s e depois a cada 3 min (a anterior é sobrescrita: um arquivo
 * por sessão). No fim, se a Steam tiver screenshots (F12) desta sessão, a mais recente vence.
 */
const dir = (): string => join(app.getPath('userData'), 'resume')
const active = new Map<number, NodeJS.Timeout>()

async function capture(sessionId: number): Promise<void> {
  try {
    const d = screen.getPrimaryDisplay()
    const w = 960
    const h = Math.round((w * d.size.height) / d.size.width)
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: w, height: h } })
    const src = sources.find((s) => s.display_id === String(d.id)) ?? sources[0]
    if (!src || src.thumbnail.isEmpty()) return
    mkdirSync(dir(), { recursive: true })
    const file = join(dir(), `${sessionId}.jpg`)
    writeFileSync(file, src.thumbnail.toJPEG(78))
    setSessionScreenshot(sessionId, localAsset(file) + `?v=${Date.now()}`)
  } catch {
    /* captura indisponível (sessão bloqueada, UAC) */
  }
}

export function resumeStarted(sessionId: number): void {
  if (!loadSettings().resumeCapture) return
  const tick = (delay: number): void => {
    const t = setTimeout(async () => {
      if (!active.has(sessionId)) return
      await capture(sessionId)
      if (active.has(sessionId)) tick(3 * 60_000)
    }, delay)
    t.unref?.()
    active.set(sessionId, t)
  }
  tick(45_000)
}

export async function resumeEnded(sessionId: number, game: Game, startedAt: number): Promise<void> {
  const t = active.get(sessionId)
  if (t) clearTimeout(t)
  active.delete(sessionId)
  if (game.platform !== 'steam') return
  const shot = await steamScreenshotSince(game.platformId, startedAt)
  if (shot) setSessionScreenshot(sessionId, localAsset(shot))
}

/** Screenshot mais recente tirada pela Steam para o app desde o início da sessão. */
async function steamScreenshotSince(appid: string, since: number): Promise<string | null> {
  const sp = await findSteamPath()
  if (!sp) return null
  let best: { path: string; t: number } | null = null
  let users: string[] = []
  try {
    users = readdirSync(join(sp, 'userdata'))
  } catch {
    return null
  }
  for (const u of users) {
    const d = join(sp, 'userdata', u, '760', 'remote', appid, 'screenshots')
    if (!existsSync(d)) continue
    try {
      for (const f of readdirSync(d)) {
        if (!/\.(jpg|png)$/i.test(f)) continue
        const p = join(d, f)
        const t = statSync(p).mtimeMs
        if (t >= since && (!best || t > best.t)) best = { path: p, t }
      }
    } catch {
      /* pasta inacessível */
    }
  }
  return best?.path ?? null
}

/** Mantém só as capturas das 200 sessões mais recentes. */
export function pruneResume(): void {
  try {
    const files = readdirSync(dir())
      .filter((f) => f.endsWith('.jpg'))
      .map((f) => ({ f, n: Number(f.replace('.jpg', '')) }))
      .sort((a, b) => b.n - a.n)
    for (const x of files.slice(200)) unlinkSync(join(dir(), x.f))
  } catch {
    /* pasta ainda não existe */
  }
}
