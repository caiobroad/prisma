/**
 * Fade-in de capas e banners sobre um esqueleto. Imagem já decodificada (cache de memória,
 * ao rolar a grade virtual) aparece na hora; só as que chegam da rede ou do disco fazem fade.
 */
export function imgRef(el: HTMLImageElement | null): void {
  if (el && el.complete && el.naturalWidth > 0) el.classList.add('ready', 'instant')
}

export function imgLoad(e: React.SyntheticEvent<HTMLImageElement>): void {
  e.currentTarget.classList.add('ready')
}