import { useCallback, useEffect, useRef, useState } from 'react'
import { PrismaMark } from './TitleBar'
import { enterChime, startupChime } from '../lib/sounds'

/**
 * Introdução de abertura, no clima dos consoles: o feixe de luz atravessa o prisma, o espectro
 * se abre, a marca surge com o som de abertura e aparece "clique em qualquer lugar". Clique,
 * tecla ou botão do controle: a tela se desfaz e abre a escolha de perfil.
 */
export function StartIntro({ onDone }: { onDone: () => void }) {
  const [ready, setReady] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const done = useRef(false)

  useEffect(() => {
    startupChime()
    const t = window.setTimeout(() => setReady(true), 2600)
    return () => window.clearTimeout(t)
  }, [])

  const go = useCallback(() => {
    if (done.current) return
    done.current = true
    enterChime()
    setLeaving(true)
    window.setTimeout(onDone, 720)
  }, [onDone])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'F11' || e.key === 'F12') return
      e.preventDefault()
      go()
    }
    window.addEventListener('keydown', onKey)
    // Um botão do controle apertado agora também entra (A, B, X, Y ou Start). Só vale o aperto
    // novo: alguns controles relatam gatilhos ou botões "pressionados" em repouso.
    const held = new Set<string>()
    const scanPads = (fire: boolean): void => {
      for (const p of navigator.getGamepads()) {
        if (!p) continue
        for (const i of [0, 1, 2, 3, 9]) {
          const k = `${p.index}:${i}`
          const down = !!p.buttons[i]?.pressed
          if (down && !held.has(k) && fire) go()
          if (down) held.add(k)
          else held.delete(k)
        }
      }
    }
    scanPads(false)
    const iv = window.setInterval(() => scanPads(true), 120)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearInterval(iv)
    }
  }, [go])

  return (
    <div className={`intro ${ready ? 'ready' : ''} ${leaving ? 'leaving' : ''}`} onPointerDown={go} role="button" tabIndex={-1} aria-label="Clique para começar">
      <div className="intro-waves" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="intro-beam" aria-hidden="true" />
      <div className="intro-spectrum" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="intro-center">
        <div className="intro-mark">
          <PrismaMark />
        </div>
        <h1 className="intro-word">PRISMA</h1>
        <p className="intro-sub">Todos os seus jogos. Um só lugar.</p>
      </div>
      <p className="intro-cta">
        <span>Clique em qualquer lugar para começar</span>
        <small>ou pressione qualquer tecla · qualquer botão do controle</small>
      </p>
      <p className="intro-by">
        criado por <b>Caio Broad</b> &amp; <b>Agenor Antonio</b>
      </p>
    </div>
  )
}
