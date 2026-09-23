import type Hls from 'hls.js'
import { getState } from './store'

/**
 * Trailers sob demanda. Um único trailer toca por vez; o hls.js só é baixado
 * (import dinâmico) na primeira vez que um trailer realmente vai tocar.
 */
const urlCache = new Map<number, string | null>()
let HlsCtor: typeof Hls | null = null
let active: { video: HTMLVideoElement; hls: Hls | null } | null = null

export function trailersAllowed(): boolean {
  const s = getState()
  return s.settings.trailersOnHover && !s.gameActive && !s.background && !(s.settings.performanceMode && s.running.size > 0)
}

export async function trailerUrl(gameId: number): Promise<string | null> {
  if (urlCache.has(gameId)) return urlCache.get(gameId) ?? null
  const g = getState().byId.get(gameId)
  if (g && g.trailerUrl != null) {
    urlCache.set(gameId, g.trailerUrl || null)
    return g.trailerUrl || null
  }
  const real = gameId >= 1_000_000 ? null : await window.nexus.games.trailer(gameId).catch(() => null)
  urlCache.set(gameId, real)
  return real
}

export async function attachTrailer(video: HTMLVideoElement, url: string): Promise<void> {
  releaseTrailer()
  active = { video, hls: null }
  // Build "light" já minificado (~370 KB, sem legendas nem faixas de áudio alternativas): basta para prévias mudas.
  if (!HlsCtor) HlsCtor = ((await import('hls.js/dist/hls.light.min.mjs')) as unknown as { default: typeof Hls }).default
  if (active?.video !== video) return // já foi liberado enquanto carregava
  if (!HlsCtor.isSupported()) return
  const hls = new HlsCtor({
    enableWorker: false,
    capLevelToPlayerSize: true,
    startLevel: 0,
    maxBufferLength: 8,
    maxMaxBufferLength: 12,
    backBufferLength: 0
  })
  active.hls = hls
  hls.loadSource(url)
  hls.attachMedia(video)
  hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
    video.play().catch(() => undefined)
  })
}

/** Para o trailer e libera buffers, decodificador e conexões. */
export function releaseTrailer(video?: HTMLVideoElement): void {
  if (!active || (video && active.video !== video)) return
  const { video: v, hls } = active
  active = null
  try {
    hls?.destroy()
  } catch {
    /* já destruído */
  }
  v.pause()
  v.removeAttribute('src')
  v.load()
  scheduleRelease()
}

let releaseTimer: number | null = null
/** Depois de uma rajada de trailers, devolve a memória de imagens/quadros ao sistema. */
export function scheduleRelease(delay = 2500): void {
  if (releaseTimer) window.clearTimeout(releaseTimer)
  releaseTimer = window.setTimeout(() => {
    releaseTimer = null
    if (!active) window.nexus.releaseMemory()
  }, delay)
}
