/**
 * Quando não há arte oficial, a capa é gerada a partir do título:
 * um gradiente estável (mesmo título → mesmas cores) e um monograma.
 */
const PALETTES: Array<[string, string, string]> = [
  ['#1c2e6b', '#4c6fff', '#0b1224'],
  ['#5a1b6b', '#ff6a8b', '#1a0b24'],
  ['#0d3b3a', '#3dd9eb', '#061716'],
  ['#0f3a2a', '#5be3a0', '#06120c'],
  ['#3a2a0f', '#f5c86b', '#120c06'],
  ['#173b1e', '#8fdc7a', '#07110a'],
  ['#4a1a12', '#ff8e5b', '#160806'],
  ['#2a1f4a', '#c58bff', '#0c0816'],
  ['#0b2a45', '#5aa9ff', '#050f1c'],
  ['#3a1533', '#ff7ad9', '#14050f'],
  ['#0f2f3a', '#7fd6ff', '#04101a'],
  ['#2c2c2c', '#e9edf5', '#0a0a0a']
]

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function artStyle(title: string): React.CSSProperties {
  const g = PALETTES[hash(title) % PALETTES.length]
  return {
    background: `radial-gradient(120% 80% at 20% 15%, ${g[1]}cc, transparent 55%), radial-gradient(90% 70% at 85% 90%, ${g[1]}66, transparent 60%), linear-gradient(160deg, ${g[0]}, ${g[2]})`
  }
}

export function monogram(title: string): string {
  const words = title
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^(the|a|an|of|de|do|da|o|os|as|e|and|&)$/i.test(w))
  if (!words.length) return title.slice(0, 2).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
