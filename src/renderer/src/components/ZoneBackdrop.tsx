import { memo, useEffect, useRef, useState } from 'react'
import type { ZoneTheme } from '../lib/zones'
import { ZoneParticles } from './ZoneParticles'

interface Layer {
  key: number
  canvas: HTMLCanvasElement
  leaving: boolean
}

interface Props {
  zone: ZoneTheme
  particles: boolean
  paused: boolean
  lowFps: boolean
  light: boolean
}

/**
 * Desfoque barato: o banner é desenhado numa miniatura de 64×36 e esticado pela GPU.
 * A interpolação da ampliação produz o mesmo efeito de um blur(56px) em tela cheia,
 * com uma textura de 9 KB em vez de dezenas de MB.
 */
function BlurLayer({ canvas, leaving }: { canvas: HTMLCanvasElement; leaving: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = host.current
    if (!el) return
    el.appendChild(canvas)
    return () => {
      canvas.remove()
    }
  }, [canvas])
  return <div ref={host} className={`zone-banner ${leaving ? 'out' : ''}`} />
}

function thumbnail(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 36
  const ctx = c.getContext('2d')
  if (ctx) {
    // Recorta ao centro no formato 16:9 antes de reduzir.
    const r = img.naturalWidth / img.naturalHeight
    let sw = img.naturalWidth
    let sh = img.naturalHeight
    if (r > 16 / 9) sw = sh * (16 / 9)
    else sh = sw / (16 / 9)
    ctx.filter = 'blur(1.5px) saturate(1.35)'
    ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, -2, -2, 68, 40)
  }
  return c
}

export const ZoneBackdrop = memo(function ZoneBackdrop({ zone, particles, paused, lowFps, light }: Props) {
  const [layers, setLayers] = useState<Layer[]>([])
  const seq = useRef(0)

  useEffect(() => {
    const url = zone.backdrop
    let cancelled = false
    const retire = (): void => setLayers((ls) => ls.map((l) => ({ ...l, leaving: true })))
    if (!url) {
      retire()
    } else {
      const img = new Image()
      img.decoding = 'async'
      img.crossOrigin = url.startsWith('http') ? 'anonymous' : null
      const done = (): void => {
        if (cancelled) return
        const canvas = thumbnail(img)
        // Libera a imagem grande; só a miniatura fica. Sem handlers: src vazio dispara "error".
        img.onload = null
        img.onerror = null
        img.removeAttribute('src')
        const key = ++seq.current
        setLayers((ls) => [...ls.map((l) => ({ ...l, leaving: true })), { key, canvas, leaving: false }])
      }
      img.onload = done
      img.onerror = () => {
        // Alguns CDNs recusam CORS: tenta de novo sem, a miniatura só é exibida (não lida).
        if (img.crossOrigin && !cancelled) {
          img.crossOrigin = null
          img.src = url
        } else if (!cancelled) retire()
      }
      img.src = url
    }
    return () => {
      cancelled = true
    }
  }, [zone.backdrop])

  useEffect(() => {
    if (!layers.some((l) => l.leaving)) return
    const t = window.setTimeout(() => setLayers((ls) => ls.filter((l) => !l.leaving)), 1400)
    return () => window.clearTimeout(t)
  }, [layers])

  return (
    <div className="zone" aria-hidden="true">
      <div className="zone-blobs">
        <i />
        <i />
        <i />
      </div>
      {layers.map((l) => (
        <BlurLayer key={l.key} canvas={l.canvas} leaving={l.leaving} />
      ))}
      {/* Tudo que é estático fica ABAIXO do canvas: vira uma só camada pintada uma vez.
          A cada quadro de partícula, o compositor só recompõe o canvas. */}
      <div className="zone-light" />
      {zone.fog > 0.05 ? <div className="zone-fog" /> : null}
      <div className="zone-vignette" />
      {zone.grain > 0.08 ? <div className="zone-grain" /> : null}
      <ZoneParticles
        kind={zone.particles}
        density={zone.density}
        accent={zone.accent}
        accent2={zone.accent2}
        enabled={particles}
        paused={paused}
        lowFps={lowFps}
        light={light}
      />
    </div>
  )
})
