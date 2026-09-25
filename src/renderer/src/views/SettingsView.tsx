import { useEffect, useState } from 'react'
import { EMU_SYSTEMS, type ControllerSettings, type EmuInfo, type EmuSystemId, type Settings } from '@shared/types'
import { IconFolder, IconHeart, IconRefresh, IconSearch, IconSparkles } from '../components/Icons'
import { Avatar } from '../components/Avatar'
import { useSteamAccounts } from '../components/SteamAccountPicker'
import { MoodPicker } from '../components/MoodPicker'
import { ScrollView } from '../components/ScrollView'
import { PF, relativeTime } from '../lib/format'
import { ZONE_PRESETS } from '../lib/zones'
import { refreshProfiles, saveProfile, setState, switchProfile, toast, updateSettings, useStore } from '../lib/store'
import { invalidateSocial } from '../lib/social'
import { sfx, startupChime } from '../lib/sounds'
import { introEnabled, setIntroEnabled } from '../lib/intro'

type BoolKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings]

const GENERAL: Array<{ key: BoolKey; title: string; desc: string }> = [
  { key: 'launchOnStartup', title: 'Iniciar com o Windows', desc: 'Abre minimizado na bandeja (só no app instalado)' },
  { key: 'syncOnOpen', title: 'Sincronização automática', desc: 'Ao abrir, a cada 30 min e sempre que você instala, atualiza ou desinstala um jogo na Steam ou na Epic' },
  { key: 'minimizeToTray', title: 'Fechar para a bandeja', desc: 'O X esconde a janela; depois de 3 min escondida, a interface é descarregada da memória' },
  { key: 'glassEffect', title: 'Efeito de vidro', desc: 'Desative em GPUs integradas se a interface engasgar' }
]

const EXPERIENCE: Array<{ key: BoolKey; title: string; desc: string }> = [
  { key: 'trailersOnHover', title: 'Trailers', desc: 'Tocam sem som no banner da página do jogo e sobre a capa com o cursor parado 0,8 s' },
  { key: 'cinematicLaunch', title: 'Lançamento cinematográfico', desc: 'A interface sai de cena antes do jogo abrir e volta com transição' },
  { key: 'perfCenterOnLaunch', title: 'Performance Center antes de jogar', desc: 'Mostra CPU, GPU, temperaturas e o Modo Performance ao clicar em Jogar' },
  { key: 'idleShowcase', title: 'Vitrine ociosa', desc: 'Sem interação, o launcher passeia pela biblioteca com banners e trailers' }
]

