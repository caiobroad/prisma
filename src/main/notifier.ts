import { BrowserWindow, screen } from 'electron'
import { existsSync, watch, type FSWatcher } from 'fs'
import { join } from 'path'
import type { Achievement, Game } from '@shared/types'
import { listAchievements } from './db/games'
import { syncSteamAchievements } from './achievements'
import { findSteamPath } from './scanners/steam'
import { loadSettings } from './settings'
import { ICON_PNG_256 } from './iconData'
import { isTracked } from './sessions'

/**
 * Notificação de conquista estilo console: um cartão no canto superior direito, por cima do
 * jogo (janela sem borda/tela cheia sem exclusividade), que não recebe foco nem cliques.
 * A janela só existe enquanto há notificação na fila e é destruída logo depois.
 * Fonte: o cliente Steam regrava appcache/stats/UserGameStats_<conta>_<appid>.bin a cada desbloqueio.
 */
const W = 400
const H = 108
const MARGIN = 24

let win: BrowserWindow | null = null
let ready: Promise<void> | null = null
let closeTimer: NodeJS.Timeout | null = null
const queue: Array<{ a: Achievement; title: string }> = []
let showing = false

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:transparent;overflow:hidden;font-family:"Segoe UI Variable Display","Segoe UI",system-ui,sans-serif;-webkit-user-select:none}
.card{position:absolute;right:8px;top:8px;width:${W - 16}px;height:${H - 16}px;box-sizing:border-box;display:flex;align-items:center;gap:14px;padding:12px 16px 12px 12px;
border-radius:16px;color:#fff;background:linear-gradient(135deg,rgba(24,26,40,.94),rgba(12,13,22,.94));border:1px solid rgba(255,255,255,.12);
box-shadow:0 18px 40px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.08);transform:translateX(120%);opacity:0;
transition:transform .5s cubic-bezier(.2,.9,.25,1.1),opacity .35s ease}
.card.in{transform:none;opacity:1}
.icon{width:64px;height:64px;border-radius:10px;flex:none;background:#222 center/cover;box-shadow:0 0 0 1px rgba(255,255,255,.1)}
.meta{min-width:0}
.k{display:flex;align-items:center;gap:6px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#9fb4ff;font-weight:600}
.k svg{width:14px;height:14px}
.n{font-size:16px;font-weight:600;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.g{font-size:12px;color:rgba(255,255,255,.6);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.shine{position:absolute;inset:0;border-radius:16px;overflow:hidden;pointer-events:none}
.shine:after{content:"";position:absolute;top:0;bottom:0;width:40%;left:-50%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.12),transparent);transform:skewX(-20deg)}
.card.in .shine:after{animation:s 1.1s .35s ease-out 1 forwards}
@keyframes s{to{left:130%}}
</style></head><body><div class="card" id="c"><div class="shine"></div><div class="icon" id="i"></div><div class="meta">
<div class="k"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>Conquista desbloqueada</div>
<div class="n" id="n"></div><div class="g" id="g"></div></div></div>
<script>
let ctx
function chime(){try{ctx=ctx||new AudioContext();const t=ctx.currentTime;[[880,0],[1318.5,.09],[1760,.18]].forEach(([f,d])=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0,t+d);g.gain.linearRampToValueAtTime(.12,t+d+.015);g.gain.exponentialRampToValueAtTime(.0001,t+d+.6);o.connect(g).connect(ctx.destination);o.start(t+d);o.stop(t+d+.65)})}catch(e){}}
window.show=(d)=>new Promise(r=>{const c=document.getElementById('c');document.getElementById('n').textContent=d.name;document.getElementById('g').textContent=d.game;
const i=document.getElementById('i');i.style.backgroundImage=d.icon?'url("'+d.icon.replace(/"/g,'')+'")':'';
c.classList.remove('in');void c.offsetWidth;c.classList.add('in');if(d.sound)chime();
setTimeout(()=>{c.classList.remove('in');setTimeout(r,500)},5200)})
</script></body></html>`

function ensureWin(): Promise<void> {
  if (win && !win.isDestroyed() && ready) return ready
  const area = screen.getPrimaryDisplay().workArea
  win = new BrowserWindow({
    width: W,
    height: H,
    x: area.x + area.width - W - MARGIN + 8,
    y: area.y + MARGIN - 8,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false, spellcheck: false }
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setIgnoreMouseEvents(true)
  const w = win
  ready = w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(PAGE)).then(() => {
    if (!w.isDestroyed()) w.showInactive()
  })
  w.on('closed', () => {
    if (win === w) {
      win = null
      ready = null
    }
  })
  return ready
}

async function pump(): Promise<void> {
  if (showing) return
  showing = true
  if (closeTimer) clearTimeout(closeTimer)
  try {
    while (queue.length) {
      const { a, title } = queue.shift()!
      await ensureWin()
      const s = loadSettings()
      const payload = JSON.stringify({ name: a.name, game: title, icon: a.icon, sound: s.achievementSound })
      await win?.webContents.executeJavaScript(`window.show(${payload})`).catch(() => undefined)
    }
  } finally {
    showing = false
    closeTimer = setTimeout(() => {
      win?.destroy()
      win = null
      ready = null
    }, 1500)
  }
}

export function notifyAchievement(a: Achievement, gameTitle: string): void {
  queue.push({ a, title: gameTitle })
  void pump()
}

export function testAchievementPopup(): void {
  notifyAchievement(
    { gameId: 0, apiName: 'TEST', name: 'Primeiro passo no Prisma', description: null, icon: ICON_PNG_256, unlockedAt: Date.now() },
    'Notificação de teste'
  )
}

// ---------- observação durante o jogo ----------

const watchers = new Map<number, { w: FSWatcher; timer: NodeJS.Timeout | null }>()

export async function watchAchievements(game: Game, onUnlocked: (a: Achievement) => void): Promise<void> {
  if (game.platform !== 'steam' || watchers.has(game.id)) return
  const sp = await findSteamPath()
  const dir = sp ? join(sp, 'appcache', 'stats') : null
  // A sessão pode ter acabado enquanto procurávamos a Steam: sem observador órfão.
  if (!dir || !existsSync(dir) || !isTracked(game.id) || watchers.has(game.id)) return
  const suffix = `_${game.platformId}.bin`
  try {
    const w = watch(dir, (_ev, name) => {
      if (!name || !name.startsWith('UserGameStats_') || !name.endsWith(suffix)) return
      const entry = watchers.get(game.id)
      if (!entry) return
      // O cliente grava o arquivo em partes: espera assentar antes de ler.
      if (entry.timer) clearTimeout(entry.timer)
      entry.timer = setTimeout(() => {
        entry.timer = null
        void diff(game.id).then((list) => {
          for (const a of list) {
            onUnlocked(a)
            if (loadSettings().achievementPopup) notifyAchievement(a, game.title)
          }
        })
      }, 700)
    })
    watchers.set(game.id, { w, timer: null })
  } catch {
    /* sem permissão para observar a pasta */
  }
}

export function unwatchAchievements(gameId: number): void {
  const e = watchers.get(gameId)
  if (!e) return
  if (e.timer) clearTimeout(e.timer)
  e.w.close()
  watchers.delete(gameId)
}

/** Conquistas que passaram a constar como desbloqueadas desde a última leitura. */
async function diff(gameId: number): Promise<Achievement[]> {
  const before = listAchievements(gameId)
  const had = new Set(before.filter((a) => a.unlockedAt != null).map((a) => a.apiName))
  await syncSteamAchievements([gameId])
  // Primeira leitura do jogo: não há como saber o que é novo.
  if (!before.length) return []
  return listAchievements(gameId).filter((a) => a.unlockedAt != null && !had.has(a.apiName))
}
