import type { Game, MoodId } from '@shared/types'
import { hexToHsl, hsl, luminance } from './color'

export type ParticleKind =
  | 'none'
  | 'dust'
  | 'ash'
  | 'embers'
  | 'fog'
  | 'cubes'
  | 'bubbles'
  | 'neon'
  | 'snow'
  | 'rain'
  | 'spores'
  | 'sparks'

/**
 * Atmosfera de uma zona. Só muda aparência: cor de destaque, iluminação do vidro,
 * fundo, partículas e efeitos de tela. O layout nunca muda.
 */
export interface ZoneTheme {
  id: string
  name: string
  accent: string
  accent2: string
  /** Cor do texto sobre o acento (botão Jogar). */
  onAccent: string
  /** Tom que ilumina o vidro. */
  tint: string
  /** Três manchas de luz do fundo. */
  bg: [string, string, string]
  /** 0–1: cone de luz dramática no topo. */
  light: number
  grain: number
  vignette: number
  fog: number
  /** 0–1: reflexo metálico que corre pelo vidro. */
  sheen: number
  particles: ParticleKind
  density: number
  /** Imagem desfocada ao fundo (banner do jogo). */
  backdrop: string | null
}

type Preset = Omit<ZoneTheme, 'onAccent' | 'backdrop' | 'id'> & { id: string; match: RegExp }

export const NEXUS_ZONE: ZoneTheme = {
  id: 'nexus',
  name: 'Prisma',
  accent: '#7c9cff',
  accent2: '#3dd9eb',
  onAccent: '#0b1020',
  tint: '#3f5bdb',
  bg: ['#3f5bdb', '#1fa8ba', '#7a4bd8'],
  light: 0.3,
  grain: 0.04,
  vignette: 0.35,
  fog: 0,
  sheen: 0,
  particles: 'dust',
  density: 0.35,
  backdrop: null
}

