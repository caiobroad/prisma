import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { Game, Platform } from '@shared/types'
import { TitleBar } from './components/TitleBar'
import { Sidebar, type Section } from './components/Sidebar'
import { Toast } from './components/Toast'
import { AddGameSheet } from './components/AddGameSheet'
import { ZoneBackdrop } from './components/ZoneBackdrop'
import { PerformanceCenter } from './components/PerformanceCenter'
import { LaunchCinematic } from './components/LaunchCinematic'
import { IdleShowcase } from './components/IdleShowcase'
import { ControllerMode } from './components/ControllerMode'
import { HomeView, pickFeatured } from './views/HomeView'
import { LibraryView } from './views/LibraryView'
import { RecentView } from './views/RecentView'
import { FavoritesView } from './views/FavoritesView'
import { SettingsView } from './views/SettingsView'
import { TimelineView } from './views/TimelineView'
import { PerformanceView } from './views/PerformanceView'
import { GamePage } from './views/GamePage'
import { NEXUS_ZONE, presetFor, zoneFor, zoneStyle } from './lib/zones'
import { getState, initStore, scan, toast, useStore } from './lib/store'
import { useGamepad, useIdle } from './lib/input'

type DocWithVT = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } }
const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Troca de tela com View Transitions: a capa clicada se expande até virar o banner da página. */
function transition(update: () => void, after?: () => void): void {
  const doc = document as DocWithVT
  if (!doc.startViewTransition || reducedMotion() || getState().settings.performanceMode && getState().gameActive) {
    update()
    after?.()
    return
  }
  doc.startViewTransition(() => flushSync(update)).finished.finally(() => after?.())
}

initStore()

function useDarkTheme(): boolean {
  const theme = useStore((s) => s.settings.theme)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = (): void => setSystemDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const dark = theme === 'system' ? systemDark : theme === 'dark'
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])
  return dark
}