const ACHIEVEMENTS: Array<{ key: BoolKey; title: string; desc: string }> = [
  { key: 'achievementPopup', title: 'Notificação de conquista', desc: 'Ícone e nome da conquista no canto da tela, durante o jogo (Steam)' },
  { key: 'achievementSound', title: 'Som da notificação', desc: 'Um acorde curto junto com o aviso' },
  { key: 'resumeCapture', title: 'Captura do Smart Resume', desc: 'Uma imagem da tela a cada 3 min de jogo; a última vira o cartão da sessão' }
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

/** anchor: rola até um cartão (ex.: 'api-keys', 'emulators') e o destaca. */
export function SettingsView({ onCredits, anchor }: { onCredits: () => void; anchor?: string | null }) {
  const settings = useStore((s) => s.settings)
  const sources = useStore((s) => s.sources)
  const scanning = useStore((s) => s.scanning)
  const [ver, setVer] = useState<{ app: string; electron: string; node: string } | null>(null)
  useEffect(() => {
    void window.nexus.version().then(setVer)
  }, [])
  useEffect(() => {
    if (!anchor) return
    const t = window.setTimeout(() => {
      const el = document.getElementById(anchor)
      if (!el) return
      el.scrollIntoView({ block: 'start', behavior: 'smooth' })
      el.classList.remove('flash')
      void el.offsetWidth
      el.classList.add('flash')
    }, 380)
    return () => window.clearTimeout(t)
  }, [anchor])

  return (
    <ScrollView>
      <header className="view-head">
        <div className="view-title">
          <h1>Ajustes</h1>
          <p>{ver ? `Prisma ${ver.app} · Electron ${ver.electron}` : ''}</p>
        </div>
      </header>

      <div className="settings-grid">
        <section className="glass card span-2">
          <h2 className="card-title">Mood da Biblioteca</h2>
          <p className="muted small card-note">A atmosfera base do Prisma: cores, iluminação, partículas e o tom do vidro. O tema é sempre escuro; com o Modo Zona ligado, cada jogo aberto ainda traz a própria atmosfera.</p>
          <MoodPicker inline />
          <div className="set">
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

        <ProfileCard />

        <section className="glass card span-2" id="api-keys">
          <h2 className="card-title">Chaves de API (opcionais)</h2>
          <ApiWarning />
          <div className="set two">
            <div className="it col">
              <div>
                <b>Chave da Steam Web API</b>
                <span>
                  Mostra os amigos online ou jogando, compara bibliotecas e traz a lista completa de jogos da sua conta Steam, inclusive os que você nunca abriu. Gere em{' '}
                  <button className="link" onClick={() => window.nexus.shell.openExternal('https://steamcommunity.com/dev/apikey')}>
                    steamcommunity.com/dev/apikey
                  </button>
                  , entrando com a mesma conta escolhida no perfil. No campo de domínio, pode usar <code>localhost</code>.
                </span>
              </div>
              <ApiKeyField value={settings.steamApiKey} />
            </div>
            <div className="it col">
              <div>
                <b>Chave do IsThereAnyDeal (Loja)</b>
                <span>
                  Mostra na Loja o menor preço que cada jogo já teve, em reais, somando Steam, Epic e outras lojas. Crie uma conta grátis e gere a chave em{' '}
                  <button className="link" onClick={() => window.nexus.shell.openExternal('https://isthereanydeal.com/apps/my/')}>
                    isthereanydeal.com/apps/my
                  </button>
                  .
                </span>
              </div>
              <ItadKeyField value={settings.itadKey} />
            </div>
          </div>
        </section>

        <EmulatorsCard />

        <section className="glass card">
          <h2 className="card-title">Conquistas e Smart Resume</h2>
          <div className="set">
            <Rows items={ACHIEVEMENTS} />
            <div className="it">
              <div>
                <b>Testar notificação</b>
                <span>Aparece no canto da tela, por cima de tudo, sem roubar o foco do jogo (jogos em tela cheia exclusiva a escondem)</span>
              </div>
              <button className="btn ghost sm" onClick={() => window.nexus.testAchievementPopup()}>
                Testar
              </button>
            </div>
          </div>
        </section>

        <ControllerCard />
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

        <UpdatesCard />

        <section className="glass card">
          <h2 className="card-title">Geral</h2>
          <div className="set">
            <Rows items={GENERAL} />
            <IntroRow />
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
            <span className={`sync-state ${scanning ? 'on' : ''}`}>
              <IconRefresh width={13} height={13} />
              {scanning ? 'Sincronizando…' : 'Automática'}
            </span>
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
              ['Esc', 'Voltar'],
              ['Enter', 'Abrir jogo'],
              ['Duplo clique', 'Jogar'],
              ['Setas', 'Navegar'],
              ['Ctrl ↑ ↓', 'Trocar de tela'],
              ['Start / Options', 'Modo Controle'],
              ['L2 / R2', 'Trocar de tela (controle)']
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
          <button className="btn ghost sm credits-link" onClick={onCredits}>
            <IconHeart width={14} height={14} />
            Créditos
          </button>
        </section>
      </div>
    </ScrollView>
  )
}

/** Introdução de abertura (vale para o PC todo: aparece antes da escolha de perfil). */
function IntroRow() {
  const [on, setOn] = useState(introEnabled)
  return (
    <div className="it">
      <div>
        <b>Introdução ao abrir</b>
        <span>O feixe de luz, o som de abertura e “clique em qualquer lugar” antes da escolha de perfil</span>
      </div>
      <div className="row">
        <button className="btn ghost sm" onClick={() => startupChime()}>
          Ouvir
        </button>
        <button
          className="tg"
          role="switch"
          aria-checked={on}
          aria-label="Introdução ao abrir"
          onClick={() => {
            setIntroEnabled(!on)
            setOn(!on)
          }}
        />
      </div>
    </div>
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

function ApiKeyField({ value }: { value: string }) {
  const [v, setV] = useState(value)
  const [show, setShow] = useState(false)
  useEffect(() => setV(value), [value])
  const save = (): void => {
    const key = v.trim()
    if (key === value) return
    if (key && !/^[0-9A-F]{32}$/i.test(key)) {
      toast('A chave da Steam tem 32 caracteres (0-9, A-F)', 'err')
      return
    }
    void updateSettings({ steamApiKey: key.toUpperCase() }).then(() => {
      invalidateSocial()
      toast(key ? 'Chave salva: amigos online ativados' : 'Chave removida')
    })
  }
  return (
    <div className="row key-field">
      <input
        className="input mono"
        type={show ? 'text' : 'password'}
        value={v}
        placeholder="32 caracteres"
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => setV(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        aria-label="Chave da Steam Web API"
      />
      <button className="btn ghost sm" onClick={() => setShow((s) => !s)}>
        {show ? 'Ocultar' : 'Mostrar'}
      </button>
    </div>
  )
}

/** Aviso sobre as chaves de API: o que são, o que o Prisma faz com elas e o que fazer se vazarem. */
export function ApiWarning() {
  return (
    <div className="api-warn" role="note">
      <span className="api-warn-ico" aria-hidden="true">
        !
      </span>
      <div>
        <b>Antes de colar uma chave</b>
        <ul>
          <li>
            <b>São opcionais.</b> Sem elas o Prisma funciona normalmente; você só deixa de ver amigos online, a lista completa da Steam e o menor preço histórico.
          </li>
          <li>
            <b>Trate como uma senha.</b> Não compartilhe e não deixe aparecer em prints, vídeos ou lives: quem tem a sua chave da Steam consegue consultar dados da sua conta.
          </li>
          <li>
            <b>Ficam só neste PC</b>, nos ajustes do seu perfil, e servem apenas para <b>ler</b> informações públicas. O Prisma nunca compra, vende, troca nem altera nada nas suas contas.
          </li>
          <li>
            <b>Vazou?</b> Revogue na mesma página onde gerou e crie outra. A Steam só libera chaves para contas que já gastaram pelo menos US$ 5 na loja.
          </li>
        </ul>
      </div>
    </div>
  )
}

function ItadKeyField({ value }: { value: string }) {
  const [v, setV] = useState(value)
  const [show, setShow] = useState(false)
  useEffect(() => setV(value), [value])
  const save = (): void => {
    const key = v.trim()
    if (key === value) return
    if (key && !/^[0-9a-z-]{20,64}$/i.test(key)) {
      toast('Essa não parece uma chave do IsThereAnyDeal', 'err')
      return
    }
    void updateSettings({ itadKey: key }).then(() => toast(key ? 'Chave salva: a Loja mostra o menor preço histórico' : 'Chave removida'))
  }
  return (
    <div className="row key-field">
      <input
        className="input mono"
        type={show ? 'text' : 'password'}
        value={v}
        placeholder="Cole a chave aqui"
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => setV(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        aria-label="Chave do IsThereAnyDeal"
      />
      <button className="btn ghost sm" onClick={() => setShow((s) => !s)}>
        {show ? 'Ocultar' : 'Mostrar'}
      </button>
    </div>
  )
}

const shortPath = (p: string): string => (p.length > 46 ? `${p.slice(0, 16)}…${p.slice(-28)}` : p)

/**
 * Emuladores: o Prisma não emula nada, ele organiza. Aponte o emulador de cada console e a pasta
 * dos jogos; eles entram na biblioteca com capa. Com a nuvem ligada, os saves vão para uma pasta
 * sincronizada (OneDrive, Google Drive, Dropbox) antes e depois de cada sessão.
 */
function EmulatorsCard() {
  const [info, setInfo] = useState<EmuInfo | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    void window.nexus.emulators.info().then(setInfo)
  }, [])
  if (!info) return null
  const { config } = info
  const run = async (p: Promise<EmuInfo>): Promise<void> => {
    setBusy(true)
    try {
      setInfo(await p)
    } finally {
      setBusy(false)
    }
  }
  const detect = async (): Promise<void> => {
    const before = Object.values(config.exes).filter(Boolean).length
    setBusy(true)
    try {
      const next = await window.nexus.emulators.detect()
      setInfo(next)
      const found = Object.values(next.config.exes).filter(Boolean).length
      toast(found > before ? `${found - before} emulador(es) encontrado(s)` : found ? 'Nenhum emulador novo encontrado' : 'Nenhum emulador encontrado nas pastas comuns: escolha o executável', found > before ? 'ok' : 'err')
    } finally {
      setBusy(false)
    }
  }
  const rescan = async (): Promise<void> => {
    setBusy(true)
    try {
      const r = await window.nexus.emulators.rescan()
      setInfo(await window.nexus.emulators.info())
      toast(`${r.found} jogo(s) de emulador na biblioteca${r.removed ? ` · ${r.removed} removido(s)` : ''}`)
    } finally {
      setBusy(false)
    }
  }
  const total = Object.values(info.counts).reduce((n, c) => n + (c ?? 0), 0)
  return (
    <section className="glass card span-2" id="emulators">
      <div className="card-title row between">
        <h2>Emuladores</h2>
        <div className="row">
          <button className="btn ghost sm" onClick={() => void detect()} disabled={busy}>
            <IconSearch width={13} height={13} />
            Detectar
          </button>
          <button className="btn ghost sm" onClick={() => void rescan()} disabled={busy}>
            <IconRefresh width={13} height={13} />
            Procurar jogos
          </button>
        </div>
      </div>
      <p className="muted small card-note">
        Jogue sua coleção de console pelo Prisma: escolha o emulador e a pasta dos jogos de cada sistema. {total ? `${total} jogo(s) na biblioteca.` : 'Os jogos aparecem na Biblioteca, no filtro Emuladores.'}
      </p>
      <div className="emu-grid">
        {info.emulators.map((e) => {
          const exe = config.exes[e.id]
          return (
            <div className={`emu ${exe ? 'ok' : ''}`} key={e.id}>
              <div className="emu-head">
                <b>{e.name}</b>
                <span className="muted small">{e.systems.map((s) => EMU_SYSTEMS[s].label).join(' · ')}</span>
              </div>
              <button className="emu-path" onClick={() => void run(window.nexus.emulators.pick('exe', e.id))} disabled={busy} title={exe || 'Escolher o executável'}>
                <i className={exe ? 'on' : ''} />
                <span className={exe ? 'mono' : ''}>{exe ? shortPath(exe) : 'Escolher o executável…'}</span>
              </button>
              {e.systems.map((s: EmuSystemId) => {
                const dir = config.romDirs[s]
                return (
                  <button key={s} className="emu-path dir" onClick={() => void run(window.nexus.emulators.pick('dir', s))} disabled={busy} title={dir || `Pasta dos jogos de ${EMU_SYSTEMS[s].label}`}>
                    <IconFolder width={13} height={13} />
                    <span className={dir ? 'mono' : ''}>{dir ? shortPath(dir) : `Pasta dos jogos de ${EMU_SYSTEMS[s].label}…`}</span>
                    {info.counts[s] ? <em>{info.counts[s]}</em> : null}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
      <div className="set">
        <div className="it">
          <div>
            <b>Saves na nuvem</b>
            <span>
              {config.cloudDir
                ? `Antes de jogar, o Prisma traz o save mais novo de ${shortPath(config.cloudDir)}; ao fechar o jogo, envia de volta. Assim o progresso segue você em qualquer PC.`
                : 'Escolha uma pasta sincronizada (OneDrive, Google Drive ou Dropbox) para levar os saves dos emuladores para qualquer PC.'}
            </span>
          </div>
          <div className="row">
            {!config.cloudDir && info.suggestedCloud ? (
              <button className="btn ghost sm" onClick={() => void run(window.nexus.emulators.set({ cloudDir: info.suggestedCloud, cloudSync: true }))} disabled={busy} title={info.suggestedCloud}>
                Usar {/onedrive/i.test(info.suggestedCloud) ? 'OneDrive' : /google/i.test(info.suggestedCloud) ? 'Google Drive' : /dropbox/i.test(info.suggestedCloud) ? 'Dropbox' : 'sugerida'}
              </button>
            ) : null}
            <button className="btn ghost sm" onClick={() => void run(window.nexus.emulators.pick('dir', 'cloud'))} disabled={busy}>
              {config.cloudDir ? 'Trocar pasta' : 'Escolher pasta'}
            </button>
            <button
              className="tg"
              role="switch"
              aria-checked={config.cloudSync && !!config.cloudDir}
              aria-label="Saves na nuvem"
              disabled={!config.cloudDir || busy}
              onClick={() => void run(window.nexus.emulators.set({ cloudSync: !config.cloudSync }))}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

/** Perfis deste PC: dono da conta Steam, trocar e remover. */
function ProfileCard() {
  const profiles = useStore((s) => s.profiles)
  const me = useStore((s) => s.profile)
  const accounts = useSteamAccounts()
  const [confirm, setConfirm] = useState<number | null>(null)
  const accountLabel = (id: string | null): string => {
    if (id === '') return 'Sem Steam: Epic, GOG, Xbox, emuladores e jogos adicionados'
    if (id == null) return 'Vê os jogos de todas as contas Steam do PC. Escolha uma conta ao lado'
    const a = accounts?.find((x) => x.accountId === id)
    return `Biblioteca e tempo de jogo da conta Steam ${a ? `“${a.name}”` : 'escolhida'}`
  }
  const remove = async (id: number): Promise<void> => {
    try {
      await window.nexus.profiles.remove(id)
      await refreshProfiles()
      invalidateSocial()
      toast('Perfil removido')
    } catch (e) {
      toast((e as Error).message.replace(/^.*Error: /, ''), 'err')
    }
    setConfirm(null)
  }
  return (
    <section className="glass card" id="profiles">
      <div className="card-title row between">
        <h2>Perfis</h2>
        <button className="btn ghost sm" onClick={switchProfile}>
          Trocar perfil
        </button>
      </div>
      <div className="set">
        {profiles.map((p) => (
          <div className="it" key={p.id}>
            <div className="prof-row">
              <Avatar src={p.avatar} name={p.nickname} size={34} />
              <div>
                <b>
                  {p.nickname}
                  {p.id === me?.id ? <em className="you">você</em> : null}
                </b>
                <span>{accountLabel(p.steamAccount)}</span>
              </div>
            </div>
            <div className="row">
              <select
                className="select-inline"
                value={p.steamAccount ?? '__all'}
                onChange={(e) => {
                  if (e.target.value !== '__all') void saveProfile(p.id, { steamAccount: e.target.value }).then(refreshProfiles)
                }}
                aria-label={`Conta Steam de ${p.nickname}`}
                title="Conta Steam deste perfil"
              >
                {p.steamAccount == null ? <option value="__all">Todas as contas do PC</option> : null}
                {(accounts ?? []).map((a) => (
                  <option key={a.accountId} value={a.accountId}>
                    Steam: {a.name}
                  </option>
                ))}
                <option value="">Sem Steam</option>
              </select>
              {p.id !== me?.id && profiles.length > 1 ? (
                confirm === p.id ? (
                  <button className="btn danger sm" onClick={() => void remove(p.id)}>
                    Confirmar
                  </button>
                ) : (
                  <button className="btn ghost sm" onClick={() => setConfirm(p.id)}>
                    Remover
                  </button>
                )
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

type CKey = keyof ControllerSettings

/** Os mesmos ajustes do painel do Modo Controle, para quem prefere mouse. */
function ControllerCard() {
  const c = useStore((s) => s.settings.controller)
  const set = (patch: Partial<ControllerSettings>): void => {
    void updateSettings({ controller: { ...c, ...patch } }).then(() => window.setTimeout(() => sfx('move', true), 40))
  }
  const seg = (k: CKey, opts: Array<[number, string]>) => (
    <div className="segmented">
      {opts.map(([v, label]) => (
        <button key={v} className={c[k] === v ? 'on' : ''} onClick={() => set({ [k]: v } as Partial<ControllerSettings>)}>
          {label}
        </button>
      ))}
    </div>
  )
  return (
    <section className="glass card">
      <h2 className="card-title">Modo Controle</h2>
      <div className="set">
        <div className="it">
          <div>
            <b>Só jogos com suporte a controle</b>
            <span>A prateleira mostra apenas o que a Steam indica como compatível (completo ou parcial)</span>
          </div>
          <button className="tg" role="switch" aria-checked={c.onlyCompatible} aria-label="Só jogos com suporte a controle" onClick={() => set({ onlyCompatible: !c.onlyCompatible })} />
        </div>
        <div className="it">
          <div>
            <b>Vibração</b>
            <span>Toques curtos ao navegar e confirmar (controles com motor de vibração)</span>
          </div>
          <button className="tg" role="switch" aria-checked={c.vibration} aria-label="Vibração" onClick={() => set({ vibration: !c.vibration })} />
        </div>
        <div className="it">
          <div>
            <b>Sons do sistema</b>
            <span>Mover, confirmar e voltar, como num console</span>
          </div>
          <button className="tg" role="switch" aria-checked={c.sounds} aria-label="Sons do sistema" onClick={() => set({ sounds: !c.sounds })} />
        </div>
        <div className="it">
          <div>
            <b>Volume</b>
            <span>{Math.round(c.volume * 100)}%</span>
          </div>
          <input className="range" type="range" min={0} max={1} step={0.05} value={c.volume} onChange={(e) => set({ volume: Number(e.target.value) })} aria-label="Volume dos sons" />
        </div>
        <div className="it">
          <div>
            <b>Sensibilidade da navegação</b>
            <span>Rapidez com que o direcional repete ao segurar</span>
          </div>
          {seg('sensitivity', [
            [1, 'Lenta'],
            [2, 'Normal'],
            [3, 'Rápida']
          ])}
        </div>
        <div className="it">
          <div>
            <b>Velocidade do cursor virtual</b>
            <span>Analógico direito move o cursor; R3 clica</span>
          </div>
          <input className="range" type="range" min={6} max={30} step={2} value={c.cursorSpeed} onChange={(e) => set({ cursorSpeed: Number(e.target.value) })} aria-label="Velocidade do cursor" />
        </div>
        <div className="it">
          <div>
            <b>Intensidade das animações</b>
            <span>Intro, prateleira e transições do Modo Controle</span>
          </div>
          {seg('animation', [
            [0, 'Suave'],
            [1, 'Normal'],
            [2, 'Intensa']
          ])}
        </div>
      </div>
    </section>
  )
}
/** Atualizações pelo próprio launcher (as versões ficam nas releases do GitHub do Prisma). */
function UpdatesCard() {
  const u = useStore((s) => s.update)
  const auto = useStore((s) => s.settings.autoUpdate)
  const [busy, setBusy] = useState(false)
  const check = async (): Promise<void> => {
    setBusy(true)
    try {
      const s = await window.nexus.update.check()
      if (s.state === 'none') toast('Você já está na versão mais recente')
      else if (s.state === 'error') toast(s.message ?? 'Não foi possível verificar', 'err')
    } finally {
      setBusy(false)
    }
  }
  const text = !u
    ? '…'
    : u.state === 'disabled'
      ? (u.message ?? 'Indisponível nesta versão')
      : u.state === 'checking'
        ? 'Procurando…'
        : u.state === 'downloading'
          ? `Baixando o Prisma ${u.version ?? ''}${u.percent != null ? ` · ${u.percent}%` : ''}`
          : u.state === 'ready'
            ? `Prisma ${u.version} baixado: instala ao fechar ou em "Reiniciar e atualizar"`
            : u.state === 'portable'
              ? `Prisma ${u.version} disponível para baixar (versão portátil)`
              : u.state === 'error'
                ? (u.message ?? 'Erro ao verificar')
                : u.checkedAt
                  ? `Tudo em dia · verificado ${new Date(u.checkedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Verifica ao abrir e a cada 6 horas'
  return (
    <section className="glass card">
      <h2 className="card-title">Atualizações</h2>
      <div className="set">
        <div className="it">
          <div>
            <b>Versão {u?.current ?? ''}</b>
            <span>{text}</span>
          </div>
          {u?.state === 'ready' ? (
            <button className="btn sm" onClick={() => void window.nexus.update.install().then((r) => toast(r.message, r.ok ? 'ok' : 'err'))}>
              Reiniciar e atualizar
            </button>
          ) : u?.state === 'portable' ? (
            <button className="btn sm" onClick={() => window.nexus.update.openDownload()}>
              Baixar
            </button>
          ) : (
            <button className="btn ghost sm" onClick={() => void check()} disabled={busy || !u || u.state === 'disabled' || u.state === 'checking' || u.state === 'downloading'}>
              {busy ? 'Procurando…' : 'Procurar atualizações'}
            </button>
          )}
        </div>
        <div className="it">
          <div>
            <b>Novidades desta versão</b>
            <span>O que mudou no Prisma {u?.current ?? ''}</span>
          </div>
          <button className="btn ghost sm" onClick={() => u && setState({ whatsNew: u.current })} disabled={!u}>
            <IconSparkles width={13} height={13} />
            Ver novidades
          </button>
        </div>
        <div className="it">
          <div>
            <b>Atualizar automaticamente</b>
            <span>Baixa em segundo plano (nunca durante um jogo) e instala quando você fechar o Prisma</span>
          </div>
          <button className="tg" role="switch" aria-checked={auto} aria-label="Atualizar automaticamente" onClick={() => void updateSettings({ autoUpdate: !auto })} />
        </div>
      </div>
    </section>
  )
}