/** Ordem importa: os mais específicos primeiro. */
const PRESETS: Preset[] = [
  {
    id: 'resident-evil',
    name: 'Resident Evil',
    match: /resident evil|biohazard|\bre ?(2|3|4|village)\b/i,
    accent: '#d0262f',
    accent2: '#7a1016',
    tint: '#5a0b10',
    bg: ['#4a070b', '#140204', '#6e0f15'],
    light: 0.8,
    grain: 0.55,
    vignette: 0.9,
    fog: 0.15,
    sheen: 0,
    particles: 'ash',
    density: 0.7
  },
  {
    id: 'stalker',
    name: 'S.T.A.L.K.E.R.',
    match: /s\.?\s?t\.?\s?a\.?\s?l\.?\s?k\.?\s?e\.?\s?r|chernobyl|metro (2033|last light|exodus)/i,
    accent: '#a4bb5e',
    accent2: '#6b7a3c',
    tint: '#3e4a26',
    bg: ['#344020', '#12170a', '#4a5a28'],
    light: 0.35,
    grain: 0.32,
    vignette: 0.75,
    fog: 0.8,
    sheen: 0,
    particles: 'fog',
    density: 0.9
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    match: /cyberpunk|ghostrunner|ruiner|the ascent|cloudpunk|observer/i,
    accent: '#22e4ff',
    accent2: '#ff2bd6',
    tint: '#3a1a6c',
    bg: ['#3a0f75', '#07163a', '#7a0f66'],
    light: 0.6,
    grain: 0.12,
    vignette: 0.5,
    fog: 0.1,
    sheen: 0.2,
    particles: 'neon',
    density: 0.9
  },
  {
    id: 'minecraft',
    name: 'Minecraft',
    match: /minecraft|unturned|zumbi blocks|craftopia|lego/i,
    accent: '#72c74c',
    accent2: '#b9894f',
    tint: '#2d4a1e',
    bg: ['#2a5220', '#0d1a0a', '#4a6e2a'],
    light: 0.5,
    grain: 0.04,
    vignette: 0.45,
    fog: 0.08,
    sheen: 0,
    particles: 'cubes',
    density: 0.75
  },
  {
    id: 'doom',
    name: 'DOOM',
    match: /\bdoom\b|quake|ultrakill|wolfenstein/i,
    accent: '#ff3b1f',
    accent2: '#ffa33c',
    tint: '#5a1206',
    bg: ['#5c0e04', '#170403', '#8a1f06'],
    light: 0.85,
    grain: 0.15,
    vignette: 0.8,
    fog: 0,
    sheen: 1,
    particles: 'embers',
    density: 1
  },
  {
    id: 'souls',
    name: 'Terras Distantes',
    match: /elden ring|dark souls|sekiro|lords of the fallen|mortal shell|lies of p|jotunnslayer|for the king/i,
    accent: '#dcb45c',
    accent2: '#8a6a2e',
    tint: '#3d3018',
    bg: ['#4a3814', '#120e07', '#5e4618'],
    light: 0.6,
    grain: 0.3,
    vignette: 0.8,
    fog: 0.3,
    sheen: 0.15,
    particles: 'embers',
    density: 0.55
  },
  {
    id: 'ocean',
    name: 'Profundezas',
    match: /subnautica|abzu|submerged|bioshock|in other waters|raft/i,
    accent: '#2fd3e3',
    accent2: '#3a7bff',
    tint: '#0b3a52',
    bg: ['#064a66', '#021520', '#0a5a7a'],
    light: 0.55,
    grain: 0.05,
    vignette: 0.55,
    fog: 0.25,
    sheen: 0,
    particles: 'bubbles',
    density: 0.85
  },
  {
    id: 'hallownest',
    name: 'Reino Pálido',
    match: /hollow knight|silksong|ori and|dandara|pine\b/i,
    accent: '#bcd8ff',
    accent2: '#6b7cff',
    tint: '#1c2a4a',
    bg: ['#1f2c52', '#080c18', '#303d70'],
    light: 0.4,
    grain: 0.12,
    vignette: 0.75,
    fog: 0.35,
    sheen: 0,
    particles: 'spores',
    density: 0.75
  },
  {
    id: 'silent-hill',
    name: 'Névoa',
    match: /silent hill|the medium|death stranding/i,
    accent: '#c7c1b4',
    accent2: '#7d776b',
    tint: '#3a3833',
    bg: ['#4a4740', '#121110', '#5c5850'],
    light: 0.3,
    grain: 0.6,
    vignette: 0.85,
    fog: 0.9,
    sheen: 0,
    particles: 'ash',
    density: 0.6
  },
  {
    id: 'horror',
    name: 'Pesadelo',
    match:
      /dead space|callisto protocol|alien: isolation|outlast|layers of fear|among the sleep|five nights|fnaf|poppy playtime|project playtime|bendy|devour|\bscp\b|dark hours|in sound mind|hello neighbor|secret neighbor|dying light|dead island|stranger things|just die already/i,
    accent: '#e0483a',
    accent2: '#6a1f1a',
    tint: '#2a0e0c',
    bg: ['#3a0e0b', '#0a0303', '#4a150f'],
    light: 0.55,
    grain: 0.6,
    vignette: 0.9,
    fog: 0.35,
    sheen: 0,
    particles: 'ash',
    density: 0.55
  },
  {
    id: 'frost',
    name: 'Terras Geladas',
    match: /skyrim|elder scrolls|the long dark|frostpunk|valheim/i,
    accent: '#a6d0ea',
    accent2: '#e8f4ff',
    tint: '#1d3548',
    bg: ['#1e3a52', '#071018', '#2e4f6a'],
    light: 0.45,
    grain: 0.1,
    vignette: 0.6,
    fog: 0.3,
    sheen: 0.1,
    particles: 'snow',
    density: 0.85
  },
  {
    id: 'wild',
    name: 'Selva',
    match: /the forest|sons of the forest|green hell|\brust\b|\bark\b|muck|jurassic|thehunter|tomb raider|uncharted|far cry/i,
    accent: '#8cc063',
    accent2: '#d8b25e',
    tint: '#223a1a',
    bg: ['#2a4a1e', '#0a1407', '#46612a'],
    light: 0.45,
    grain: 0.15,
    vignette: 0.7,
    fog: 0.4,
    sheen: 0,
    particles: 'spores',
    density: 0.6
  },
  {
    id: 'racing',
    name: 'Velocidade',
    match: /forza|need for speed|rocket league|trackmania|horizon chase|cube racer|\bdirt\b|\bf1\b|burnout|gran turismo/i,
    accent: '#ff7a1a',
    accent2: '#2ec8ff',
    tint: '#3a1f0a',
    bg: ['#5a2408', '#0a0f1a', '#0a3a5a'],
    light: 0.5,
    grain: 0.05,
    vignette: 0.5,
    fog: 0,
    sheen: 0.45,
    particles: 'sparks',
    density: 0.8
  },
  {
    id: 'combat',
    name: 'Linha de Frente',
    match:
      /counter-strike|valorant|pubg|rainbow six|apex legends|arc raiders|farlight|combat master|hell let loose|rising storm|battlefront|squadrons|destiny|overwatch|marvel rivals|paladins|krunker|half-life|killing floor|red orchestra|payday|dungeonborne|pixel gun/i,
    accent: '#ffb02e',
    accent2: '#ff5a2e',
    tint: '#3a2710',
    bg: ['#4a2f0c', '#0f0a05', '#5a2a0c'],
    light: 0.6,
    grain: 0.18,
    vignette: 0.65,
    fog: 0.1,
    sheen: 0.25,
    particles: 'sparks',
    density: 0.55
  },
  {
    id: 'crime',
    name: 'Cidade Grande',
    match: /grand theft auto|\bgta\b|saints row|mafia|watch dogs|prison life|liar'?s bar/i,
    accent: '#5fd872',
    accent2: '#f5b83a',
    tint: '#1c3a22',
    bg: ['#1f4a2a', '#070d09', '#5a4214'],
    light: 0.45,
    grain: 0.12,
    vignette: 0.6,
    fog: 0.1,
    sheen: 0.2,
    particles: 'dust',
    density: 0.5
  },
  {
    id: 'party',
    name: 'Festa',
    match:
      /fortnite|fall guys|stumble guys|brawlhalla|ultimate chicken horse|golf with your friends|overcooked|among us|goose goose duck|crab game|\bpeak\b|r\.e\.p\.o|chained together|supermarket together|human fall flat|multiversus|knockout city|unrailed|bombanana|uncle marcus|one-armed/i,
    accent: '#a66bff',
    accent2: '#25d8ff',
    tint: '#2a1a52',
    bg: ['#3d1a7a', '#0a0a1f', '#0f4a6e'],
    light: 0.45,
    grain: 0.03,
    vignette: 0.35,
    fog: 0,
    sheen: 0.1,
    particles: 'sparks',
    density: 0.5
  },
  {
    id: 'portal',
    name: 'Aperture',
    match: /\bportal\b/i,
    accent: '#4aa8ff',
    accent2: '#ff9a2e',
    tint: '#1a2a3a',
    bg: ['#123a66', '#0a0d12', '#5a3410'],
    light: 0.5,
    grain: 0.05,
    vignette: 0.45,
    fog: 0,
    sheen: 0.35,
    particles: 'dust',
    density: 0.5
  }
]