export default function App() {
  const games = useStore((s) => s.games)
  const byId = useStore((s) => s.byId)
  const settings = useStore((s) => s.settings)
  const launch = useStore((s) => s.launch)
  const gameActive = useStore((s) => s.gameActive)
  const background = useStore((s) => s.background)
  const focused = useStore((s) => s.focused)
  const fullscreen = useStore((s) => s.win.fullscreen)
  const loaded = useStore((s) => s.loaded)
  const dark = useDarkTheme()

  const [section, setSection] = useState<Section>('home')
  const [platform, setPlatform] = useState<Platform | 'all'>('all')
  const [query, setQueryState] = useState('')
  const [adding, setAdding] = useState(false)
  const [pageId, setPageId] = useState<number | null>(null)
  const [heroKey, setHeroKey] = useState<string | null>(null)
  const [hovered, setHovered] = useState<Game | null>(null)
  const [controller, setController] = useState(false)
  const [padFocus, setPadFocus] = useState<Game | null>(null)
  const [showcaseGame, setShowcaseGame] = useState<Game | null>(null)
  const [colors, setColors] = useState<Record<number, string>>({})
  const origin = useRef<string | null>(null)
  const hoverTimer = useRef<number | null>(null)

  const page = pageId != null ? (byId.get(pageId) ?? null) : null
  const featured = useMemo(() => pickFeatured(games), [games])

  useEffect(() => {
    document.documentElement.dataset.glass = settings.glassEffect ? 'on' : 'off'
  }, [settings.glassEffect])

  // ---------- navegação ----------

  const openGame = useCallback((g: Game, key: string) => {
    origin.current = key
    flushSync(() => setHeroKey(key))
    transition(() => {
      setHeroKey(null)
      setPageId(g.id)
    })
  }, [])

  const back = useCallback(() => {
    const key = origin.current
    transition(
      () => {
        setPageId(null)
        setHeroKey(key)
      },
      () => setHeroKey(null)
    )
  }, [])

  const goSection = useCallback((s: Section) => {
    transition(() => {
      setPageId(null)
      setSection(s)
      if (s === 'library') setPlatform('all')
    })
  }, [])

  const goPlatform = useCallback((p: Platform | 'all') => {
    transition(() => {
      setPageId(null)
      setSection('library')
      setPlatform(p)
    })
  }, [])

  const setQuery = useCallback((q: string) => {
    setQueryState(q)
    if (q.trim()) {
      setPageId(null)
      setSection('library')
    }
  }, [])

  const onHover = useCallback((g: Game | null) => {
    if (!getState().settings.zoneHoverPreview) return
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current)
    hoverTimer.current = window.setTimeout(() => setHovered(g), g ? 380 : 250)
  }, [])

  // ---------- teclado, mouse e controle ----------

  useEffect(() => {
    if (controller) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'F11') {
        e.preventDefault()
        window.nexus.window.toggleFullscreen()
      } else if (e.key === 'F5') {
        e.preventDefault()
        void scan()
      } else if (e.key === 'Escape' && !adding && !getState().launch) {
        if (pageId != null) back()
        else if (getState().win.fullscreen) window.nexus.window.toggleFullscreen()
      } else if (e.altKey && e.key === 'ArrowLeft' && pageId != null) back()
    }
    const onMouse = (e: MouseEvent): void => {
      if (e.button === 3 && pageId != null) back()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mouseup', onMouse)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mouseup', onMouse)
    }
  }, [controller, adding, pageId, back])

  // Start/Options no controle abre o Modo Controle.
  useGamepad((a) => {
    if (a === 'start' && !getState().launch) setController(true)
  }, !controller)

  useEffect(() => {
    const onPad = (): void => toast('Controle conectado · pressione Start/Options para o Modo Controle')
    window.addEventListener('gamepadconnected', onPad)
    return () => window.removeEventListener('gamepadconnected', onPad)
  }, [])

  const exitController = useCallback(() => setController(false), [])

  // ---------- vitrine ociosa ----------

  // Só com o launcher em foco: se você está em outro programa, a vitrine só gastaria recursos.
  const idleEnabled = settings.idleShowcase && loaded && focused && !adding && !launch && !background && !gameActive && games.length > 0
  const [idle] = useIdle(settings.idleSeconds * 1000, idleEnabled)
  const onSlide = useCallback((g: Game | null) => setShowcaseGame(g), [])

  // ---------- Modo Zona ----------

  const zoneGame: Game | null = !settings.zoneMode
    ? null
    : ((launch && launch.phase !== 'center' ? launch.game : null) ??
      (idle ? showcaseGame : null) ??
      (controller ? padFocus : null) ??
      page ??
      (settings.zoneHoverPreview ? hovered : null) ??
      (section === 'home' && pageId == null ? featured : null))

  useEffect(() => {
    if (!zoneGame || presetFor(zoneGame) || zoneGame.zoneColor || colors[zoneGame.id] || zoneGame.id >= 1_000_000) return
    let alive = true
    void window.nexus.games.zoneColor(zoneGame.id).then((c) => {
      if (alive && c) setColors((m) => ({ ...m, [zoneGame.id]: c }))
    })
    return () => {
      alive = false
    }
  }, [zoneGame, colors])

  const zone = useMemo(() => (zoneGame ? zoneFor(zoneGame, zoneGame.zoneColor ?? colors[zoneGame.id] ?? null) : NEXUS_ZONE), [zoneGame, colors])

  // Enquanto o jogo roda, o launcher não compete por recursos.
  const lite = gameActive && settings.performanceMode
  // Também pausa sob a vitrine e o Modo Controle, que cobrem a tela inteira com camadas opacas.
  const particlesPaused = background || gameActive || launch?.phase === 'playing' || idle || controller

  const appClass = [
    'app',
    fullscreen ? 'is-fullscreen' : '',
    lite ? 'lite' : '',
    launch && launch.phase !== 'center' ? `stage-${launch.phase}` : '',
    idle ? 'is-idle' : '',
    controller ? 'is-controller' : ''
  ].join(' ')

  return (
    <div className={appClass} style={zoneStyle(zone) as React.CSSProperties} data-sheen={zone.sheen > 0.05 ? '1' : '0'}>
      <ZoneBackdrop zone={zone} particles={settings.zoneParticles && !lite} paused={particlesPaused} lowFps={settings.performanceMode} light={!dark} />

      {controller ? (
        <ControllerMode onExit={exitController} onFocusGame={setPadFocus} />
      ) : (
        <div className="stage">
          <TitleBar
            query={query}
            onQuery={setQuery}
            canBack={pageId != null}
            onBack={back}
            zoneName={zoneGame ? zone.name : null}
            dark={dark}
            onController={() => setController(true)}
          />
          <Sidebar section={section} onSection={goSection} platform={platform} onPlatform={goPlatform} onAdd={() => setAdding(true)} />
          <main className="main">
            <div className={`section ${page ? 'covered' : ''}`} inert={page ? true : undefined}>
              {section === 'home' ? <HomeView featured={featured} heroKey={heroKey} onOpen={openGame} onHover={onHover} onGoLibrary={() => goSection('library')} /> : null}
              {section === 'library' ? (
                <LibraryView query={query} platform={platform} onPlatform={goPlatform} heroKey={heroKey} onOpen={openGame} onHover={onHover} onAdd={() => setAdding(true)} />
              ) : null}
              {section === 'recent' ? <RecentView heroKey={heroKey} onOpen={openGame} onHover={onHover} /> : null}
              {section === 'favorites' ? <FavoritesView heroKey={heroKey} onOpen={openGame} onHover={onHover} /> : null}
              {section === 'timeline' ? <TimelineView onOpen={openGame} /> : null}
              {section === 'performance' ? <PerformanceView /> : null}
              {section === 'settings' ? <SettingsView /> : null}
            </div>
            {page ? <GamePage key={page.id} game={page} onBack={back} /> : null}
          </main>
        </div>
      )}

      {adding ? (
        <AddGameSheet
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false)
            goSection('library')
          }}
        />
      ) : null}
      {launch?.phase === 'center' && launch.game ? <PerformanceCenter game={launch.game} /> : null}
      {launch && launch.phase !== 'center' ? <LaunchCinematic game={launch.game} phase={launch.phase} /> : null}
      {idle ? <IdleShowcase onSlide={onSlide} /> : null}
      <Toast />
    </div>
  )
}
