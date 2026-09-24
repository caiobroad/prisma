import { existsSync, watch, type FSWatcher } from 'fs'
import { join } from 'path'
import { findSteamPath, libraryFolders } from './scanners/steam'
import { anyRunning } from './sessions'

/**
 * Sincronização automática: sem botão. Além da varredura ao abrir e a cada 30 minutos,
 * o Prisma observa as pastas de manifestos da Steam (appmanifest_*.acf) e da Epic e
 * sincroniza sozinho 8 s depois de uma instalação, atualização ou desinstalação.
 * Nunca durante um jogo (a Steam mexe nos manifestos enquanto o jogo roda).
 */
const watchers: FSWatcher[] = []
let timer: NodeJS.Timeout | null = null

export async function startAutoSync(scan: () => unknown): Promise<void> {
  stopAutoSync()
  const dirs: string[] = []
  const steam = await findSteamPath()
  if (steam) for (const lib of libraryFolders(steam)) dirs.push(join(lib, 'steamapps'))
  dirs.push(join(process.env.ProgramData ?? 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests'))
  const trigger = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(function fire() {
      if (anyRunning()) {
        timer = setTimeout(fire, 60_000)
        return
      }
      timer = null
      void scan()
    }, 8000)
    timer.unref?.()
  }
  for (const d of dirs) {
    if (!existsSync(d)) continue
    try {
      const w = watch(d, (_ev, name) => {
        if (name && /\.(acf|item)$/i.test(name)) trigger()
      })
      w.on('error', () => undefined)
      watchers.push(w)
    } catch {
      /* pasta sem permissão */
    }
  }
}

export function stopAutoSync(): void {
  for (const w of watchers.splice(0)) w.close()
  if (timer) clearTimeout(timer)
  timer = null
}
