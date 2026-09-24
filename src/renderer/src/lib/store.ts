import { useSyncExternalStore } from 'react'
import type { Game, MainEvent, PerfSample, Profile, ScanResult, Settings, SourceStatus, UpdateStatus, WindowState } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'

/**
 * Estado global com assinatura por seletor: cada componente só re-renderiza quando
 * a fatia que ele lê muda. Um toast ou uma amostra de desempenho não re-renderizam a biblioteca.
 */
export interface ToastMsg {
  id: number
  text: string
  kind: 'ok' | 'err'
}

export interface State {
  games: Game[]
  byId: Map<number, Game>
  loaded: boolean
  sources: SourceStatus[]
  settings: Settings
  scanning: boolean
  running: ReadonlySet<number>
  toast: ToastMsg | null
  lastScan: ScanResult | null
  win: WindowState
  perf: PerfSample | null
  /** Um jogo foi iniciado pelo Prisma e ainda está aberto: efeitos e trailers em pausa. */
  gameActive: boolean
  /** Janela minimizada/coberta, ou sem foco com jogo aberto. */
  background: boolean
  /** A janela tem o foco do teclado (o usuário está no launcher). */
  focused: boolean
  /** Fluxo de "Jogar": Performance Center, animação de saída, jogo aberto e retorno. */
  launch: { game: Game | null; phase: 'center' | 'out' | 'playing' | 'return' } | null
  /** Perfil ativo; null até a escolha na tela de perfis. */
  profile: Profile | null
  profiles: Profile[]
  /** Mostrar a tela "Quem está jogando?" (a cada abertura do app). */
  pickingProfile: boolean
  ramGb: number
  /** Enriquecimento da biblioteca em segundo plano (tags, requisitos, avaliações). */
  enrich: { done: number; total: number } | null
  update: UpdateStatus | null
}

let state: State = {
  games: [],
  byId: new Map(),
  loaded: false,
  sources: [],
  settings: DEFAULT_SETTINGS,
  scanning: false,
  running: new Set(),
  toast: null,
  lastScan: null,
  win: { maximized: false, fullscreen: false },
  perf: null,
  gameActive: false,
  background: false,
  focused: true,
  launch: null,
  profile: null,
  profiles: [],
  pickingProfile: false,
  ramGb: 0,
  enrich: null,
  update: null
}

const listeners = new Set<() => void>()

export function getState(): State {
  return state
}

export function setState(patch: Partial<State>): void {
  state = { ...state, ...patch }
  if (patch.games) state.byId = new Map(patch.games.map((g) => [g.id, g]))
  for (const l of listeners) l()
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state))
}

// ---------- ações ----------

let toastTimer: number | null = null

export function toast(text: string, kind: 'ok' | 'err' = 'ok', ms = 2800): void {
  setState({ toast: { id: Date.now(), text, kind } })
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => setState({ toast: null }), ms)
}

function replaceGame(g: Game): void {
  setState({ games: state.games.map((x) => (x.id === g.id ? g : x)) })
}

export async function refresh(): Promise<void> {
  const [games, sources] = await Promise.all([window.nexus.games.list(), window.nexus.games.sources()])
  setState({ games, sources, loaded: true })
}

export async function scan(): Promise<void> {
  setState({ scanning: true })
  try {
    const r = await window.nexus.games.scan()
    const parts: string[] = []
    if (r.added) parts.push(`${r.added} novo${r.added > 1 ? 's' : ''}`)
    if (r.removed) parts.push(`${r.removed} removido${r.removed > 1 ? 's' : ''}`)
    toast(parts.length ? `Sincronizado: ${parts.join(', ')}` : `Bibliotecas sincronizadas em ${(r.durationMs / 1000).toFixed(1)} s`)
  } catch (e) {
    toast(`Falha na sincronização: ${(e as Error).message}`, 'err')
  } finally {
    setState({ scanning: false })
  }
}

export async function install(g: Game): Promise<void> {
  const r = await window.nexus.games.install(g.id)
  toast(r.message, r.ok ? 'ok' : 'err')
}

