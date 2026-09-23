import { useEffect, useRef, useState } from 'react'
import { attachTrailer, releaseTrailer } from '../lib/trailers'

/** Vídeo silencioso que aparece com fade só depois de começar a tocar. */
export function TrailerVideo({ url, className = '' }: { url: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    void attachTrailer(v, url)
    return () => releaseTrailer(v)
  }, [url])
  return (
    <video
      ref={ref}
      className={`trailer ${playing ? 'on' : ''} ${className}`}
      muted
      loop
      playsInline
      disablePictureInPicture
      preload="none"
      onPlaying={() => setPlaying(true)}
    />
  )
}
