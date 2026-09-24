/**
 * Navegação espacial (setas do teclado e direcional do controle) fora do Modo Controle.
 * Escolhe o elemento focável mais próximo na direção pedida, dentro da camada de cima
 * (um modal aberto prende o foco), e rola até ele.
 */
export type Dir = 'left' | 'right' | 'up' | 'down'

const FOCUSABLE = 'button:not([disabled]), [role="button"][tabindex="0"], a[href], select, input:not([type="hidden"]), [data-nav]'

function layer(): HTMLElement {
  const layers = document.querySelectorAll<HTMLElement>('[data-nav-layer]')
  return layers.length ? layers[layers.length - 1] : ((document.querySelector('.stage') as HTMLElement | null) ?? document.body)
}

function visible(el: HTMLElement, vw: number, vh: number): DOMRect | null {
  if (el.closest('[inert], [aria-hidden="true"]')) return null
  const r = el.getBoundingClientRect()
  if (r.width < 2 || r.height < 2) return null
  if (r.bottom < -vh || r.top > vh * 2 || r.right < 0 || r.left > vw) return null
  return r
}

/** Marca a navegação por teclado/controle: o anel de foco aparece mesmo em foco programático. */
export function setNavMode(on: boolean): void {
  const d = document.documentElement.dataset
  if (on && d.nav !== 'keys') d.nav = 'keys'
  else if (!on && d.nav) delete d.nav
}

export function focusEl(el: HTMLElement): void {
  setNavMode(true)
  el.focus({ preventScroll: true })
  el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
}

/** Primeiro alvo razoável: a primeira capa visível, senão o primeiro botão da área principal. */
function entry(root: HTMLElement): HTMLElement | null {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const inMain = root.querySelector<HTMLElement>('.main') ?? root
  const cands = [...inMain.querySelectorAll<HTMLElement>('.gcard, ' + FOCUSABLE)]
  return cands.find((el) => {
    const r = visible(el, vw, vh)
    return r && r.top >= 0 && r.bottom <= vh
  }) ?? null
}

export function spatialMove(dir: Dir): boolean {
  const root = layer()
  const cur = document.activeElement as HTMLElement | null
  const inside = cur && cur !== document.body && root.contains(cur) && cur.matches(FOCUSABLE + ', .gcard')
  if (!inside) {
    const e = entry(root)
    if (e) focusEl(e)
    return !!e
  }
  // Campo de texto: setas horizontais movem o cursor do texto, não o foco.
  if (cur!.tagName === 'INPUT' && (dir === 'left' || dir === 'right')) return false
  if (cur!.tagName === 'SELECT' && (dir === 'up' || dir === 'down')) return false

  const vw = window.innerWidth
  const vh = window.innerHeight
  const a = cur!.getBoundingClientRect()
  const ax = a.left + a.width / 2
  const ay = a.top + a.height / 2
  let best: HTMLElement | null = null
  let bestScore = Infinity
  for (const el of root.querySelectorAll<HTMLElement>(FOCUSABLE)) {
    if (el === cur || cur!.contains(el) || el.contains(cur)) continue
    const r = visible(el, vw, vh)
    if (!r) continue
    const bx = r.left + r.width / 2
    const by = r.top + r.height / 2
    let main: number
    let cross: number
    // Precisa estar de fato do lado pedido (bordas, com 4 px de tolerância).
    if (dir === 'right') {
      if (r.left < a.right - 4) continue
      main = r.left - a.right
      cross = Math.max(0, Math.abs(by - ay) - (a.height + r.height) / 4)
    } else if (dir === 'left') {
      if (r.right > a.left + 4) continue
      main = a.left - r.right
      cross = Math.max(0, Math.abs(by - ay) - (a.height + r.height) / 4)
    } else if (dir === 'down') {
      if (r.top < a.bottom - 4) continue
      main = r.top - a.bottom
      cross = Math.max(0, Math.abs(bx - ax) - (a.width + r.width) / 4)
    } else {
      if (r.bottom > a.top + 4) continue
      main = a.top - r.bottom
      cross = Math.max(0, Math.abs(bx - ax) - (a.width + r.width) / 4)
    }
    const score = main + cross * 2.2
    if (score < bestScore) {
      bestScore = score
      best = el
    }
  }
  if (best) focusEl(best)
  return !!best
}

/** Ativa o elemento focado (Enter / A). */
export function activateFocused(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el || el === document.body || !layer().contains(el)) return false
  if (el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'checkbox') return false
  el.click()
  return true
}

// O mouse devolve o visual normal.
window.addEventListener('pointermove', () => setNavMode(false), { passive: true })
