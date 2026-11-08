import { useQuery } from '@tanstack/react-query'

/**
 * The average color of an image, darkened enough for white text on top: the tint behind album and playlist headers
 * (as Spotify does). Computed on a tiny canvas; images the browser may not read (no CORS) just give no color.
 */
export function useDominantColor(url: string | undefined) {
  return useQuery({
    queryKey: ['dominant-color', url],
    enabled: !!url,
    staleTime: Infinity,
    retry: false,
    queryFn: () =>
      new Promise<string | null>((resolve) => {
        const image = new Image()
        image.crossOrigin = 'anonymous'
        image.onload = () => {
          try {
            const size = 16
            const canvas = document.createElement('canvas')
            canvas.width = size
            canvas.height = size
            const context = canvas.getContext('2d', { willReadFrequently: true })!
            context.drawImage(image, 0, 0, size, size)
            const { data } = context.getImageData(0, 0, size, size)
            let red = 0
            let green = 0
            let blue = 0
            let weight = 0
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i]!
              const g = data[i + 1]!
              const b = data[i + 2]!
              // Saturated pixels count more, so a colorful cover doesn't average out to grey.
              const saturation = Math.max(r, g, b) - Math.min(r, g, b)
              const w = 1 + saturation / 32
              red += r * w
              green += g * w
              blue += b * w
              weight += w
            }
            // Darkened so the header text stays readable on light covers too.
            const scale = Math.min(1, 150 / Math.max(red / weight, green / weight, blue / weight, 1))
            resolve(`rgb(${Math.round((red / weight) * scale)} ${Math.round((green / weight) * scale)} ${Math.round((blue / weight) * scale)})`)
          } catch {
            resolve(null)
          }
        }
        image.onerror = () => resolve(null)
        image.src = url!
      }),
  })
}
