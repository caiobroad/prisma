import type { Platform } from '@shared/types'
import { steamScanner } from './steam'
import { epicScanner } from './epic'
import { gogScanner } from './gog'
import { xboxScanner } from './xbox'
import type { Scanner, ScannerOutput } from './types'

export const scanners: Scanner[] = [steamScanner, epicScanner, gogScanner, xboxScanner]

/** Roda todos os scanners em paralelo; uma falha em um não derruba os outros. */
export async function runAllScanners(): Promise<Record<Platform, ScannerOutput>> {
  const results = await Promise.all(
    scanners.map(async (s): Promise<[Platform, ScannerOutput]> => {
      try {
        return [s.platform, await s.scan()]
      } catch (e) {
        return [s.platform, { games: [], ok: false, detail: `erro: ${(e as Error).message}` }]
      }
    })
  )
  const out = {} as Record<Platform, ScannerOutput>
  for (const [p, r] of results) out[p] = r
  out.manual = { games: [], ok: true, detail: 'adicionados por você' }
  return out
}

export type { DetectedGame, Scanner, ScannerOutput } from './types'
