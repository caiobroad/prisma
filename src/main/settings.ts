import { app } from 'electron'
import { DEFAULT_SETTINGS, type Settings } from '@shared/types'
import { getSetting, setSetting } from './db/games'

const KEY = 'settings'

export function loadSettings(): Settings {
  try {
    const raw = getSetting(KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const s = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
    // O atalho antigo (Ctrl+Shift+N) roubava "nova janela anônima" do Chrome e "nova pasta" do Explorer.
    if (s.globalShortcut === 'Control+Shift+N') s.globalShortcut = DEFAULT_SETTINGS.globalShortcut
    return s
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...loadSettings(), ...patch }
  setSetting(KEY, JSON.stringify(next))
  applySystemSettings(next)
  return next
}

/** Reflete no sistema o que depende dele: iniciar com o Windows. */
export function applySystemSettings(s: Settings): void {
  if (!app.isPackaged) return // em desenvolvimento o executável é o do Electron, não faz sentido registrar
  try {
    app.setLoginItemSettings({
      openAtLogin: s.launchOnStartup,
      args: ['--hidden']
    })
  } catch {
    /* sem permissão para escrever no registro de inicialização */
  }
}
