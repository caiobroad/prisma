import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron'
import type { LaunchOptions, MainEvent, ManualGameInput, PrismaApi, Settings } from '@shared/types'

const api: PrismaApi = {
  games: {
    list: () => ipcRenderer.invoke('games:list'),
    scan: () => ipcRenderer.invoke('games:scan'),
    launch: (id, opts?: LaunchOptions) => ipcRenderer.invoke('games:launch', id, opts),
    install: (id) => ipcRenderer.invoke('games:install', id),
    toggleFavorite: (id) => ipcRenderer.invoke('games:toggleFavorite', id),
    setCompleted: (id, completed) => ipcRenderer.invoke('games:setCompleted', id, completed),
    remove: (id) => ipcRenderer.invoke('games:remove', id),
    addManual: (input: ManualGameInput) => ipcRenderer.invoke('games:addManual', input),
    pickExecutable: () => ipcRenderer.invoke('games:pickExecutable'),
    details: (id) => ipcRenderer.invoke('games:details', id),
    trailer: (id) => ipcRenderer.invoke('games:trailer', id),
    zoneColor: (id) => ipcRenderer.invoke('games:zoneColor', id),
    achievements: (id) => ipcRenderer.invoke('games:achievements', id),
    sessions: (id, limit) => ipcRenderer.invoke('games:sessions', id, limit),
    recentSessions: (limit) => ipcRenderer.invoke('games:recentSessions', limit),
    sources: () => ipcRenderer.invoke('games:sources'),
    resume: (id) => ipcRenderer.invoke('games:resume', id),
    community: (id) => ipcRenderer.invoke('games:community', id),
    reviews: (id) => ipcRenderer.invoke('games:reviews', id),
    workshop: (id) => ipcRenderer.invoke('games:workshop', id),
    lastPlayed: () => ipcRenderer.invoke('games:lastPlayed')
  },
  profiles: {
    list: () => ipcRenderer.invoke('profiles:list'),
    active: () => ipcRenderer.invoke('profiles:active'),
    needsPick: () => ipcRenderer.invoke('profiles:needsPick'),
    select: (id) => ipcRenderer.invoke('profiles:select', id),
    create: (nickname) => ipcRenderer.invoke('profiles:create', nickname),
    update: (id, patch) => ipcRenderer.invoke('profiles:update', id, patch),
    remove: (id) => ipcRenderer.invoke('profiles:remove', id),
    stats: (id) => ipcRenderer.invoke('profiles:stats', id),
    pickImage: (kind) => ipcRenderer.invoke('profiles:pickImage', kind)
  },
  friends: {
    list: () => ipcRenderer.invoke('friends:list'),
    library: (friendId) => ipcRenderer.invoke('friends:library', friendId),
    myLibrary: () => ipcRenderer.invoke('friends:myLibrary')
  },
  tagsFor: (appids) => ipcRenderer.invoke('tags:for', appids),
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
    openExternal: (url) => ipcRenderer.send('shell:openExternal', url),
    showInFolder: (p) => ipcRenderer.send('shell:showInFolder', p),
    pathForFile: (file) => {
      try {
        return webUtils.getPathForFile(file)
      } catch {
        return ''
      }
    },
    saveImage: (dataUrl, name) => ipcRenderer.invoke('shell:saveImage', dataUrl, name),
    copyImage: (dataUrl) => ipcRenderer.send('shell:copyImage', dataUrl)
  },
  store: {
    load: (force) => ipcRenderer.invoke('store:load', force),
    search: (term) => ipcRenderer.invoke('store:search', term)
  },
  emulators: {
    info: () => ipcRenderer.invoke('emulators:info'),
    set: (patch) => ipcRenderer.invoke('emulators:set', patch),
    detect: () => ipcRenderer.invoke('emulators:detect'),
    pick: (kind, target) => ipcRenderer.invoke('emulators:pick', kind, target),
    rescan: () => ipcRenderer.invoke('emulators:rescan')
  },
  update: {
    status: () => ipcRenderer.invoke('update:status'),
    changelog: (v) => ipcRenderer.invoke('update:changelog', v),
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'),
    openDownload: () => ipcRenderer.send('update:openDownload')
  },
  testAchievementPopup: () => ipcRenderer.send('achievement:test'),
  system: () => ipcRenderer.invoke('app:system'),
  dbRecovery: () => ipcRenderer.invoke('app:dbRecovery'),
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
