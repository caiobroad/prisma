import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { Game } from '@shared/types'
import { IconFilter, IconHistory, IconSearch } from './Icons'
import { GameIcon } from './GameCover'
import { parseQuery, suggest, type Suggestion } from '../lib/search'
import { rememberSearch, updateSettings, useStore } from '../lib/store'

interface Props {
  query: string
  onQuery: (q: string) => void
  onOpenGame: (g: Game) => void
}

/**
 * Busca com histórico, sugestões e filtros inteligentes. Setas escolhem a sugestão,
 * Enter aplica, Esc limpa. Os filtros ativos viram chips removíveis na biblioteca.
 */
export const SearchBox = memo(function SearchBox({ query, onQuery, onOpenGame }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const games = useStore((s) => s.games)
  const history = useStore((s) => s.settings.searchHistory)
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState(-1)
  const [typed, setTyped] = useState(query)

  useEffect(() => setTyped(query), [query])

  // Sugestões calculadas com um pequeno atraso, para não competir com a digitação.
  const [list, setList] = useState<Suggestion[]>([])
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => setList(suggest(typed, games, history)), typed ? 60 : 0)
    return () => window.clearTimeout(t)
  }, [typed, games, history, open])
  useEffect(() => setSel(-1), [list])

  const chips = useMemo(() => parseQuery(query).filters, [query])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        ref.current?.focus()
        ref.current?.select()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const apply = (s: Suggestion): void => {
    if (s.kind === 'game' && s.game) {
      rememberSearch(s.game.title)
      setOpen(false)
      ref.current?.blur()
      onOpenGame(s.game)
      return
    }
    onQuery(s.value)
    setTyped(s.value)
    if (s.kind === 'history') {
      setOpen(false)
      ref.current?.blur()
    } else ref.current?.focus()
  }

  const commit = (): void => {
    if (query.trim()) rememberSearch(query)
  }

  return (
    <div className={`search-wrap ${open ? 'open' : ''}`}>
      <label className="search">
        <IconSearch width={15} height={15} />
        <input
          id="search"
          ref={ref}
          type="search"
          placeholder="Buscar jogos, gêneros, franquias…"
          autoComplete="off"
          spellCheck={false}
          value={typed}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120)
            commit()
          }}
          onChange={(e) => {
            setTyped(e.target.value)
            onQuery(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && list.length) {
              e.preventDefault()
              e.stopPropagation()
              setSel((n) => (n + 1) % list.length)
            } else if (e.key === 'ArrowUp' && list.length) {
              e.preventDefault()
              e.stopPropagation()
              setSel((n) => (n <= 0 ? list.length - 1 : n - 1))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              if (sel >= 0 && list[sel]) apply(list[sel])
              else {
                commit()
                setOpen(false)
              }
            } else if (e.key === 'Escape') {
              e.stopPropagation()
              if (typed) {
                onQuery('')
                setTyped('')
              } else ref.current?.blur()
            }
          }}
          aria-label="Buscar na biblioteca"
          aria-expanded={open}
          aria-controls="search-pop"
          role="combobox"
        />
        {chips.length ? <span className="search-count">{chips.length} filtro{chips.length > 1 ? 's' : ''}</span> : <kbd>Ctrl K</kbd>}
      </label>
      {open && list.length ? (
        <div className="search-pop glass frost" id="search-pop" role="listbox" onMouseDown={(e) => e.preventDefault()}>
          {!typed ? (
            <div className="sp-head">
              <span>Buscas recentes</span>
              <button className="link" onClick={() => void updateSettings({ searchHistory: [] })}>
                Limpar
              </button>
            </div>
          ) : null}
          {list.map((s, i) => (
            <button key={`${s.kind}-${s.label}`} role="option" aria-selected={i === sel} className={`sp-item ${i === sel ? 'on' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => apply(s)}>
              <span className="sp-ico">
                {s.kind === 'game' && s.game ? <GameIcon game={s.game} /> : s.kind === 'history' ? <IconHistory width={15} height={15} /> : <IconFilter width={14} height={14} />}
              </span>
              <span className="sp-label">{s.label}</span>
              {s.hint ? <em>{s.hint}</em> : null}
            </button>
          ))}
          <div className="sp-foot">
            <code>genero:rpg</code> <code>ano&gt;2018</code> <code>nota&gt;85</code> <code>instalado</code> <code>concluido</code> <code>roda</code>
          </div>
        </div>
      ) : null}
    </div>
  )
})
