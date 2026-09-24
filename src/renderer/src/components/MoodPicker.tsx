import { memo, useEffect, useRef, useState } from 'react'
import type { MoodId } from '@shared/types'
import { IconCheck, IconPalette } from './Icons'
import { MOODS, moodZone } from '../lib/zones'
import { updateSettings, useStore } from '../lib/store'

/** Mood da Biblioteca: troca a atmosfera base (cores, luz, partículas e vidro). Sempre escuro. */
export const MoodPicker = memo(function MoodPicker({ inline }: { inline?: boolean }) {
  const mood = useStore((s) => s.settings.mood)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const off = (e: PointerEvent): void => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', off)
    window.addEventListener('keydown', esc, true)
    return () => {
      window.removeEventListener('pointerdown', off)
      window.removeEventListener('keydown', esc, true)
    }
  }, [open])

  const grid = (
    <div className="mood-grid">
      {MOODS.map((m) => {
        const z = moodZone(m.id as MoodId)
        return (
          <button
            key={m.id}
            className={`mood ${mood === m.id ? 'on' : ''}`}
            style={{ '--m1': z.accent, '--m2': z.accent2, '--mb1': z.bg[0], '--mb2': z.bg[2] } as React.CSSProperties}
            onClick={() => void updateSettings({ mood: m.id })}
            aria-pressed={mood === m.id}
          >
            <span className="mood-sw" />
            <span className="mood-txt">
              <b>{m.name}</b>
              <small>{m.hint}</small>
            </span>
            {mood === m.id ? <IconCheck width={15} height={15} /> : null}
          </button>
        )
      })}
    </div>
  )

  if (inline) return grid
  return (
    <div className="mood-pick" ref={box}>
      <button className={`tb-icon ${open ? 'on' : ''}`} onClick={() => setOpen((v) => !v)} aria-label="Mood da Biblioteca" title="Mood da Biblioteca" aria-expanded={open}>
        <IconPalette width={17} height={17} />
      </button>
      {open ? (
        <div className="mood-pop glass frost" data-nav-layer>
          <div className="mood-pop-head">
            <b>Mood da Biblioteca</b>
            <span>A atmosfera do launcher quando nenhum jogo define a zona</span>
          </div>
          {grid}
        </div>
      ) : null}
    </div>
  )
})
