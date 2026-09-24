import { useEffect, useState } from 'react'
import { IconClose, IconDownload, IconRefresh, IconSparkles } from './Icons'
import { Markdown } from './Markdown'
import { setState, toast, useStore } from '../lib/store'

/**
 * Atualização nova: um popup com o que mudou (as notas da release no GitHub) e "Reiniciar agora".
 * "Depois" recolhe para um aviso pequeno no canto, que reabre o popup; se ninguém reiniciar,
 * a versão instala sozinha quando o Prisma fecha. Na versão portátil, o botão é "Baixar".
 */
export function UpdateBanner() {
  const u = useStore((s) => s.update)
  const gameActive = useStore((s) => s.gameActive)
  const [collapsed, setCollapsed] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notes, setNotes] = useState<string | null>(null)

  const version = u?.version ?? null
  const relevant = !!u && !!version && (u.state === 'ready' || u.state === 'portable')

  useEffect(() => {
    if (!relevant || !version) return
    if (u?.notes) return setNotes(u.notes)
    let alive = true
    void window.nexus.update.changelog(version).then((n) => alive && setNotes(n))
    return () => {
      alive = false
    }
  }, [relevant, version, u?.notes])

  if (!u || !relevant || gameActive || !version) return null

  const install = async (): Promise<void> => {
    setBusy(true)
    const r = await window.nexus.update.install()
    toast(r.message, r.ok ? 'ok' : 'err')
    if (!r.ok) setBusy(false)
  }
  const ready = u.state === 'ready'

  if (collapsed === version) {
    return (
      <button className="upd-pill glass frost" onClick={() => setCollapsed(null)} title="Ver a atualização">
        {ready ? <IconRefresh width={15} height={15} /> : <IconDownload width={15} height={15} />}
        Prisma {version} {ready ? 'pronto' : 'disponível'}
      </button>
    )
  }

  return (
    <Modal onClose={() => setCollapsed(version)} label={`Prisma ${version}`}>
      <div className="upd-head">
        <span className="upd-ico">{ready ? <IconRefresh width={20} height={20} /> : <IconDownload width={20} height={20} />}</span>
        <div>
          <p className="eyebrow">Atualização {ready ? 'pronta' : 'disponível'}</p>
          <h2>Prisma {version}</h2>
          <span className="muted small">Você está na {u.current}</span>
        </div>
      </div>
      <div className="upd-notes">{notes ? <Markdown text={notes} /> : <p className="muted">Correções e melhorias.</p>}</div>
      <p className="muted small">
        {ready ? 'Se preferir, ela instala sozinha quando você fechar o Prisma. Seus dados continuam iguais.' : 'A versão portátil não se atualiza sozinha: baixe a nova e substitua o arquivo.'}
      </p>
      <div className="upd-act">
        <button className="btn ghost" onClick={() => setCollapsed(version)} disabled={busy}>
          Depois
        </button>
        {ready ? (
          <button className="btn" onClick={() => void install()} disabled={busy}>
            {busy ? 'Reiniciando…' : 'Reiniciar agora'}
          </button>
        ) : (
          <button className="btn" onClick={() => window.nexus.update.openDownload()}>
            Baixar
          </button>
        )}
      </div>
    </Modal>
  )
}

/** "Novidades da versão": aparece na primeira abertura depois de atualizar (e em Ajustes → Ver novidades). */
export function WhatsNew() {
  const version = useStore((s) => s.whatsNew)
  const gameActive = useStore((s) => s.gameActive)
  const [notes, setNotes] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    if (!version) return
    setNotes(undefined)
    let alive = true
    void window.nexus.update
      .changelog(version)
      .catch(() => null)
      .then((n) => alive && setNotes(n))
    return () => {
      alive = false
    }
  }, [version])

  if (!version || gameActive) return null
  const close = (): void => setState({ whatsNew: null })
  return (
    <Modal onClose={close} label={`Novidades da versão ${version}`}>
      <div className="upd-head">
        <span className="upd-ico new">
          <IconSparkles width={20} height={20} />
        </span>
        <div>
          <p className="eyebrow">Novidades</p>
          <h2>Prisma {version}</h2>
        </div>
      </div>
      <div className="upd-notes">
        {notes === undefined ? <p className="muted">Carregando as notas da versão…</p> : notes ? <Markdown text={notes} /> : <p className="muted">Não foi possível carregar as notas desta versão agora.</p>}
      </div>
      <div className="upd-act">
        <button className="btn" onClick={close}>
          Entendi
        </button>
      </div>
    </Modal>
  )
}

function Modal({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', esc, true)
    return () => window.removeEventListener('keydown', esc, true)
  }, [onClose])
  return (
    <div className="upd-scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="upd-modal glass frost" role="dialog" aria-modal="true" aria-label={label} data-nav-layer>
        <button className="tb-icon upd-x" onClick={onClose} aria-label="Fechar">
          <IconClose width={15} height={15} />
        </button>
        {children}
      </div>
    </div>
  )
}
