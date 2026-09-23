import { useEffect, useState } from 'react'
import type { Settings, ThemeMode } from '@shared/types'
import { IconRefresh } from '../components/Icons'
import { ScrollView } from '../components/ScrollView'
import { PF, relativeTime } from '../lib/format'
import { ZONE_PRESETS } from '../lib/zones'
import { scan, updateSettings, useStore } from '../lib/store'

type BoolKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings]

const GENERAL: Array<{ key: BoolKey; title: string; desc: string }> = [
  { key: 'launchOnStartup', title: 'Iniciar com o Windows', desc: 'Abre minimizado na bandeja (só no app instalado)' },
  { key: 'syncOnOpen', title: 'Sincronizar ao abrir', desc: 'Varre as lojas em segundo plano, e de novo a cada 30 min' },
  { key: 'minimizeToTray', title: 'Fechar para a bandeja', desc: 'O X esconde a janela; depois de 3 min escondida, a interface é descarregada da memória' },
  { key: 'glassEffect', title: 'Efeito de vidro', desc: 'Desative em GPUs integradas se a interface engasgar' }
]

const EXPERIENCE: Array<{ key: BoolKey; title: string; desc: string }> = [
  { key: 'trailersOnHover', title: 'Trailers na biblioteca', desc: 'Após ~1 s com o cursor parado sobre uma capa, toca o trailer sem som' },
  { key: 'cinematicLaunch', title: 'Lançamento cinematográfico', desc: 'A interface sai de cena antes do jogo abrir e volta com transição' },
  { key: 'perfCenterOnLaunch', title: 'Performance Center antes de jogar', desc: 'Mostra CPU, GPU, temperaturas e o Modo Performance ao clicar em Jogar' },
  { key: 'idleShowcase', title: 'Vitrine ociosa', desc: 'Sem interação, o launcher passeia pela biblioteca com banners e trailers' }
]

const ZONE: Array<{ key: BoolKey; title: string; desc: string }> = [
  { key: 'zoneMode', title: 'Modo Zona', desc: 'Cada jogo muda cor, vidro, fundo e partículas ao ser aberto' },
  { key: 'zoneParticles', title: 'Partículas', desc: 'Cinzas, brasas, névoa, cubos, bolhas e neon conforme o jogo' },
  { key: 'zoneHoverPreview', title: 'Prévia ao passar o mouse', desc: 'A atmosfera muda ao repousar o cursor sobre uma capa' }
]

function Toggle({ k }: { k: BoolKey }) {
  const on = useStore((s) => s.settings[k])
  return <button id={`tg-${k}`} className="tg" role="switch" aria-checked={on} aria-label={k} onClick={() => void updateSettings({ [k]: !on })} />
}

function Rows({ items }: { items: Array<{ key: BoolKey; title: string; desc: string }> }) {
  return (
    <>
      {items.map((t) => (
        <div className="it" key={t.key}>
          <div>
            <b>{t.title}</b>
            <span>{t.desc}</span>
          </div>
          <Toggle k={t.key} />
        </div>
      ))}
    </>
  )
}

