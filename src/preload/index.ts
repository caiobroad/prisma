import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron'
import type { LaunchOptions, MainEvent, ManualGameInput, PrismaApi, Settings } from '@shared/types'

const api: PrismaApi = {
  games: {
    list: () => ipcRenderer.invoke('games:list'),
    scan: () => ipcRenderer.invoke('games:scan'),
    launch: (id, opts?: LaunchOptions) => ipcRenderer.invoke('games:launch', id, opts),
    install: (id) => ipcRenderer.invoke('games:install', id),
    toggleFavorite: (id) => ipcRenderer.invoke('games:toggleFavorite', id),
    remove: (id) => ipcRenderer.invoke('games:remove', id),
    addManual: (input: ManualGameInput) => ipcRenderer.invoke('games:addManual', input),
    pickExecutable: () => ipcRenderer.invoke('games:pickExecutable'),
    details: (id) => ipcRenderer.invoke('games:details', id),
    trailer: (id) => ipcRenderer.invoke('games:trailer', id),
    zoneColor: (id) => ipcRenderer.invoke('games:zoneColor', id),
    achievements: (id) => ipcRenderer.invoke('games:achievements', id),
    sessions: (id, limit) => ipcRenderer.invoke('games:sessions', id, limit),
    recentSessions: (limit) => ipcRenderer.invoke('games:recentSessions', limit),
    sources: () => ipcRenderer.invoke('games:sources')
  },
  timeline: () => ipcRenderer.invoke('timeline:data'),
  perf: {
    watch: (on) => ipcRenderer.send('perf:watch', on),
    last: () => ipcRenderer.invoke('perf:last')
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch: Partial<Settings>) => ipcRenderer.invoke('settings:set', patch)
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggleMaximize'),
    toggleFullscreen: () => ipcRenderer.send('window:toggleFullscreen'),
    close: () => ipcRenderer.send('window:close'),
    state: () => ipcRenderer.invoke('window:state')
  },
  shell: {
    openPath: (p) => ipcRenderer.invoke('shell:openPath', p),
    showInFolder: (p) => ipcRenderer.send('shell:showInFolder', p),
    pathForFile: (file) => {
      try {
        return webUtils.getPathForFile(file)
      } catch {
        return ''
      }
    }
  },
  on: (handler: (event: MainEvent) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, ev: MainEvent): void => handler(ev)
    ipcRenderer.on('nexus:event', listener)
    return () => ipcRenderer.removeListener('nexus:event', listener)
  },
  version: () => ipcRenderer.invoke('app:version'),
  memory: () => ipcRenderer.invoke('app:memory'),
  // Descarta o cache de imagens decodificadas do renderer (banners, capas, quadros de vídeo).
  releaseMemory: () => webFrame.clearCache()
}

contextBridge.exposeInMainWorld('nexus', api)
