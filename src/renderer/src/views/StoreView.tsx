import { memo, useEffect, useMemo, useState } from 'react'
import type { StoreData, StoreItem } from '@shared/types'
import { IconExternal, IconRefresh, IconSearch } from '../components/Icons'
import { ScrollView } from '../components/ScrollView'
import { ShelfRow } from '../components/ShelfRow'
import { artStyle } from '../lib/covers'
import { toast } from '../lib/store'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const money = (cents: number): string => BRL.format(cents / 100)
const shortDate = (ts: number): string => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
const monthYear = (ts: number): string => new Date(ts).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')

type Shop = 'all' | 'steam' | 'epic'

/**
 * Loja: vitrines da Steam e da Epic com preço em reais. Com a chave do IsThereAnyDeal,
 * cada jogo mostra o menor preço que já teve (e avisa quando o preço atual é o menor).
 * Clicar abre a página do jogo na loja: a compra acontece lá.
 */
export function StoreView({ onSettings }: { onSettings: () => void }) {
  const [data, setData] = useState<StoreData | null>(null)
  const [busy, setBusy] = useState(false)
  const [shop, setShop] = useState<Shop>('all')
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<StoreItem[] | null>(null)
  const [searching, setSearching] = useState(false)

  const load = async (force = false): Promise<void> => {
    setBusy(true)
    try {
      setData(await window.nexus.store.load(force))
    } catch {
      toast('Não foi possível carregar a loja', 'err')
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])

  // Busca com um pequeno atraso para não consultar a cada tecla.
  useEffect(() => {
    const t = term.trim()
    if (t.length < 2) {
      setResults(null)
      return
    }
    let alive = true
    const h = window.setTimeout(() => {
      setSearching(true)
      void window.nexus.store
        .search(t)
        .then((r) => alive && setResults(r))
        .finally(() => alive && setSearching(false))
    }, 450)
    return () => {
      alive = false
      window.clearTimeout(h)
    }
  }, [term])

  const sections = useMemo(() => (data?.sections ?? []).filter((s) => shop === 'all' || s.id.startsWith(shop)), [data, shop])

  return (
    <ScrollView>
      <header className="view-head">
        <div className="view-title">
          <h1>Loja</h1>
          <p>Ofertas da Steam e da Epic em reais{data?.itad === 'ok' ? ', com o menor preço que cada jogo já teve' : ''}.</p>
        </div>
        <div className="toolbar">
          <label className="search store-search">
            <IconSearch width={15} height={15} />
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar na Steam" spellCheck={false} aria-label="Buscar na loja" />
          </label>
          <div className="segmented" role="tablist" aria-label="Loja">
            {(
              [
                ['all', 'Todas'],
                ['steam', 'Steam'],
                ['epic', 'Epic Games']
              ] as Array<[Shop, string]>
            ).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={shop === id} className={shop === id ? 'on' : ''} onClick={() => setShop(id)}>
                {label}
              </button>
            ))}
          </div>
          <button className={`btn ghost icobtn ${busy ? 'spin' : ''}`} onClick={() => void load(true)} disabled={busy} aria-label="Atualizar" title="Atualizar preços">
            <IconRefresh width={16} height={16} />
          </button>
        </div>
      </header>

      {data?.message ? (
        <div className="notice glass">
          <span>{data.message}</span>
          {data.itad !== 'ok' ? (
            <button className="btn ghost sm" onClick={onSettings}>
              Configurar
            </button>
          ) : null}
        </div>
      ) : null}

      {results ? (
        <section className="block">
          <div className="section-head">
            <h2>Resultados para “{term.trim()}”</h2>
            <span className="muted small">{searching ? 'buscando…' : `${results.length} na Steam`}</span>
          </div>
          <div className="store-grid">
            {results.map((i) => (
              <StoreCard key={i.key} item={i} />
            ))}
          </div>
        </section>
      ) : !data ? (
        <div className="store-skel">
          {[0, 1].map((k) => (
            <div key={k} className="block">
              <i className="skel-line" style={{ width: 240, height: 20, marginBottom: 16 }} />
              <div className="row">
                {[0, 1, 2, 3].map((j) => (
                  <i key={j} className="skel-line" style={{ width: 300, height: 200 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        sections.map((s) => (
          <section key={s.id} className="block">
            <div className="section-head">
              <h2 className="with-ico">
                <span className={`shop-dot ${s.id.startsWith('epic') ? 'epic' : 'steam'}`} />
                {s.title}
              </h2>
              <span className="muted small">{s.items.length} jogos</span>
            </div>
            <ShelfRow className="store-row">
              {s.items.map((i) => (
                <StoreCard key={i.key} item={i} />
              ))}
            </ShelfRow>
          </section>
        ))
      )}
    </ScrollView>
  )
}

const StoreCard = memo(function StoreCard({ item }: { item: StoreItem }) {
  const [broken, setBroken] = useState(false)
  // A CDN às vezes recusa algumas imagens numa rajada: tenta de novo uma vez antes de desistir.
  const [retry, setRetry] = useState(0)
  const src = item.image && retry ? `${item.image}${item.image.includes('?') ? '&' : '?'}r=${retry}` : item.image
  const onError = (): void => {
    if (retry < 2) window.setTimeout(() => setRetry((n) => n + 1), 1200 * (retry + 1))
    else setBroken(true)
  }
  const lowest = item.low && item.price != null && item.price > 0 && item.price <= item.low.price
  return (
    <button className="store-card glass" onClick={() => window.nexus.shell.openExternal(item.url)} title={`Abrir ${item.title} na ${item.shop === 'epic' ? 'Epic Games Store' : 'Steam'}`}>
      <div className="store-img" style={broken || !item.image ? artStyle(item.title) : undefined}>
        {src && !broken ? <img key={retry} src={src} alt="" loading="lazy" onError={onError} /> : <span>{item.title}</span>}
        {item.owned ? <em className="store-owned">Na sua biblioteca</em> : null}
        {lowest ? <em className="store-lowest">Menor preço de todos</em> : null}
      </div>
      <div className="store-body">
        <b className="store-title">{item.title}</b>
        <div className="store-price">
          {item.cut > 0 && item.price !== 0 ? <span className="store-cut">-{item.cut}%</span> : null}
          <span className="store-now">{item.price == null ? 'Em breve' : item.price === 0 ? 'Grátis' : money(item.price)}</span>
          {item.cut > 0 && item.regular ? <s>{money(item.regular)}</s> : null}
        </div>
        <div className="store-meta">
          {item.low ? (
            <span>
              Menor: <b>{item.low.price === 0 ? 'Grátis' : money(item.low.price)}</b>
              {item.low.when ? ` · ${monthYear(item.low.when)}` : ''}
              {item.low.shop ? ` · ${item.low.shop}` : ''}
            </span>
          ) : (
            <span>{item.until ? `${item.upcoming ? 'Grátis a partir de' : item.price === 0 ? 'Grátis até' : 'Até'} ${shortDate(item.until)}` : item.shop === 'epic' ? 'Epic Games Store' : 'Steam'}</span>
          )}
          <IconExternal width={13} height={13} />
        </div>
      </div>
    </button>
  )
})
