const KEY = 'prisma.intro'

/** A introdução de abertura vale para o PC (aparece antes de escolher o perfil). */
export function introEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function setIntroEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* armazenamento indisponível */
  }
}