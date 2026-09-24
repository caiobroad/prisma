import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { IconBack } from './Icons'

/**
 * Prateleira horizontal sem barra de rolagem: setas nas laterais aparecem só quando há
 * mais capas daquele lado e rolam uma "página" com animação. Shift + roda do mouse e o foco pelo
 * teclado continuam rolando normalmente.
 */
export function ShelfRow({ children, className = '', onLeave }: { children: ReactNode; className?: string; onLeave?: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState({ left: false, right: false })

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const left = el.scrollLeft > 4
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    setEdge((e) => (e.left === left && e.right === right ? e : { left, right }))
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const on = (): void => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0
          measure()
        })
    }
    measure()
    el.addEventListener('scroll', on, { passive: true })
    const ro = new ResizeObserver(on)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', on)
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [measure])

  // A lista mudou (sem mudar o tamanho da prateleira): reavalia as setas.
  useEffect(() => measure())

  const page = (dir: 1 | -1): void => {
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  return (
    <div className="shelf-wrap">
      <div ref={ref} className={`shelf-row ${className}`} onPointerLeave={onLeave}>
        {children}
      </div>
      {edge.left ? (
        <button className="shelf-arrow left" onClick={() => page(-1)} aria-label="Anteriores" tabIndex={-1}>
          <IconBack width={20} height={20} />
        </button>
      ) : null}
      {edge.right ? (
        <button className="shelf-arrow right" onClick={() => page(1)} aria-label="Próximos" tabIndex={-1}>
          <IconBack width={20} height={20} />
        </button>
      ) : null}
    </div>
  )
}
