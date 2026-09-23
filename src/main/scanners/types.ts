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
  installed: boolean
}

export interface ScannerOutput {
  games: DetectedGame[]
  detail: string
  ok: boolean
  /** Ids que a loja confirma não serem jogos (ferramentas, aplicativos). Saem da biblioteca mesmo com histórico. */
  notGames?: string[]
}

export interface Scanner {
  platform: Platform
  scan(): Promise<ScannerOutput>
}

/** Arquivos em disco são servidos ao renderer pelo protocolo cover://. */
export function localAsset(path: string): string {
  return 'cover://local/' + encodeURIComponent(path)
}