export function SettingsView() {
  const settings = useStore((s) => s.settings)
  const sources = useStore((s) => s.sources)
  const scanning = useStore((s) => s.scanning)
  const [ver, setVer] = useState<{ app: string; electron: string; node: string } | null>(null)
  useEffect(() => {
    void window.nexus.version().then(setVer)
  }, [])

  return (
    <ScrollView>
      <header className="view-head">
        <div className="view-title">
          <h1>Ajustes</h1>
          <p>{ver ? `Prisma ${ver.app} · Electron ${ver.electron}` : ''}</p>
        </div>
      </header>

      <div className="settings-grid">
        <section className="glass card">
          <h2 className="card-title">Aparência</h2>
          <div className="set">
            <div className="it">
              <div>
                <b>Tema</b>
                <span>Vidro, sombras, transparências e acentos mudam juntos</span>
              </div>
              <div className="segmented">
                {(
                  [
                    ['dark', 'Escuro'],
                    ['light', 'Claro'],
                    ['system', 'Sistema']
                  ] as Array<[ThemeMode, string]>
                ).map(([id, label]) => (
                  <button key={id} className={settings.theme === id ? 'on' : ''} onClick={() => void updateSettings({ theme: id })}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <Rows items={ZONE} />
          </div>
          <div className="zone-list">
            <span className="muted small">Zonas com identidade própria. Os demais jogos ganham um tema tirado das cores do banner.</span>
            <div className="zone-swatches">
              {ZONE_PRESETS.map((z) => (
                <span key={z.id} className="zone-swatch" style={{ '--a': z.accent, '--b': z.accent2 } as React.CSSProperties}>
                  <i />
                  {z.name}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="glass card">
          <h2 className="card-title">Experiência</h2>
          <div className="set">
            <Rows items={EXPERIENCE} />
            <div className="it">
              <div>
                <b>Entrar na vitrine após</b>
                <span>Qualquer movimento do mouse ou do controle cancela na hora</span>
              </div>
              <select
                id="idle-seconds"
                className="select-inline"
                value={settings.idleSeconds}
                onChange={(e) => void updateSettings({ idleSeconds: Number(e.target.value) })}
                disabled={!settings.idleShowcase}
              >
                {[15, 30, 45, 60, 120, 300].map((s) => (
                  <option key={s} value={s}>
                    {s < 60 ? `${s} s` : `${s / 60} min`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="glass card">
          <h2 className="card-title">Geral</h2>
          <div className="set">
            <Rows items={GENERAL} />
            <div className="it">
              <div>
                <b>Atalho global</b>
                <span>Traz o Prisma para a frente de qualquer tela</span>
              </div>
              <ShortcutField value={settings.globalShortcut} onChange={(v) => void updateSettings({ globalShortcut: v })} />
            </div>
          </div>
        </section>

        <section className="glass card">
          <div className="card-title row between">
            <h2>Fontes da biblioteca</h2>
            <button className="btn ghost sm" onClick={() => void scan()} disabled={scanning}>
              <IconRefresh width={13} height={13} />
              {scanning ? 'Sincronizando…' : 'Sincronizar'}
            </button>
          </div>
          <div className="set">
            {sources.map((s) => (
              <div className="src" key={s.platform} style={{ '--c': PF[s.platform].color } as React.CSSProperties}>
                <span className="dot">{PF[s.platform].letter}</span>
                <div className="src-main">
                  <b>{PF[s.platform].name}</b>
                  <span>
                    {s.count} {s.count === 1 ? 'jogo' : 'jogos'} · {s.detail}
                  </span>
                </div>
                <span className={`st ${s.ok ? (s.lastScan || s.platform === 'manual' ? '' : 'e') : 'w'}`}>
                  {s.platform === 'manual' ? 'ok' : !s.ok ? 'não encontrada' : s.lastScan ? relativeTime(s.lastScan) : 'pendente'}
                </span>
              </div>
            ))}
          </div>
          <p className="muted small small-note">
            Steam, Epic Games e GOG mostram também os jogos da conta que não estão instalados. O Xbox só expõe os instalados nesta máquina.
          </p>
        </section>

        <section className="glass card">
          <h2 className="card-title">Atalhos</h2>
          <div className="shortcuts">
            {[
              ['Ctrl K', 'Buscar'],
              ['F11', 'Tela cheia'],
              ['F5', 'Sincronizar'],
              ['Esc', 'Voltar'],
              ['Enter', 'Abrir jogo'],
              ['Duplo clique', 'Jogar'],
              ['Start / Options', 'Modo Controle']
            ].map(([k, v]) => (
              <span key={k}>
                <kbd>{k}</kbd>
                {v}
              </span>
            ))}
          </div>
          <dl className="facts pad-x">
            <div>
              <dt>Dados</dt>
              <dd className="mono">%AppData%\Prisma\prisma.db</dd>
            </div>
            <div>
              <dt>Telemetria</dt>
              <dd>Nenhuma. Tudo fica nesta máquina.</dd>
            </div>
          </dl>
        </section>
      </div>
    </ScrollView>
  )
}

function ShortcutField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [recording, setRecording] = useState(false)
  return (
    <button
      id="shortcut"
      className="btn ghost sm mono"
      style={{ minWidth: 150 }}
      onClick={() => setRecording(true)}
      onBlur={() => setRecording(false)}
      onKeyDown={(e) => {
        if (!recording) return
        e.preventDefault()
        e.stopPropagation()
        if (e.key === 'Escape') return setRecording(false)
        if (e.key === 'Backspace' || e.key === 'Delete') {
          onChange('')
          return setRecording(false)
        }
        const mods = [e.ctrlKey && 'Control', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super'].filter(Boolean) as string[]
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key) || !mods.length) return
        onChange([...mods, e.key.length === 1 ? e.key.toUpperCase() : e.key].join('+'))
        setRecording(false)
      }}
    >
      {recording ? 'Pressione…' : value || 'nenhum'}
    </button>
  )
}
