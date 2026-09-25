import { app } from 'electron'
import { DEFAULT_CONTROLLER, DEFAULT_SETTINGS, type Settings } from '@shared/types'
import { getSetting, setSetting } from './db/games'
import { activeProfileId } from './profiles'

/** Ajustes do perfil ativo (antes da seleção de perfil, os do último perfil usado). */
function key(): string {
  const id = activeProfileId()
  // Sem perfil ainda (PC novo): guarda à parte; o primeiro perfil criado herda.
  return id == null ? 'settings:pending' : `settings:${id}`
}

export function loadSettings(): Settings {
  try {
    const raw = getSetting(key()) ?? getSetting('settings') ?? getSetting('settings:pending')
    if (!raw) return structuredClone(DEFAULT_SETTINGS)
    const saved = JSON.parse(raw) as Partial<Settings> & { theme?: string }
    const s: Settings = { ...DEFAULT_SETTINGS, ...saved, controller: { ...DEFAULT_CONTROLLER, ...(saved.controller ?? {}) } }
    // O atalho antigo (Ctrl+Shift+N) roubava "nova janela anônima" do Chrome e "nova pasta" do Explorer.
    if (s.globalShortcut === 'Control+Shift+N') s.globalShortcut = DEFAULT_SETTINGS.globalShortcut
    return s
  } catch {
    return structuredClone(DEFAULT_SETTINGS)
  }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const cur = loadSettings()
  const next: Settings = { ...cur, ...patch, controller: { ...cur.controller, ...(patch.controller ?? {}) } }
  setSetting(key(), JSON.stringify(next))
  applySystemSettings(next)
  return next
}

/** Reflete no sistema o que depende dele: iniciar com o Windows. */
export function applySystemSettings(s: Settings): void {
  if (!app.isPackaged) return
  try {
    app.setLoginItemSettings({ openAtLogin: s.launchOnStartup, args: ['--hidden'] })
  } catch {
    /* sem permissão para escrever no registro de inicialização */
  }
}
