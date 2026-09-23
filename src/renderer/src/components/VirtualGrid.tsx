import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useScroller } from './ScrollView'

interface Props<T> {
  items: T[]
  keyOf: (item: T) => string | number
  render: (item: T) => ReactNode
  /** Largura mínima de uma capa. */
  min?: number
  gapX?: number
  gapY?: number
  /** Altura fixa do texto sob a capa (nome em 2 linhas + plataforma). */
  textH?: number
  overscan?: number
  onLeave?: () => void
}

/**
 * Grade virtualizada de capas 2:3. Só as linhas visíveis (mais uma margem) existem no DOM,
 * então 1000+ jogos custam o mesmo que 30: menos nós, menos imagens decodificadas, menos memória.
 */
export function VirtualGrid<T>({ items, keyOf, render, min = 150, gapX = 20, gapY = 26, textH = 66, overscan = 2, onLeave }: Props<T>) {
  const scroller = useScroller()
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [range, setRange] = useState<[number, number]>([0, 6])

  const cols = Math.max(1, Math.floor((width + gapX) / (min + gapX)))
  const cardW = width > 0 ? (width - gapX * (cols - 1)) / cols : min
  const rowH = cardW * 1.5 + textH
  const rows = Math.ceil(items.length / cols)
  const total = rows > 0 ? rows * (rowH + gapY) - gapY : 0

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const sc = scroller?.current
    const el = ref.current
    if (!sc || !el) return
    let raf = 0
    const compute = (): void => {
      raf = 0
      const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top
      const step = rowH + gapY
      const first = Math.max(0, Math.floor(-top / step) - overscan)
      const last = Math.min(rows - 1, Math.ceil((sc.clientHeight - top) / step) + overscan)
      setRange((r) => (r[0] === first && r[1] === last ? r : [first, last]))
    }
    const onScroll = (): void => {
      if (!raf) raf = requestAnimationFrame(compute)
    }
    compute()
    sc.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(onScroll)
    ro.observe(sc)
    return () => {
      sc.removeEventListener('scroll', onScroll)
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [scroller, rowH, gapY, rows, overscan])

  const out: ReactNode[] = []
  for (let r = range[0]; r <= range[1] && r < rows; r++) {
    const slice = items.slice(r * cols, r * cols + cols)
    out.push(
      <div
        key={r}
        className="vrow"
        style={{
          transform: `translate3d(0, ${Math.round(r * (rowH + gapY))}px, 0)`,
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          columnGap: gapX,
          height: rowH
        }}
      >
        {slice.map((it) => (
          <div key={keyOf(it)} className="vcell">
            {render(it)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div ref={ref} className="vgrid" style={{ height: total }} onPointerLeave={onLeave}>
      {out}
    </div>
  )
}