export const ZONE_PRESETS = PRESETS.map(({ id, name, accent, accent2 }) => ({ id, name, accent, accent2 }))

function onAccentFor(hex: string): string {
  return luminance(hex) > 0.36 ? '#0b1020' : '#ffffff'
}

/** Tema derivado da cor dominante do banner, com partículas escolhidas pelo gênero. */
function derived(game: Game, color: string): Omit<ZoneTheme, 'backdrop'> {
  const { h, s } = hexToHsl(color)
  const sat = Math.max(0.55, Math.min(0.9, s))
  const accent = hsl(h, sat, 0.62)
  const genres = game.genres.join(' ').toLowerCase()
  let particles: ParticleKind = 'dust'
  let grain = 0.08
  let fog = 0.12
  if (/terror|horror/.test(genres)) {
    particles = 'ash'
    grain = 0.45
    fog = 0.35
  } else if (/corrida|racing/.test(genres)) particles = 'sparks'
  else if (/aventura|adventure|rpg/.test(genres)) particles = 'spores'
  else if (/simula|estrat/.test(genres)) particles = 'dust'
  return {
    id: `derived-${game.id}`,
    name: game.title,
    accent,
    accent2: hsl(h + 38, sat, 0.6),
    onAccent: onAccentFor(accent),
    tint: hsl(h, 0.55, 0.24),
    bg: [hsl(h, 0.65, 0.3), hsl(h + 25, 0.5, 0.1), hsl(h - 30, 0.55, 0.28)],
    light: 0.45,
    grain,
    vignette: 0.55,
    fog,
    sheen: 0,
    particles,
    density: 0.5
  }
}

