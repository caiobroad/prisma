/**
 * Recorte de fotos de perfil no navegador. createImageBitmap aplica a orientação EXIF
 * (fotos de celular vêm "deitadas" com uma marca de rotação); o resultado é recortado ao
 * centro para o tamanho pedido e salvo em JPEG.
 */
export const AVATAR = { w: 256, h: 256, q: 0.88 }
export const BANNER = { w: 1600, h: 500, q: 0.82 }

async function bitmapFrom(src: Blob | string): Promise<ImageBitmap> {
  if (typeof src !== 'string') return createImageBitmap(src, { imageOrientation: 'from-image' })
  const img = new Image()
  img.src = src
  await img.decode()
  return createImageBitmap(img)
}

/** Recorta ao centro (cobrindo o quadro) e opcionalmente gira 90°, 180° ou 270° no sentido horário. */
export async function cropImage(src: Blob | string, size: { w: number; h: number; q: number }, rotate = 0): Promise<string> {
  const bmp = await bitmapFrom(src)
  const turns = ((rotate / 90) % 4 + 4) % 4
  // Dimensões da imagem já girada.
  const iw = turns % 2 ? bmp.height : bmp.width
  const ih = turns % 2 ? bmp.width : bmp.height
  const scale = Math.max(size.w / iw, size.h / ih)
  const cv = document.createElement('canvas')
  cv.width = size.w
  cv.height = size.h
  const ctx = cv.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(size.w / 2, size.h / 2)
  ctx.rotate((turns * Math.PI) / 2)
  ctx.scale(scale, scale)
  ctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2)
  bmp.close()
  return cv.toDataURL('image/jpeg', size.q)
}

export function blobFromBase64(base64: string, type: string): Blob {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}
