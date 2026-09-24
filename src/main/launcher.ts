import { shell } from 'electron'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { dirname } from 'path'
import type { Game, LaunchResult } from '@shared/types'
import { trackByInstallDir, trackChild, isTracked } from './sessions'
import { epicInstallUri } from './scanners/epic'
import { launchEmulated } from './emulators'

/**
 * Lança o jogo pelo caminho nativo de cada plataforma. DRM, overlays e nuvem
 * continuam nas mãos da loja de origem; o Prisma só abre a porta e conta o tempo.
 */
export async function launchGame(game: Game): Promise<LaunchResult> {
  if (isTracked(game.id)) return { ok: false, message: `${game.title} já está em execução` }
  if (!game.installed && game.platform !== 'manual') return installGame(game)
  try {
    switch (game.platform) {
      case 'manual':
      case 'gog': {
        if (game.emuSystem) return launchEmulated(game)
        const exe = game.exePath
        if (!exe || !existsSync(exe)) {
          if (game.platform === 'gog' && game.launchUri) {
            await shell.openExternal(game.launchUri)
            trackByInstallDir(game)
            return { ok: true, started: true, message: `${game.title} aberto no GOG Galaxy` }
          }
          return { ok: false, message: 'Executável não encontrado. Confira o caminho nas informações do jogo.' }
        }
        const child = spawn(exe, [], { cwd: dirname(exe), detached: false, stdio: 'ignore', windowsHide: false })
        trackChild(game, child)
        return { ok: true, started: true, message: `${game.title} iniciado` }
      }
      case 'steam':
      case 'epic': {
        if (!game.launchUri) return { ok: false, message: 'Sem URI de lançamento' }
        await shell.openExternal(game.launchUri)
        trackByInstallDir(game)
        return { ok: true, started: true, message: `${game.title} iniciado via ${storeName(game)}` }
      }
      case 'xbox': {
        if (!game.launchUri) return { ok: false, message: 'Sem identificador do pacote' }
        spawn('explorer.exe', [game.launchUri], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
        trackByInstallDir(game)
        return { ok: true, started: true, message: `${game.title} iniciado via Xbox` }
      }
    }
  } catch (e) {
    return { ok: false, message: `Falha ao iniciar: ${(e as Error).message}` }
  }
}

/** Abre a instalação na loja de origem. O Prisma não baixa jogos. */
export async function installGame(game: Game): Promise<LaunchResult> {
  try {
    switch (game.platform) {
      case 'steam':
        await shell.openExternal(`steam://install/${game.platformId}`)
        return { ok: true, message: `Instalação de ${game.title} aberta na Steam` }
      case 'epic':
        if (!game.launchUri) break
        await shell.openExternal(epicInstallUri(game.launchUri))
        return { ok: true, message: `Instalação de ${game.title} aberta na Epic Games` }
      case 'gog':
        await shell.openExternal(`goggalaxy://openGameView/${game.platformId}`)
        return { ok: true, message: `${game.title} aberto no GOG Galaxy` }
      case 'xbox':
        await shell.openExternal(`ms-windows-store://pdp/?PFN=${encodeURIComponent(game.platformId)}`)
        return { ok: true, message: `${game.title} aberto na Microsoft Store` }
      case 'manual':
        break
    }
  } catch (e) {
    return { ok: false, message: `Não foi possível abrir a loja: ${(e as Error).message}` }
  }
  return { ok: false, message: 'Este jogo não pode ser instalado pelo Prisma' }
}

function storeName(g: Game): string {
  return { steam: 'Steam', epic: 'Epic Games', gog: 'GOG', xbox: 'Xbox', manual: 'pasta' }[g.platform]
}
