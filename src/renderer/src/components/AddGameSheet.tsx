import { useEffect, useRef, useState } from 'react'
import { addManual, toast } from '../lib/store'
import { IconFolder } from '../components/Icons'

interface Props {
  onClose: () => void
  onAdded: () => void
}

function titleFromPath(p: string): string {
  const base = p.split(/[\\/]/).pop() ?? p
  return base
    .replace(/\.(exe|lnk|bat|cmd)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function AddGameSheet({ onClose, onAdded }: Props) {
  const [title, setTitle] = useState('')
  const [path, setPath] = useState('')
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pick = async (): Promise<void> => {
    const r = await window.nexus.games.pickExecutable()
    if (!r) return
    setPath(r.path)
    if (!title) setTitle(r.title)
    nameRef.current?.focus()
  }

  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    setOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const p = window.nexus.shell.pathForFile(file)
    if (!p) {
      toast('Não consegui ler o caminho do arquivo. Use "Procurar".', 'err')
      return
    }
    setPath(p)
    if (!title) setTitle(titleFromPath(p))
  }

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!path.trim()) {
      toast('Informe o caminho do executável', 'err')
      return
    }
    setBusy(true)
    try {
      await addManual(title.trim() || titleFromPath(path), path.trim())
      onAdded()
    } catch (err) {
      toast(`Não foi possível adicionar: ${(err as Error).message}`, 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="pane" onSubmit={(e) => void submit(e)}>
        <div className="vh">
          <h4>Adicionar jogo manual</h4>
          <small>.exe / atalho</small>
        </div>
        <div
          className={`drop ${over ? 'over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          onClick={() => void pick()}
        >
          <b>Arraste um executável aqui</b>
          <br />
          ou clique para procurar. O ícone e o nome são extraídos do arquivo.
        </div>
        <label className="field">
          Caminho
          <div className="with-btn">
            <input
              id="add-path"
              type="text"
              value={path}
              onChange={(e) => {
                setPath(e.target.value)
                if (!title && e.target.value) setTitle(titleFromPath(e.target.value))
              }}
              placeholder="D:\Games\MeuJogo\jogo.exe"
              spellCheck={false}
            />
            <button type="button" className="btn ghost icobtn" onClick={() => void pick()} aria-label="Procurar executável">
              <IconFolder width={16} height={16} />
            </button>
          </div>
        </label>
        <label className="field">
          Nome
          <input id="add-name" ref={nameRef} type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome na biblioteca" />
        </label>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={`btn ${busy ? 'busy' : ''}`} disabled={busy}>
            Adicionar
          </button>
        </div>
      </form>
    </div>
  )
}
