import { CapacitorHttp } from '@capacitor/core'
import { useQuery } from '@tanstack/react-query'
import { inCapacitor } from '@/lib/capacitor'

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
    // In Lumio's Android app, a picture the WebView would not let a canvas read (whatever the server or the connection
    // does about it) is fetched by the app itself instead.
    queryFn: async () => (await averageColor(readableUrl(url!))) ?? (inCapacitor() ? await averageColor(await nativeDataUrl(url!)) : null),
  })
}

/** The cover's average color, or null when the picture can't be loaded or read. */
function averageColor(src: string | null) {
  return new Promise<string | null>((resolve) => {
    if (!src) return resolve(null)
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
    image.src = src
  })
}

/** The picture as a data: address, fetched by the app (no CORS there), which a canvas may always read. */
async function nativeDataUrl(url: string) {
  try {
    const response = await CapacitorHttp.get({ url: new URL(url, window.location.href).toString(), responseType: 'blob' })
    if (response.status >= 400 || typeof response.data !== 'string') return null
    const type = Object.entries(response.headers).find(([name]) => name.toLowerCase() === 'content-type')?.[1] ?? 'image/jpeg'
    return `data:${type.split(';')[0]};base64,${response.data}`
  } catch {
    return null
  }
}

/**
 * The address to read an image's colors from. A Jellyfin picture from another address (the apps: their pages are on
 * https://localhost) may already sit in the cache from an ordinary <img>, which wasn't fetched for reading; the canvas
 * would get that copy and refuse. A query of its own makes it a request of its own (Jellyfin ignores the parameter).
 */
function readableUrl(url: string) {
  let parsed: URL
  try {
    // Not URL.parse: older WebViews don't have it.
    parsed = new URL(url, window.location.href)
  } catch {
    return url
  }
  if (parsed.origin === window.location.origin || !parsed.pathname.includes('/Items/')) return url
  parsed.searchParams.set('lumioColor', '1')
  return parsed.toString()
}
