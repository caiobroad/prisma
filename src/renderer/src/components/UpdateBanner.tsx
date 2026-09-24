import { useState } from 'react'
import { IconDownload, IconRefresh } from './Icons'
import { toast, useStore } from '../lib/store'

/**
 * Aviso discreto no canto: a versão nova já foi baixada (instalar agora ou ao fechar), ou,
 * na versão portátil, que existe versão nova para baixar. "Depois" esconde até a próxima versão.
 */
export function UpdateBanner() {
  const u = useStore((s) => s.update)
  const gameActive = useStore((s) => s.gameActive)
  const [hidden, setHidden] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!u || gameActive || !u.version || hidden === u.version) return null
  if (u.state !== 'ready' && u.state !== 'portable') return null

  const install = async (): Promise<void> => {
    setBusy(true)
    const r = await window.nexus.update.install()
    toast(r.message, r.ok ? 'ok' : 'err')
    if (!r.ok) setBusy(false)
  }

  return (
    <div className="upd glass frost" role="status">
      <span className="upd-ico">{u.state === 'ready' ? <IconRefresh width={18} height={18} /> : <IconDownload width={18} height={18} />}</span>
      <div className="upd-txt">
        <b>Prisma {u.version} {u.state === 'ready' ? 'pronto para instalar' : 'disponível'}</b>
        <span>{u.state === 'ready' ? 'Reinicie agora ou ele instala sozinho quando você fechar o Prisma.' : 'A versão portátil não se atualiza sozinha: baixe a nova e substitua o arquivo.'}</span>
      </div>
      <div className="upd-act">
        <button className="btn ghost sm" onClick={() => setHidden(u.version)} disabled={busy}>
          Depois
        </button>
        {u.state === 'ready' ? (
          <button className="btn sm" onClick={() => void install()} disabled={busy}>
            {busy ? 'Reiniciando…' : 'Reiniciar agora'}
          </button>
        ) : (
          <button className="btn sm" onClick={() => window.nexus.update.openDownload()}>
            Baixar
          </button>
        )}
      </div>
    </div>
  )
}
