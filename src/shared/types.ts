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
  /** Tags da loja Steam (em português), da mais relevante para a menos. */
  tags: string[]
  franchise: string | null
  /** Avaliação da Steam: % positivas, rótulo ("Muito positivas") e total de análises. */
  reviewPct: number | null
  reviewLabel: string | null
  reviewCount: number | null
  metacritic: number | null
  /** Requisitos mínimos (texto limpo) e a RAM mínima extraída deles. */
  minRequirements: string | null
  minRamGb: number | null
  /** Marcado como concluído pelo usuário (ou 100% das conquistas). */
  completed: boolean
}

export interface Session {
  id: number
  gameId: number
  profileId: number | null
  startedAt: number
  endedAt: number | null
  durationSeconds: number
  avgFps: number | null
  avgCpu: number | null
  avgGpu: number | null
  maxGpuTemp: number | null
  maxCpuTemp: number | null
  /** Última captura da sessão (cover:// para exibir). */
  screenshot: string | null
}

export interface Profile {
  id: number
  nickname: string
  /** Data URL (256×256 JPEG). */
  avatar: string | null
  /** Data URL (1600×500 JPEG). */
  banner: string | null
  /** Este perfil é o dono da conta Steam desta máquina: soma o tempo registrado pela Steam. */
  steamLinked: boolean
  createdAt: number
  lastUsed: number | null
}

export interface ProfileStats {
  profileId: number
  hours: number
  sessions: number
  gamesPlayed: number
  longestSessionSeconds: number
  achievements: number
  topGames: Array<{ gameId: number; seconds: number }>
}

export type FriendState = 'playing' | 'online' | 'away' | 'offline' | 'unknown'

export interface Friend {
  /** SteamID64 ou "local:<id>" para perfis deste PC. */
  id: string
  source: 'steam' | 'local'
  name: string
  avatar: string | null
  state: FriendState
  /** Jogo em andamento (Steam). */
  game: string | null
  gameAppId: string | null
  lastOnline: number | null
  profileUrl: string | null
}

export interface FriendLibrary {
  friendId: string
  /** appid (Steam) → minutos jogados. */
  games: Array<{ appid: string; name: string; minutes: number }>
  /** Tags por appid, para o Game DNA do amigo. */
  tags: Record<string, string[]>
  available: boolean
  reason: string | null
}

export interface CommunityInfo {
  appid: string | null
  playersNow: number | null
  reviewPct: number | null
  reviewLabel: string | null
  reviewCount: number | null
  metacritic: number | null
  news: Array<{ title: string; url: string; date: number; source: string; excerpt: string }>
}

export interface ResumeCard {
  session: Session
  achievements: Achievement[]
}

export interface ControllerSettings {
  vibration: boolean
  /** 1 (lenta) a 3 (rápida): atraso e velocidade de repetição dos direcionais. */
  sensitivity: number
  sounds: boolean
  volume: number
  /** Velocidade do cursor virtual (analógico direito), px por quadro na deflexão máxima. */
  cursorSpeed: number
  /** 0 suave, 1 normal, 2 intensa. */
  animation: number
}

export type MoodId = 'prisma' | 'resident-evil' | 'silent-hill' | 'cyberpunk' | 'stalker' | 'minecraft' | 'doom' | 'souls'

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

export interface Settings {
  launchOnStartup: boolean
  syncOnOpen: boolean
  minimizeToTray: boolean
  glassEffect: boolean
  globalShortcut: string
  /** Mood da Biblioteca: a atmosfera base do launcher (sempre sobre o tema escuro). */
  mood: MoodId
  zoneMode: boolean
  zoneParticles: boolean
  zoneHoverPreview: boolean
  /** Trailer silencioso ao repousar o cursor sobre uma capa. */
  trailersOnHover: boolean
  perfCenterOnLaunch: boolean
  performanceMode: boolean
  heavyProcesses: string[]
  cinematicLaunch: boolean
  idleShowcase: boolean
  idleSeconds: number
  presentMonPath: string
  /** Smart Resume: captura de tela periódica durante o jogo (a última vira o cartão). */
  resumeCapture: boolean
  /** Notificação de conquista por cima do jogo. */
  achievementPopup: boolean
  achievementSound: boolean
  /** Chave pessoal da Steam Web API (opcional): amigos online e comparação de bibliotecas. */
  steamApiKey: string
  controller: ControllerSettings
  /** Buscas recentes deste perfil. */
  searchHistory: string[]
}