export function presetFor(game: Game): Preset | null {
  return PRESETS.find((p) => p.match.test(game.title)) ?? null
}

export function zoneFor(game: Game | null, color: string | null, base: ZoneTheme = NEXUS_ZONE): ZoneTheme {
  if (!game) return base
  const backdrop = game.bannerUrl ?? game.coverUrl ?? null
  const p = presetFor(game)
  if (p) {
    const { match: _m, ...rest } = p
    return { ...rest, name: game.title, onAccent: onAccentFor(p.accent), backdrop }
  }
  if (color) return { ...derived(game, color), backdrop }
  return { ...base, id: `base-${game.id}`, name: game.title, backdrop }
}

/** Variáveis CSS aplicadas na raiz do app; registradas com @property para transicionar suavemente. */
export function zoneStyle(z: ZoneTheme): Record<string, string | number> {
  return {
    '--z-accent': z.accent,
    '--z-accent-2': z.accent2,
    '--z-on-accent': z.onAccent,
    '--z-tint': z.tint,
    '--z-bg-1': z.bg[0],
    '--z-bg-2': z.bg[1],
    '--z-bg-3': z.bg[2],
    '--z-light': z.light,
    '--z-grain': z.grain,
    '--z-vignette': z.vignette,
    '--z-fog': z.fog,
    '--z-sheen': z.sheen
  }
}

/**
 * Mood da Biblioteca: a atmosfera base do launcher quando nenhum jogo define a zona.
 * Sempre sobre o tema escuro; muda cores, iluminação, partículas e o tom do vidro.
 */
export const MOODS: Array<{ id: MoodId; name: string; hint: string }> = [
  { id: 'prisma', name: 'Prisma', hint: 'Luz fria e espectro' },
  { id: 'resident-evil', name: 'Resident Evil', hint: 'Vermelho, cinzas e granulado' },
  { id: 'silent-hill', name: 'Silent Hill', hint: 'Névoa densa e ferrugem' },
  { id: 'cyberpunk', name: 'Cyberpunk', hint: 'Neon ciano e magenta' },
  { id: 'stalker', name: 'S.T.A.L.K.E.R.', hint: 'Zona de exclusão, névoa radioativa' },
  { id: 'minecraft', name: 'Minecraft', hint: 'Grama, terra e blocos' },
  { id: 'doom', name: 'DOOM', hint: 'Brasas, metal e fogo' },
  { id: 'souls', name: 'Elden Ring', hint: 'Ouro envelhecido e brasas' }
]

export function moodZone(id: MoodId): ZoneTheme {
  if (id === 'prisma') return NEXUS_ZONE
  const p = PRESETS.find((x) => x.id === id)
  if (!p) return NEXUS_ZONE
  const { match: _m, ...rest } = p
  // Sem reflexo metálico no Mood: ele é uma animação em ciclo e o Mood fica ligado o tempo todo.
  return { ...rest, id: `mood-${id}`, name: MOODS.find((m) => m.id === id)?.name ?? rest.name, onAccent: onAccentFor(p.accent), backdrop: null, sheen: 0 }
}