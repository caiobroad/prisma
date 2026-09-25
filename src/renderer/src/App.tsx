import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { Friend, Game } from '@shared/types'
import { TitleBar } from './components/TitleBar'
import { SECTION_ORDER, Sidebar, type Section } from './components/Sidebar'
import { Toast } from './components/Toast'
import { AddGameSheet } from './components/AddGameSheet'
import { ZoneBackdrop } from './components/ZoneBackdrop'
import { PerformanceCenter } from './components/PerformanceCenter'
import { LaunchCinematic } from './components/LaunchCinematic'
import { IdleShowcase } from './components/IdleShowcase'
import { ProfileSelect } from './components/ProfileSelect'
import { StartIntro } from './components/StartIntro'
import { UpdateBanner, WhatsNew } from './components/UpdateBanner'
import { HomeView, pickFeatured } from './views/HomeView'
import { LibraryView, type LibPlatform } from './views/LibraryView'
import { RecentView } from './views/RecentView'
import { FavoritesView } from './views/FavoritesView'
import { GamePage } from './views/GamePage'
import { moodZone, presetFor, zoneFor, zoneStyle } from './lib/zones'
import { getState, initStore, scan, setState, toast, useStore } from './lib/store'
import type { ProfileTab } from './views/ProfileView'
import { useGamepad, useIdle, type PadAction } from './lib/input'
import { activateFocused, setNavMode, spatialMove } from './lib/nav'
import { rumble, sfx } from './lib/sounds'

// Telas pesadas ou pouco visitadas só são baixadas/avaliadas quando abertas.
const PerformanceView = lazy(() => import('./views/PerformanceView').then((m) => ({ default: m.PerformanceView })))
const SettingsView = lazy(() => import('./views/SettingsView').then((m) => ({ default: m.SettingsView })))
const ProfileView = lazy(() => import('./views/ProfileView').then((m) => ({ default: m.ProfileView })))
const FriendsView = lazy(() => import('./views/FriendsView').then((m) => ({ default: m.FriendsView })))
const CollectionView = lazy(() => import('./views/CollectionView').then((m) => ({ default: m.CollectionView })))
const StoreView = lazy(() => import('./views/StoreView').then((m) => ({ default: m.StoreView })))
const CreditsView = lazy(() => import('./views/CreditsView').then((m) => ({ default: m.CreditsView })))
const ControllerMode = lazy(() => import('./components/ControllerMode').then((m) => ({ default: m.ControllerMode })))

type DocWithVT = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } }
const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Toda troca de tela passa por aqui: View Transitions na GPU (a área principal se dissolve
 * e sobe; a capa clicada vira o banner da página). O sentido (avançar/voltar) muda o movimento.
 */
function transition(update: () => void, after?: () => void, dir: 'fwd' | 'back' = 'fwd'): void {
  const doc = document as DocWithVT
  const s = getState()
  if (!doc.startViewTransition || reducedMotion() || (s.settings.performanceMode && s.gameActive) || s.background) {
    update()
    after?.()
    return
  }
  document.documentElement.dataset.vt = dir
  doc
    .startViewTransition(() => flushSync(update))
    .finished.finally(() => {
      delete document.documentElement.dataset.vt
      after?.()
    })
}

initStore()