export const DEFAULT_CONTROLLER: ControllerSettings = {
  vibration: true,
  sensitivity: 2,
  sounds: true,
  volume: 0.6,
  cursorSpeed: 14,
  animation: 1
}

export const DEFAULT_SETTINGS: Settings = {
  launchOnStartup: false,
  syncOnOpen: true,
  minimizeToTray: true,
  glassEffect: true,
  globalShortcut: 'Control+Alt+P',
  mood: 'prisma',
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
  presentMonPath: '',
  resumeCapture: true,
  achievementPopup: true,
  achievementSound: true,
  steamApiKey: '',
  controller: DEFAULT_CONTROLLER,
  searchHistory: []
}

export interface LaunchResult {
  ok: boolean
  message: string
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
  | { type: 'achievement:unlocked'; achievement: Achievement; gameTitle: string }
  | { type: 'enrich:progress'; done: number; total: number }

export interface PrismaApi {
  games: {
    list(): Promise<Game[]>
    scan(): Promise<ScanResult>
    launch(id: number, opts?: LaunchOptions): Promise<LaunchResult>
    install(id: number): Promise<LaunchResult>
    toggleFavorite(id: number): Promise<Game>
    setCompleted(id: number, completed: boolean): Promise<Game>
    remove(id: number): Promise<void>
    addManual(input: ManualGameInput): Promise<Game>
    pickExecutable(): Promise<{ path: string; title: string } | null>
    details(id: number): Promise<Game | null>
    trailer(id: number): Promise<string | null>
    zoneColor(id: number): Promise<string | null>
    achievements(id: number): Promise<Achievement[]>
    sessions(id: number, limit?: number): Promise<Session[]>
    recentSessions(limit?: number): Promise<Array<Session & { title: string }>>
    sources(): Promise<SourceStatus[]>
    /** Último cartão de Smart Resume do jogo (perfil ativo). */
    resume(id: number): Promise<ResumeCard | null>
    community(id: number): Promise<CommunityInfo>
  }
  profiles: {
    list(): Promise<Profile[]>
    active(): Promise<Profile | null>
    /** true até o usuário escolher um perfil nesta execução do app. */
    needsPick(): Promise<boolean>
    /** Ativa um perfil: ajustes, sessões e estatísticas passam a ser dele. */
    select(id: number): Promise<Settings>
    create(nickname: string): Promise<Profile>
    update(id: number, patch: Partial<Pick<Profile, 'nickname' | 'avatar' | 'banner' | 'steamLinked'>>): Promise<Profile>
    remove(id: number): Promise<void>
    stats(id: number): Promise<ProfileStats>
    /** Abre um seletor de imagem e devolve a imagem redimensionada como data URL. */
    pickImage(kind: 'avatar' | 'banner'): Promise<string | null>
  }
  friends: {
    list(): Promise<{ friends: Friend[]; mode: 'api' | 'local' | 'none'; message: string | null }>
    library(friendId: string): Promise<FriendLibrary>
    /** Minutos por appid do próprio usuário na Steam (para comparar). */
    myLibrary(): Promise<FriendLibrary>
  }
  /** Tags por appid para cálculo de Game DNA (consulta a loja e guarda em cache). */
  tagsFor(appids: string[]): Promise<Record<string, string[]>>
  timeline(): Promise<TimelineData>
  perf: {
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
    openExternal(url: string): void
    showInFolder(path: string): void
    pathForFile(file: File): string
    /** Salva uma imagem PNG (data URL) escolhendo o destino. */
    saveImage(dataUrl: string, name: string): Promise<boolean>
    copyImage(dataUrl: string): void
  }
  /** Mostra uma notificação de conquista de teste (sobreposição por cima de tudo). */
  testAchievementPopup(): void
  system(): Promise<{ ramGb: number }>
  on(handler: (event: MainEvent) => void): () => void
  version(): Promise<{ app: string; electron: string; node: string }>
  memory(): Promise<number>
  releaseMemory(): void
}