import { app, net, shell } from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'
import type { UpdateStatus } from '@shared/types'
import { anyRunning } from './sessions'
import { loadSettings } from './settings'

/**
 * Atualização pelo próprio launcher. As versões ficam nas releases do repositório público
 * (caiobroad/prisma); o app lê o latest.yml de lá, baixa o instalador em segundo plano e
 * instala ao fechar (ou na hora, se o usuário pedir). Nunca durante um jogo.
 * A versão portátil não consegue se substituir: só avisa e abre a página de download.
 */
const OWNER = 'caiobroad'
const REPO = 'prisma'
const FIRST_CHECK_MS = 45_000
const EVERY_MS = 6 * 3600_000

type Listener = (s: UpdateStatus) => void

const portable = !!process.env.PORTABLE_EXECUTABLE_DIR
// Teste em desenvolvimento: PRISMA_UPDATE_TEST=1 consulta o GitHub de verdade, sem baixar nada.
const devTest = !app.isPackaged && process.env.PRISMA_UPDATE_TEST === '1'
const enabled = app.isPackaged || devTest

let status: UpdateStatus = {
  state: enabled ? 'idle' : 'disabled',
  current: app.getVersion(),
  version: null,
  percent: null,
  notes: null,
  message: enabled ? null : 'Atualizações automáticas só na versão instalada.',
  checkedAt: null
}
let listener: Listener | null = null
let timer: NodeJS.Timeout | null = null
let checking: Promise<UpdateStatus> | null = null
let portableUrl: string | null = null

function set(patch: Partial<UpdateStatus>): void {
  status = { ...status, ...patch }
  listener?.(status)
}

/** Notas da release em texto simples (o GitHub devolve HTML). */
function notesOf(info: UpdateInfo): string | null {
  const raw = Array.isArray(info.releaseNotes) ? info.releaseNotes.map((n) => n.note ?? '').join('\n') : (info.releaseNotes ?? '')
  const text = String(raw)
    .replace(/<\/(p|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text ? text.slice(0, 1200) : null
}

/** "0.2.10" > "0.2.9" */
function newer(a: string, b: string): boolean {
  const pa = a.replace(/^v/, '').split('.').map(Number)
  const pb = b.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d > 0
  }
  return false
}

export function initUpdater(onStatus: Listener): void {
  listener = onStatus
  if (!enabled) return
  if (!portable) {
    autoUpdater.autoDownload = !devTest
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = false
    autoUpdater.logger = null
    if (devTest) autoUpdater.forceDevUpdateConfig = true
    autoUpdater.on('checking-for-update', () => set({ state: 'checking', message: null }))
    autoUpdater.on('update-not-available', () => set({ state: 'none', version: null, percent: null, checkedAt: Date.now() }))
    autoUpdater.on('update-available', (info) =>
      set({ state: devTest ? 'none' : 'downloading', version: info.version, notes: notesOf(info), percent: 0, checkedAt: Date.now(), message: devTest ? `Teste: ${info.version} disponível` : null })
    )
    autoUpdater.on('download-progress', (p) => set({ state: 'downloading', percent: Math.round(p.percent) }))
    autoUpdater.on('update-downloaded', (info) => set({ state: 'ready', version: info.version, notes: notesOf(info), percent: 100 }))
    autoUpdater.on('error', (e) => set({ state: 'error', message: friendly(e), checkedAt: Date.now() }))
  }
  timer = setTimeout(function tick() {
    void autoCheck()
    timer = setTimeout(tick, EVERY_MS)
    timer.unref?.()
  }, FIRST_CHECK_MS)
  timer.unref?.()
}

function friendly(e: unknown): string {
  const m = (e as Error)?.message ?? String(e)
  if (/ENOTFOUND|ECONN|ETIMEDOUT|net::/i.test(m)) return 'Sem conexão com o GitHub. Tenta de novo mais tarde.'
  if (/404/.test(m)) return 'Nenhuma versão publicada encontrada.'
  return m.split('\n')[0].slice(0, 160)
}

/** Verificação automática: respeita o ajuste do perfil e nunca roda com jogo aberto. */
async function autoCheck(): Promise<void> {
  if (!loadSettings().autoUpdate || anyRunning()) return
  if (status.state === 'downloading' || status.state === 'ready') return
  await checkNow().catch(() => undefined)
}

export function checkNow(): Promise<UpdateStatus> {
  if (!enabled) return Promise.resolve(status)
  if (checking) return checking
  checking = (async () => {
    if (status.state === 'ready') return status
    if (portable) {
      set({ state: 'checking', message: null })
      try {
        const res = await net.fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, {
          headers: { Accept: 'application/vnd.github+json' }
        })
        if (!res.ok) throw new Error(String(res.status))
        const rel = (await res.json()) as { tag_name: string; html_url: string; body?: string; assets?: Array<{ name: string; browser_download_url: string }> }
        const v = rel.tag_name.replace(/^v/, '')
        if (newer(v, app.getVersion())) {
          portableUrl = rel.assets?.find((a) => /portatil/i.test(a.name))?.browser_download_url ?? rel.html_url
          set({ state: 'portable', version: v, notes: rel.body?.slice(0, 1200) ?? null, checkedAt: Date.now() })
        } else set({ state: 'none', version: null, checkedAt: Date.now() })
      } catch (e) {
        set({ state: 'error', message: friendly(e), checkedAt: Date.now() })
      }
      return status
    }
    try {
      await autoUpdater.checkForUpdates()
    } catch (e) {
      set({ state: 'error', message: friendly(e), checkedAt: Date.now() })
    }
    return status
  })().finally(() => (checking = null))
  return checking
}

export function getUpdateStatus(): UpdateStatus {
  return status
}

/** Instala a versão baixada: fecha o Prisma, roda o instalador em silêncio e reabre. */
export function installNow(prepareQuit: () => void): { ok: boolean; message: string } {
  if (status.state !== 'ready') return { ok: false, message: 'Nenhuma atualização pronta para instalar.' }
  if (anyRunning()) return { ok: false, message: 'Feche o jogo antes de atualizar.' }
  prepareQuit()
  setImmediate(() => autoUpdater.quitAndInstall(true, true))
  return { ok: true, message: `Instalando o Prisma ${status.version}…` }
}

export function openPortableDownload(): void {
  void shell.openExternal(portableUrl ?? `https://github.com/${OWNER}/${REPO}/releases/latest`)
}

export function stopUpdater(): void {
  if (timer) clearTimeout(timer)
  timer = null
}
