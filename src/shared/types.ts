export type Platform = 'steam' | 'epic' | 'gog' | 'xbox' | 'manual'

export const PLATFORMS: Platform[] = ['steam', 'epic', 'gog', 'xbox', 'manual']

export const PLATFORM_LABEL: Record<Platform, string> = {
  steam: 'Steam',
  epic: 'Epic Games',
  gog: 'GOG',
  xbox: 'Xbox PC',
  manual: 'Manual'
}

export interface Game {
  id: number
  title: string
  platform: Platform
  /** Identificador na plataforma de origem (appid, AppName, productId, PackageFamilyName ou caminho do exe). */
  platformId: string
  installDir: string | null
  exePath: string | null
  launchUri: string | null
  /** Capa vertical (box art 2:3). */
  coverUrl: string | null
  /** Banner horizontal (hero). */
  bannerUrl: string | null
  logoUrl: string | null
  iconUrl: string | null
  /** Ícone extraído do .exe (data URL) para jogos manuais. */
  iconData: string | null
  developer: string | null
  publisher: string | null
  releaseDate: number | null
  genres: string[]
  description: string | null
  /** Tamanho em disco, em bytes, quando instalado. */
  installSize: number | null
  favorite: boolean
  installed: boolean
  addedAt: number
  lastPlayed: number | null
  playtimeSeconds: number
  platformPlaytimeSeconds: number
  platformLastPlayed: number | null
  zoneColor: string | null
  /** URL HLS do trailer; '' quando já se sabe que não há; null quando ainda não foi consultado. */
  trailerUrl: string | null
  achievementsUnlocked: number
  achievementsTotal: number
}

export interface Session {
  id: number
  gameId: number
  startedAt: number
  endedAt: number | null
  durationSeconds: number
  avgFps: number | null
  avgCpu: number | null
  avgGpu: number | null
  maxGpuTemp: number | null
}

export interface Achievement {
  gameId: number
  apiName: string
  name: string
  description: string | null
  icon: string | null
  unlockedAt: number | null
}

export interface TimelineData {
  sessions: Session[]
  achievements: Achievement[]
}

export interface SourceStatus {
  platform: Platform
  count: number
  installed: number
  lastScan: number | null
  detail: string
  ok: boolean
}

export interface ScanResult {
  sources: SourceStatus[]
  added: number
  updated: number
  removed: number
  durationMs: number
}

/** Uma leitura do monitor de desempenho. Campos null = não disponível nesta máquina. */
export interface PerfSample {
  t: number
  cpu: number
  ramUsed: number
  ramTotal: number
  gpu: number | null
  vramUsed: number | null
  vramTotal: number | null
  cpuTemp: number | null
  gpuTemp: number | null
  fps: number | null
  gpuName: string | null
  gameRunning: boolean
  sources: { gpu: 'nvidia' | 'wmi' | null; cpuTemp: 'acpi' | null; fps: 'presentmon' | null }
}

export type ThemeMode = 'dark' | 'light' | 'system'

export interface Settings {
  launchOnStartup: boolean
  syncOnOpen: boolean
  minimizeToTray: boolean
  glassEffect: boolean
  globalShortcut: string
  theme: ThemeMode
  zoneMode: boolean
  zoneParticles: boolean
  zoneHoverPreview: boolean
  /** Trailer silencioso ao repousar o mouse ~1 s sobre uma capa. */
  trailersOnHover: boolean
  /** Abre o Performance Center antes de iniciar o jogo. */
  perfCenterOnLaunch: boolean
  performanceMode: boolean
  /** Processos (nome do executável) fechados pelo Modo Performance. */
  heavyProcesses: string[]
  cinematicLaunch: boolean
  idleShowcase: boolean
  idleSeconds: number
  /** Caminho opcional do PresentMon para medir FPS. */
  presentMonPath: string
}

export const DEFAULT_SETTINGS: Settings = {
  launchOnStartup: false,
  syncOnOpen: true,
  minimizeToTray: true,
  glassEffect: true,
  globalShortcut: 'Control+Alt+P',
  theme: 'dark',
  zoneMode: true,
  zoneParticles: true,
  zoneHoverPreview: false,
  trailersOnHover: true,
  perfCenterOnLaunch: true,
  performanceMode: false,
  heavyProcesses: [],
  cinematicLaunch: true,
  idleShowcase: true,
  idleSeconds: 45,
  presentMonPath: ''
}

export interface LaunchResult {
  ok: boolean
  message: string
  /** O jogo foi aberto (não só a loja para instalar). */
  started?: boolean
}

export interface LaunchOptions {
  performanceMode: boolean
}

export interface ManualGameInput {
  title: string
  exePath: string
}

export interface WindowState {
  maximized: boolean
  fullscreen: boolean
}

export type MainEvent =
  | { type: 'scan:started' }
  | { type: 'scan:finished'; result: ScanResult }
  | { type: 'session:started'; gameId: number }
  | { type: 'session:ended'; gameId: number; durationSeconds: number }
  | { type: 'games:changed' }
  | { type: 'window:state'; state: WindowState }
  | { type: 'perf:sample'; sample: PerfSample }
  | { type: 'perf:closed'; names: string[] }

export interface PrismaApi {
  games: {
    list(): Promise<Game[]>
    scan(): Promise<ScanResult>
    launch(id: number, opts?: LaunchOptions): Promise<LaunchResult>
    install(id: number): Promise<LaunchResult>
    toggleFavorite(id: number): Promise<Game>
    remove(id: number): Promise<void>
    addManual(input: ManualGameInput): Promise<Game>
    pickExecutable(): Promise<{ path: string; title: string } | null>
    /** Completa descrição, gêneros, trailer e tamanho sob demanda e devolve o jogo atualizado. */
    details(id: number): Promise<Game | null>
    /** URL do trailer (HLS) ou null se o jogo não tiver. */
    trailer(id: number): Promise<string | null>
    zoneColor(id: number): Promise<string | null>
    achievements(id: number): Promise<Achievement[]>
    sessions(id: number, limit?: number): Promise<Session[]>
    recentSessions(limit?: number): Promise<Array<Session & { title: string }>>
    sources(): Promise<SourceStatus[]>
  }
  timeline(): Promise<TimelineData>
  perf: {
    /** Liga o monitor em tempo real (1 s) enquanto uma tela de desempenho estiver aberta. */
    watch(on: boolean): void
    last(): Promise<PerfSample | null>
  }
  settings: {
    get(): Promise<Settings>
    set(patch: Partial<Settings>): Promise<Settings>
  }
  window: {
    minimize(): void
    toggleMaximize(): void
    toggleFullscreen(): void
    close(): void
    state(): Promise<WindowState>
  }
  shell: {
    openPath(path: string): Promise<void>
    showInFolder(path: string): void
    pathForFile(file: File): string
  }
  on(handler: (event: MainEvent) => void): () => void
  version(): Promise<{ app: string; electron: string; node: string }>
  /** Uso de memória do launcher (todos os processos), em bytes. */
  memory(): Promise<number>
  /** Libera o cache de imagens do renderer. */
  releaseMemory(): void
}
