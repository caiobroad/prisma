import { memo } from 'react'
import { artStyle, monogram } from '../lib/covers'

/** Foto de perfil redonda; sem foto, monograma sobre um gradiente estável derivado do nome. */
export const Avatar = memo(function Avatar({ src, name, size = 40, ring }: { src: string | null; name: string; size?: number; ring?: string }) {
  const style = { width: size, height: size, fontSize: size * 0.38, '--ring': ring } as React.CSSProperties
  return src ? (
    <img className={`avatar ${ring ? 'ringed' : ''}`} src={src} alt="" style={style} draggable={false} />
  ) : (
    <span className={`avatar mono ${ring ? 'ringed' : ''}`} style={{ ...style, ...artStyle(name) }}>
      {monogram(name)}
    </span>
  )
})
