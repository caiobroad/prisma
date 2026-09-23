import { execFile } from 'child_process'

/** Executa um script PowerShell e devolve stdout como texto. Nunca lança: erros viram string vazia. */
export function powershell(script: string, timeoutMs = 20000): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 16 * 1024 * 1024, encoding: 'utf8' },
      (err, stdout) => {
        if (err) return resolve('')
        resolve(stdout ?? '')
      }
    )
  })
}

/** Executa um script PowerShell que devolve JSON e faz o parse com segurança. */
export async function powershellJson<T>(script: string, timeoutMs = 20000): Promise<T | null> {
  const out = await powershell(
    `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${script}`,
    timeoutMs
  )
  const trimmed = out.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed) as T
  } catch {
    return null
  }
}

/** Lê um valor do registro do Windows via reg.exe. Devolve null se não existir. */
export function regQuery(key: string, value: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      'reg.exe',
      ['query', key, '/v', value],
      { timeout: 5000, windowsHide: true, encoding: 'utf8' },
      (err, stdout) => {
        if (err) return resolve(null)
        const line = stdout.split(/\r?\n/).find((l) => l.trim().startsWith(value))
        if (!line) return resolve(null)
        const m = line.match(/REG_\w+\s+(.*)$/)
        resolve(m ? m[1].trim() : null)
      }
    )
  })
}

/** Lista as subchaves de uma chave do registro. */
export function regSubkeys(key: string): Promise<string[]> {
  return new Promise((resolve) => {
    execFile(
      'reg.exe',
      ['query', key],
      { timeout: 5000, windowsHide: true, encoding: 'utf8' },
      (err, stdout) => {
        if (err) return resolve([])
        resolve(
          stdout
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l.toUpperCase().startsWith(key.toUpperCase() + '\\'))
        )
      }
    )
  })
}

/** Lê todos os valores de uma chave como objeto. */
export function regValues(key: string): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    execFile(
      'reg.exe',
      ['query', key],
      { timeout: 5000, windowsHide: true, encoding: 'utf8' },
      (err, stdout) => {
        if (err) return resolve({})
        const out: Record<string, string> = {}
        for (const raw of stdout.split(/\r?\n/)) {
          const m = raw.match(/^\s{2,}(\S.*?)\s{2,}(REG_\w+)\s{2,}(.*)$/)
          if (m) out[m[1]] = m[3].trim()
        }
        resolve(out)
      }
    )
  })
}
