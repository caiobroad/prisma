import { createContext, useContext, useRef, type ReactNode, type RefObject } from 'react'

const ScrollCtx = createContext<RefObject<HTMLDivElement | null> | null>(null)

/** Área rolável de uma tela. Listas virtualizadas dentro dela usam esta rolagem. */
export function ScrollView({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <ScrollCtx.Provider value={ref}>
      <div ref={ref} className={`view ${className}`}>
        {children}
      </div>
    </ScrollCtx.Provider>
  )
}

export function useScroller(): RefObject<HTMLDivElement | null> | null {
  return useContext(ScrollCtx)
}
