import type { Game, Platform } from '@shared/types'

export const PF: Record<Platform, { name: string; color: string; letter: string }> = {
  steam: { name: 'Steam', color: 'var(--steam)', letter: 'S' },
  epic: { name: 'Epic Games', color: 'var(--epic)', letter: 'E' },
  gog: { name: 'GOG', color: 'var(--gog)', letter: 'G' },
  xbox: { name: 'Xbox PC', color: 'var(--xbox)', letter: 'X' },
  manual: { name: 'Manual', color: 'var(--manual)', letter: '+' }
}

export function formatPlaytime(seconds: number): string {
  if (seconds < 60) return seconds === 0 ? '0 min' : '< 1 min'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m} min`
  return `${h.toLocaleString('pt-BR')} h ${String(m).padStart(2, '0')} min`
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  return formatPlaytime(seconds)
}

export function relativeTime(ts: number | null): string {
  if (!ts) return 'nunca'
  const diff = Date.now() - ts
  const min = Math.round(diff / 60000)
  if (min < 1) return 'agora há pouco'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  const d = new Date(ts)
  const today = new Date()
  if (h < 24 && d.getDate() === today.getDate()) return `hoje, ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  const days = Math.max(1, Math.round(h / 24))
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  if (days < 30) {
    const w = Math.round(days / 7)
    return w === 1 ? 'há 1 semana' : `há ${w} semanas`
  }
  if (days < 365) {
    const mo = Math.round(days / 30)
    return mo === 1 ? 'há 1 mês' : `há ${mo} meses`
  }
  const y = Math.round(days / 365)
  return y === 1 ? 'há 1 ano' : `há ${y} anos`
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 6) return 'Boa madrugada'
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}

export function formatLongDate(ts: number): string {
  return new Date(ts).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatBytes(b: number | null): string {
  if (b == null || b <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = b
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: v >= 100 ? 0 : 1 })} ${units[i]}`
}

export function formatHours(seconds: number): string {
  const h = seconds / 3600
  if (h < 1) return `${Math.round(seconds / 60)} min`
  return `${h.toLocaleString('pt-BR', { maximumFractionDigits: h >= 100 ? 0 : 1 })} h`
}

export function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Última atividade conhecida: sessão no Prisma ou registro da loja. */
export function lastActivity(g: Game): number {
  return Math.max(g.lastPlayed ?? 0, g.platformLastPlayed ?? 0)
}

export function totalPlaytime(g: Game): number {
  return g.playtimeSeconds + g.platformPlaytimeSeconds
}
