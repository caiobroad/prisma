import type { Platform } from '@shared/types'

/** Jogo encontrado por um scanner, antes de ir para o banco. */
export interface DetectedGame {
  platform: Platform
  platformId: string
  title: string
  installDir: string | null
  exePath: string | null
  launchUri: string | null
  coverUrl: string | null
  bannerUrl?: string | null
  logoUrl?: string | null
  iconUrl?: string | null
  developer?: string | null
  publisher?: string | null
  releaseDate?: number | null
  genres?: string[]
  description?: string | null
  platformPlaytimeSeconds?: number
  platformLastPlayed?: number | null
  installSize?: number | null
  franchise?: string | null
  installed: boolean
}

export interface ScannerOutput {
  games: DetectedGame[]
  detail: string
  ok: boolean
  /** Ids que a loja confirma não serem jogos (ferramentas, aplicativos). Saem da biblioteca mesmo com histórico. */
  notGames?: string[]
  /** Steam: de qual conta do PC é cada jogo, com o tempo registrado por ela. */
  owners?: SteamOwner[]
  /** Steam: contas (id curto) com dados neste PC. */
  accounts?: string[]
}

export interface SteamOwner {
  account: string
  appid: string
  playtimeMin: number
  lastPlayed: number | null
}

export interface Scanner {
  platform: Platform
  scan(): Promise<ScannerOutput>
}

/** Arquivos em disco são servidos ao renderer pelo protocolo cover://. */
export function localAsset(path: string): string {
  return 'cover://local/' + encodeURIComponent(path)
}