const wait = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms))
const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Botão "Jogar": instala se preciso, senão abre o Performance Center ou vai direto. */
export function play(g: Game): void {
  if (!g.installed && g.platform !== 'manual') {
    void install(g)
    return
  }
  if (state.running.has(g.id)) {
    toast(`${g.title} já está em execução`)
    return
  }
  if (state.launch) return
  if (state.settings.perfCenterOnLaunch) setState({ launch: { game: g, phase: 'center' } })
  else void startGame(g)
}

/** Animação cinematográfica, depois o jogo. O jogo só abre no fim da animação. */
export async function startGame(g: Game): Promise<void> {
  const cinematic = state.settings.cinematicLaunch && !reducedMotion()
  if (cinematic) {
    setState({ launch: { game: g, phase: 'out' } })
    await wait(1500)
  } else {
    setState({ launch: null })
  }
  const r = await window.nexus.games.launch(g.id, { performanceMode: state.settings.performanceMode })
  if (!r.ok || !r.started) {
    toast(r.message, r.ok ? 'ok' : 'err')
    if (cinematic) returnFromGame()
    return
  }
  toast(r.message)
  setState({ gameActive: true, launch: cinematic ? { game: g, phase: 'playing' } : null })
}

export function cancelLaunch(): void {
  if (state.launch?.phase === 'center') setState({ launch: null })
}

/** Transição de volta ao launcher. */
export function returnFromGame(): void {
  const l = state.launch
  if (!l || l.phase === 'return') return
  setState({ launch: { ...l, phase: 'return' } })
  window.setTimeout(() => {
    if (state.launch?.phase === 'return') setState({ launch: null })
  }, 950)
}

export async function toggleFavorite(g: Game): Promise<void> {
  const updated = await window.nexus.games.toggleFavorite(g.id)
  replaceGame(updated)
  toast(updated.favorite ? `${g.title} adicionado aos favoritos` : `${g.title} removido dos favoritos`)
}

export async function removeGame(g: Game): Promise<void> {
  await window.nexus.games.remove(g.id)
  setState({ games: state.games.filter((x) => x.id !== g.id) })
  toast(`${g.title} removido da biblioteca`)
}

export async function loadDetails(g: Game): Promise<Game | null> {
  if (g.id >= 1_000_000) return g
  const updated = await window.nexus.games.details(g.id)
  if (updated) replaceGame(updated)
  return updated
}

export async function addManual(title: string, exePath: string): Promise<Game> {
  const g = await window.nexus.games.addManual({ title, exePath })
  await refresh()
  toast(`${g.title} adicionado à biblioteca`)
  return g
}

export async function setCompleted(g: Game, completed: boolean): Promise<void> {
  const updated = await window.nexus.games.setCompleted(g.id, completed)
  replaceGame(updated)
  toast(completed ? `${g.title} marcado como concluído` : `${g.title} desmarcado como concluído`)
}

// ---------- perfis ----------

export async function refreshProfiles(): Promise<void> {
  const [profiles, profile] = await Promise.all([window.nexus.profiles.list(), window.nexus.profiles.active()])
  setState({ profiles, profile: state.pickingProfile ? state.profile : profile })
}

/** Entra com um perfil: os ajustes, sessões e estatísticas passam a ser dele. */
export async function selectProfile(id: number): Promise<void> {
  const settings = await window.nexus.profiles.select(id)
  const [profiles, profile] = await Promise.all([window.nexus.profiles.list(), window.nexus.profiles.active()])
  setState({ settings, profiles, profile, pickingProfile: false })
}

export function switchProfile(): void {
  void refreshProfiles().then(() => setState({ pickingProfile: true }))
}

export async function saveProfile(id: number, patch: Parameters<typeof window.nexus.profiles.update>[1]): Promise<void> {
  const p = await window.nexus.profiles.update(id, patch)
  setState({ profiles: state.profiles.map((x) => (x.id === p.id ? p : x)), profile: state.profile?.id === p.id ? p : state.profile })
}

