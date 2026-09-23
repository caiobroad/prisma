import os from 'os'
import { app } from 'electron'
import { execFile } from 'child_process'

/**
 * Pede o fechamento dos processos configurados como pesados. Usa taskkill sem /F:
 * o programa recebe um pedido normal de fechamento e pode salvar o que estiver aberto.
 */
export async function closeHeavyProcesses(names: string[]): Promise<string[]> {
  const closed: string[] = []
  for (const raw of names) {
    const name = raw.trim()
    if (!name) continue
    const image = /\.exe$/i.test(name) ? name : `${name}.exe`
    const ok = await new Promise<boolean>((resolve) => {
      execFile('taskkill.exe', ['/IM', image, '/T'], { windowsHide: true, timeout: 8000 }, (err) => resolve(!err))
    })
    if (ok) closed.push(image)
  }
  return closed
}

/** Baixa (ou restaura) a prioridade de todos os processos do launcher enquanto o jogo roda. */
export function setLauncherPriority(low: boolean): void {
  const level = low ? os.constants.priority.PRIORITY_BELOW_NORMAL : os.constants.priority.PRIORITY_NORMAL
  for (const m of app.getAppMetrics()) {
    try {
      os.setPriority(m.pid, level)
    } catch {
      /* processo já encerrado ou sem permissão */
    }
  }
}

/** Memória total do launcher (processo principal, GPU e renderer), em bytes. */
export function launcherMemory(): number {
  return app.getAppMetrics().reduce((s, m) => s + (m.memory?.workingSetSize ?? 0) * 1024, 0)
}
