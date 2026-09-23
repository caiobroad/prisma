import { nativeImage, type NativeImage } from 'electron'
import { ICON_PNG_256 } from './iconData'

let base: NativeImage | null = null

/** Ícone do Prisma (prisma com feixe de luz), redimensionado a partir do PNG de 256 px embutido. */
export function makeAppIcon(size = 32): NativeImage {
  base ??= nativeImage.createFromDataURL(ICON_PNG_256)
  return size >= 256 ? base : base.resize({ width: size, height: size, quality: 'best' })
}