/** Guarda a busca no histórico do perfil (8 mais recentes, sem repetição). */
export function rememberSearch(q: string): void {
  const t = q.trim()
  if (t.length < 2) return
  const hist = [t, ...state.settings.searchHistory.filter((h) => h.toLowerCase() !== t.toLowerCase())].slice(0, 8)
  void updateSettings({ searchHistory: hist })
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  setState({ settings: { ...state.settings, ...patch } })
  const s = await window.nexus.settings.set(patch)
  setState({ settings: s })
}

// ---------- inicialização ----------

let started = false

export function initStore(): void {
  if (started) return
  started = true
  // Janela recriada depois de um jogo no Modo Performance: entra com a transição de retorno.
  if (location.hash === '#return') {
    setState({ launch: { game: null, phase: 'playing' } })
    window.setTimeout(returnFromGame, 60)
    history.replaceState(null, '', location.pathname)
  }
  void refresh()
  void window.nexus.settings.get().then((settings) => setState({ settings }))
  void window.nexus.system().then(({ ramGb }) => setState({ ramGb }))
  void window.nexus.update.status().then((update) => {
    setState({ update })
    if (update.updatedFrom) toast(`Prisma atualizado para a versão ${update.current}${update.updatedFrom !== '?' ? ` (antes ${update.updatedFrom})` : ''}`, 'ok', 7000)
  })
  // A cada abertura do app pergunta quem está jogando (a janela recriada depois de um jogo, não).
  void Promise.all([window.nexus.profiles.list(), window.nexus.profiles.active(), window.nexus.profiles.needsPick()]).then(
    ([profiles, profile, needsPick]) => setState({ profiles, profile, pickingProfile: needsPick })
  )
  void window.nexus.window.state().then((win) => setState({ win }))
  window.nexus.on((ev: MainEvent) => {
    switch (ev.type) {
      case 'scan:started':
        setState({ scanning: true })
        break
      case 'scan:finished':
        setState({ scanning: false, lastScan: ev.result })
        void refresh()
        break
      case 'games:changed':
        void refresh()
        break
      case 'session:started': {
        const running = new Set(state.running)
        running.add(ev.gameId)
        setState({ running })
        void refresh()
        break
      }
      case 'session:ended': {
        const running = new Set(state.running)
        running.delete(ev.gameId)
        setState({ running, gameActive: running.size > 0 && state.gameActive })
        if (running.size === 0 && state.launch?.phase === 'playing') returnFromGame()
        void refresh()
        break
      }
      case 'window:state':
        setState({ win: ev.state })
        break
      case 'perf:sample':
        setState({ perf: ev.sample })
        break
      case 'perf:closed':
        toast(`Modo Performance fechou: ${ev.names.join(', ')}`)
        break
      case 'achievement:unlocked':
        // A notificação por cima do jogo é do processo principal; aqui só atualiza contadores.
        if (document.hasFocus()) toast(`Conquista desbloqueada: ${ev.achievement.name}`)
        break
      case 'update:status':
        setState({ update: ev.status })
        break
      case 'enrich:progress':
        setState({ enrich: ev.done >= ev.total ? null : { done: ev.done, total: ev.total } })
        break
    }
  })

  // Segundo plano = minimizada/coberta, ou sem foco enquanto um jogo roda: animações e partículas param.
  // Só "sem foco" não conta: dá para passar o mouse numa janela do Windows sem focá-la.
  const bg = (): void => {
    const background = document.hidden || (!document.hasFocus() && state.running.size > 0)
    if (background !== state.background) {
      setState({ background })
      // Minimizada ou coberta: libera imagens decodificadas; voltam do disco quando preciso.
      if (background && document.hidden) window.nexus.releaseMemory()
    }
    const focused = document.hasFocus()
    if (focused !== state.focused) setState({ focused })
    document.documentElement.dataset.bg = background ? '1' : '0'
  }
  document.addEventListener('visibilitychange', bg)
  window.addEventListener('blur', bg)
  window.addEventListener('focus', bg)
  subscribe(bg)
  bg()
}
