/**
 * Game DNA: o perfil de gosto de um jogador em seis eixos, calculado do histórico.
 * Cada jogo pesa pelas horas jogadas (h^0,7, para que um único jogo de 2000 h não apague
 * o resto) e contribui para os eixos que as tags da Steam indicam; tags mais relevantes
 * (as primeiras) pesam mais. Sem tags, usa os gêneros.
 */
export const DNA_AXES = ['RPG', 'FPS', 'Terror', 'Corrida', 'Estratégia', 'Sobrevivência'] as const
export type DnaAxis = (typeof DNA_AXES)[number]

const RULES: Record<DnaAxis, Array<[RegExp, number]>> = {
  RPG: [
    [/\b(j|c|mmo)?rpg\b|rpg de|soulslike|dungeon crawler/i, 1],
    [/personaliza[çc][ãa]o de personagem|escolhas importam/i, 0.35]
  ],
  FPS: [
    [/primeira pessoa \(fps\)|\bfps\b|tiro em arena|tiro de her[óo]is|tiro de extra[çc][ãa]o|tiro com saques|franco-atirador/i, 1],
    [/^tiro$|tiro t[áa]tico|tiro em terceira pessoa/i, 0.6]
  ],
  Terror: [
    [/terror|horror/i, 1],
    [/psicol[óo]gico|zumbis|sombrio|gore/i, 0.45]
  ],
  Corrida: [
    [/corrida|racing/i, 1],
    [/dire[çc][ãa]o|autom[óo]vel|motocicleta|off-road/i, 0.6]
  ],
  'Estratégia': [
    [/estrat[ée]gia|\brts\b|4x|t[áa]tica|tower defense|constru[çc][ãa]o de cidades|grande estrat/i, 1],
    [/gerenciamento|automa[çc][ãa]o|simula[çc][ãa]o econ/i, 0.5]
  ],
  'Sobrevivência': [
    [/sobreviv[êe]ncia|survival/i, 1],
    [/fabrica[çc][ãa]o|crafting|constru[çc][ãa]o de bases|mundo aberto com sobreviv/i, 0.45]
  ]
}

export interface DnaInput {
  tags: string[]
  hours: number
}

export interface Dna {
  /** 0–100, relativo ao eixo mais forte (forma do radar). */
  values: Record<DnaAxis, number>
  /** Fatia de cada eixo no total (0–1). */
  share: Record<DnaAxis, number>
  dominant: DnaAxis | null
  /** Horas que entraram na conta (jogos com tags ou gêneros). */
  hours: number
}

function gameScore(tags: string[]): Record<DnaAxis, number> {
  const out = { RPG: 0, FPS: 0, Terror: 0, Corrida: 0, 'Estratégia': 0, 'Sobrevivência': 0 } as Record<DnaAxis, number>
  tags.slice(0, 15).forEach((t, i) => {
    const rank = 1 / (1 + i * 0.18)
    for (const axis of DNA_AXES) {
      for (const [re, w] of RULES[axis]) {
        if (re.test(t)) {
          out[axis] = Math.max(out[axis], w * rank)
          break
        }
      }
    }
  })
  return out
}

export function computeDna(games: DnaInput[]): Dna {
  const raw = { RPG: 0, FPS: 0, Terror: 0, Corrida: 0, 'Estratégia': 0, 'Sobrevivência': 0 } as Record<DnaAxis, number>
  let hours = 0
  for (const g of games) {
    if (!g.tags.length || g.hours <= 0) continue
    const w = Math.pow(g.hours, 0.7)
    const s = gameScore(g.tags)
    let any = false
    for (const a of DNA_AXES) {
      if (s[a] > 0) any = true
      raw[a] += s[a] * w
    }
    if (any) hours += g.hours
  }
  const max = Math.max(...DNA_AXES.map((a) => raw[a]))
  const sum = DNA_AXES.reduce((n, a) => n + raw[a], 0)
  const values = {} as Record<DnaAxis, number>
  const share = {} as Record<DnaAxis, number>
  for (const a of DNA_AXES) {
    values[a] = max > 0 ? Math.round((raw[a] / max) * 100) : 0
    share[a] = sum > 0 ? raw[a] / sum : 0
  }
  const dominant = max > 0 ? DNA_AXES.reduce((b, a) => (raw[a] > raw[b] ? a : b), DNA_AXES[0]) : null
  return { values, share, dominant, hours }
}

/** Afinidade entre dois DNAs (0–100), pela semelhança de cosseno das fatias. */
export function dnaMatch(a: Dna, b: Dna): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (const k of DNA_AXES) {
    dot += a.share[k] * b.share[k]
    na += a.share[k] ** 2
    nb += b.share[k] ** 2
  }
  return na && nb ? Math.round((dot / Math.sqrt(na * nb)) * 100) : 0
}

export const DNA_TITLES: Record<DnaAxis, string> = {
  RPG: 'Aventureiro de mundos',
  FPS: 'Mira afiada',
  Terror: 'Caçador de sustos',
  Corrida: 'Piloto nato',
  'Estratégia': 'Estrategista',
  'Sobrevivência': 'Sobrevivente'
}