const isTyping = (): boolean => {
  const el = document.activeElement as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
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
  const picking = useStore((s) => s.pickingProfile)
  const profileId = useStore((s) => s.profile?.id ?? null)
  const intro = useStore((s) => s.intro)

  const [section, setSection] = useState<Section>('home')
  const [platform, setPlatform] = useState<LibPlatform>('all')
  const [query, setQueryState] = useState('')
  const [adding, setAdding] = useState(false)
  const [pageId, setPageId] = useState<number | null>(null)
  const [heroKey, setHeroKey] = useState<string | null>(null)
  const [hovered, setHovered] = useState<Game | null>(null)
  const [controller, setController] = useState(false)
  const [padFocus, setPadFocus] = useState<Game | null>(null)
  const [showcaseGame, setShowcaseGame] = useState<Game | null>(null)
  const [friend, setFriend] = useState<Friend | null>(null)
  const [colors, setColors] = useState<Record<number, string>>({})
  const [profileTab, setProfileTab] = useState<ProfileTab>('overview')
  const [settingsAnchor, setSettingsAnchor] = useState<string | null>(null)
  const origin = useRef<string | null>(null)
  const hoverTimer = useRef<number | null>(null)

  const page = pageId != null ? (byId.get(pageId) ?? null) : null
  const featured = useMemo(() => pickFeatured(games), [games])

  useEffect(() => {
    document.documentElement.dataset.glass = settings.glassEffect ? 'on' : 'off'
  }, [settings.glassEffect])

  // Outro perfil entrou: volta ao início, sem página aberta.
  useEffect(() => {
    setSection('home')
    setPageId(null)
    setFriend(null)
    setQueryState('')
  }, [profileId])

  // ---------- navegação ----------

  const openGame = useCallback((g: Game, key: string) => {
    origin.current = key
    flushSync(() => setHeroKey(key))
    transition(() => {
      setHeroKey(null)
      setPageId(g.id)
    })
  }, [])

  const openFromSearch = useCallback((g: Game) => {
    origin.current = null
    transition(() => setPageId(g.id))
  }, [])

  const back = useCallback(() => {
    const key = origin.current
    transition(
      () => {
        setPageId(null)
        setHeroKey(key)
      },
      () => setHeroKey(null),
      'back'
    )
  }, [])

  const goSection = useCallback((target: Section) => {
    // A Timeline Gamer mora no Perfil.
    const s: Section = target === 'timeline' ? 'profile' : target
    transition(() => {
      setPageId(null)
      setSection(s)
      if (s === 'profile') setProfileTab(target === 'timeline' ? 'timeline' : 'overview')
      if (s !== 'settings') setSettingsAnchor(null)
      if (s === 'library' || s === 'installed') setPlatform('all')
      if (s !== 'profile') setFriend(null)
    })
  }, [])

  const openFriend = useCallback((f: Friend) => {
    transition(() => {
      setPageId(null)
      setFriend(f)
      setSection('profile')
    })
  }, [])

  const openProfile = useCallback(() => {
    transition(() => {
      setPageId(null)
      setFriend(null)
      setProfileTab('overview')
      setSection('profile')
    })
  }, [])

  /** L2/R2 (ou Ctrl+↑/↓): tela anterior/seguinte do menu. */
  const cycleSection = useCallback(
    (dir: 1 | -1) => {
      const i = SECTION_ORDER.indexOf(section)
      const next = SECTION_ORDER[(Math.max(0, i) + dir + SECTION_ORDER.length) % SECTION_ORDER.length]
      transition(
        () => {
          setPageId(null)
          setFriend(null)
          setSection(next)
          if (next === 'library' || next === 'installed') setPlatform('all')
        },
        undefined,
        dir === 1 ? 'fwd' : 'back'
      )
    },
    [section]
  )

  /** Ajustes já rolando até um cartão (chaves de API, emuladores). */
  const goSettings = useCallback((anchor?: string) => {
    transition(() => {
      setPageId(null)
      setFriend(null)
      setSection('settings')
      setSettingsAnchor(anchor ?? null)
    })
  }, [])

  const goPlatform = useCallback((p: LibPlatform) => {
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
      setSection((s) => (s === 'installed' ? s : 'library'))
    }
  }, [])

  const onHover = useCallback((g: Game | null) => {
    if (!getState().settings.zoneHoverPreview) return
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current)
    hoverTimer.current = window.setTimeout(() => setHovered(g), g ? 380 : 250)
  }, [])

  // Voltar: página do jogo → lista; perfil de amigo → amigos.
  const goBack = useCallback((): boolean => {
    if (pageId != null) {
      back()
      return true
    }
    if (section === 'profile' && friend) {
      transition(() => {
        setFriend(null)
        setSection('friends')
      }, undefined, 'back')
      return true
    }
    return false
  }, [pageId, section, friend, back])

  // ---------- teclado, mouse e controle ----------

  useEffect(() => {
    if (controller || picking) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'F11') {
        e.preventDefault()
        window.nexus.window.toggleFullscreen()
      } else if (e.key === 'F5') {
        e.preventDefault()
        void scan()
      } else if (e.key === 'Escape' && !adding && !getState().launch) {
        if (!goBack() && getState().win.fullscreen) window.nexus.window.toggleFullscreen()
      } else if (e.altKey && e.key === 'ArrowLeft') {
        goBack()
      } else if (e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Tab') && !adding) {
        e.preventDefault()
        cycleSection(e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey) ? -1 : 1)
      } else if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.startsWith('Arrow') && !isTyping() && !getState().launch) {
        const dir = e.key.slice(5).toLowerCase() as 'left' | 'right' | 'up' | 'down'
        if (spatialMove(dir)) e.preventDefault()
      }
    }
    const onMouse = (e: MouseEvent): void => {
      if (e.button === 3) goBack()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mouseup', onMouse)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mouseup', onMouse)
    }
  }, [controller, picking, adding, goBack, cycleSection])

  // Fora do Modo Controle o controle também navega: direcional move o foco, A confirma,
  // B volta, L2/R2 (ou L1/R1) trocam de tela e Start abre o Modo Controle.
  const onPad = useCallback(
    (a: PadAction) => {
      if (getState().launch) return
      if (a === 'start') {
        if (!getState().pickingProfile) setController(true)
        return
      }
      if (a === 'left' || a === 'right' || a === 'up' || a === 'down') {
        if (spatialMove(a)) sfx('move')
      } else if (a === 'confirm') {
        if (activateFocused()) {
          sfx('confirm')
          rumble('light')
        }
      } else if (a === 'back') {
        if (goBack()) sfx('back')
      } else if (!getState().pickingProfile && (a === 'lt' || a === 'lb' || a === 'rt' || a === 'rb')) {
        sfx('tab')
        setNavMode(true)
        cycleSection(a === 'lt' || a === 'lb' ? -1 : 1)
      }
    },
    [goBack, cycleSection]
  )
  useGamepad(onPad, !controller, { sensitivity: settings.controller.sensitivity })

  useEffect(() => {
    const onPadConn = (): void => toast('Controle conectado · direcional navega, Start/Options abre o Modo Controle')
    window.addEventListener('gamepadconnected', onPadConn)
    return () => window.removeEventListener('gamepadconnected', onPadConn)
  }, [])

  const exitController = useCallback(() => setController(false), [])

  // ---------- vitrine ociosa ----------

  // Só com o launcher em foco: se você está em outro programa, a vitrine só gastaria recursos.
  const idleEnabled =
    settings.idleShowcase && loaded && focused && !adding && !launch && !background && !gameActive && !picking && !controller && games.length > 0
  const [idle] = useIdle(settings.idleSeconds * 1000, idleEnabled)
  const onSlide = useCallback((g: Game | null) => setShowcaseGame(g), [])

  // ---------- Mood e Modo Zona ----------

  const base = useMemo(() => moodZone(settings.mood), [settings.mood])
  const zoneGame: Game | null =
    !settings.zoneMode || picking
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

  const zone = useMemo(() => (zoneGame ? zoneFor(zoneGame, zoneGame.zoneColor ?? colors[zoneGame.id] ?? null, base) : base), [zoneGame, colors, base])

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
    controller ? 'is-controller' : '',
    picking ? 'is-picking' : ''
  ].join(' ')

  return (
    <div className={appClass} style={zoneStyle(zone) as React.CSSProperties} data-sheen={zone.sheen > 0.05 ? '1' : '0'} data-mood={settings.mood}>
      <ZoneBackdrop zone={zone} particles={settings.zoneParticles && !lite} paused={particlesPaused} lowFps={settings.performanceMode} light={false} />

      {picking ? (
        intro ? (
          <StartIntro onDone={() => setState({ intro: false })} />
        ) : (
          <ProfileSelect />
        )
      ) : controller ? (
        <Suspense fallback={null}>
          <ControllerMode onExit={exitController} onFocusGame={setPadFocus} />
        </Suspense>
      ) : (
        <div className="stage">
          <TitleBar
            query={query}
            onQuery={setQuery}
            onOpenGame={openFromSearch}
            canBack={pageId != null || (section === 'profile' && !!friend)}
            onBack={() => void goBack()}
            onController={() => setController(true)}
            onProfile={openProfile}
            onSettings={() => goSettings()}
            onPerformance={() => goSection('performance')}
            settingsOn={section === 'settings' || section === 'credits'}
          />
          <Sidebar section={section} onSection={goSection} viewingFriend={section === 'profile' && !!friend} onAdd={() => setAdding(true)} onController={() => setController(true)} />
          <main className="main">
            <div className={`section ${page ? 'covered' : ''}`} inert={page ? true : undefined}>
              <Suspense fallback={<div className="view-loading" />}>
                {section === 'home' ? (
                  <HomeView featured={featured} heroKey={heroKey} onOpen={openGame} onHover={onHover} onGoLibrary={() => goSection('library')} onGoInstalled={() => goSection('installed')} />
                ) : null}
                {section === 'library' || section === 'installed' ? (
                  <LibraryView
                    key={section}
                    query={query}
                    onQuery={setQuery}
                    platform={platform}
                    onPlatform={goPlatform}
                    heroKey={heroKey}
                    onOpen={openGame}
                    onHover={onHover}
                    onAdd={() => setAdding(true)}
                    installedOnly={section === 'installed'}
                    onCollection={() => goSection('collection')}
                    onSettings={goSettings}
                  />
                ) : null}
                {section === 'emulation' ? (
                  <LibraryView
                    key="emulation"
                    emuOnly
                    query={query}
                    onQuery={setQuery}
                    platform="emu"
                    onPlatform={goPlatform}
                    heroKey={heroKey}
                    onOpen={openGame}
                    onHover={onHover}
                    onAdd={() => setAdding(true)}
                    onSettings={goSettings}
                  />
                ) : null}
                {section === 'collection' ? <CollectionView heroKey={heroKey} onOpen={openGame} onHover={onHover} onLibrary={() => goSection('library')} /> : null}
                {section === 'recent' ? <RecentView heroKey={heroKey} onOpen={openGame} onHover={onHover} /> : null}
                {section === 'favorites' ? <FavoritesView heroKey={heroKey} onOpen={openGame} onHover={onHover} /> : null}
                {section === 'store' ? <StoreView onSettings={() => goSettings('api-keys')} /> : null}
                {section === 'friends' ? <FriendsView onFriend={openFriend} onSettings={() => goSettings('api-keys')} /> : null}
                {section === 'profile' ? (
                  <ProfileView key={friend?.id ?? 'me'} friend={friend} onFriend={openFriend} onFriends={() => goSection('friends')} tab={profileTab} onTab={setProfileTab} onOpen={openGame} />
                ) : null}
                {section === 'performance' ? <PerformanceView /> : null}
                {section === 'settings' ? <SettingsView onCredits={() => goSection('credits')} anchor={settingsAnchor} /> : null}
                {section === 'credits' ? <CreditsView /> : null}
              </Suspense>
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
      {!picking && !controller ? <UpdateBanner /> : null}
      {!picking && !controller ? <WhatsNew /> : null}
      <Toast />
    </div>
  )
}
