import { useEffect, useState } from 'react'
import { PrismaMark } from '../components/TitleBar'

/** Créditos: quem fez o Prisma. */
export function CreditsView() {
  const [ver, setVer] = useState<{ app: string; electron: string; node: string } | null>(null)
  useEffect(() => {
    void window.nexus.version().then(setVer)
  }, [])
  return (
    <div className="credits">
      <div className="credits-beam" aria-hidden="true" />
      <div className="credits-inner">
        <div className="credits-mark">
          <PrismaMark />
        </div>
        <p className="eyebrow">Créditos</p>
        <h1 className="credits-title">Prisma</h1>
        <p className="credits-sub">Um launcher para toda a sua biblioteca, feito com cuidado.</p>
        <div className="credits-by">
          <span>criado por</span>
          <div className="credits-names">
            <b>Caio Broad</b>
            <i>&amp;</i>
            <b>Agenor Antonio</b>
          </div>
        </div>
        <div className="credits-foot">
          <span>Versão {ver?.app ?? '…'}</span>
          <span>Electron {ver?.electron ?? '…'}</span>
          <span>React · TypeScript · SQLite</span>
        </div>
        <p className="credits-legal muted small">
          Steam, Epic Games, GOG e Xbox são marcas de seus respectivos donos. Capas, trailers e dados da loja pertencem aos seus autores.
        </p>
      </div>
    </div>
  )
}
