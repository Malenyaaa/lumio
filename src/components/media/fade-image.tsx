import { useState, type ImgHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/** Image that fades in once loaded; the ref callback covers images served from cache before React attached onLoad. */
export function FadeImage({ className, onLoad, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState(false)
  return (
    <img
      {...props}
      ref={(node) => {
        if (node?.complete && node.naturalWidth > 0) setLoaded(true)
      }}
      onLoad={(event) => {
        setLoaded(true)
        onLoad?.(event)
      }}
      className={cn('transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0', className)}
    />
  )
}
