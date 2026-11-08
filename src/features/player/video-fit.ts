import { useEffect, useState, type CSSProperties, type RefObject } from 'react'
import type { VideoFit } from '@/features/settings/local-settings'

/** The part of the frame that holds picture, as fractions of the full frame (burned-in black bars excluded). */
export interface PictureArea {
  x: number
  y: number
  width: number
  height: number
}

export const FULL_FRAME: PictureArea = { x: 0, y: 0, width: 1, height: 1 }

/** Width of the canvas frames are scaled down to; plenty to find bars, cheap to read back. */
const SAMPLE_WIDTH = 192
/** A pixel this bright (0–255 luma) counts as picture, darker as possibly bar. */
const BRIGHT = 28
/** A row/column is bar if fewer than this share of its pixels is bright (tolerates noise and stray logo pixels). */
const BRIGHT_SHARE = 0.015
/** Frames darker than this on average (fades, night scenes) say nothing reliable about bars. */
const MIN_MEAN_LUMA = 24
/** Bars thinner than this share of the frame are ignored (encoder edge noise, overscan lines). */
const MIN_BAR = 0.02
/** Share of bright pixels the area inside the bars needs; title cards (black with a little text) have far less. */
const MIN_CONTENT_BRIGHT = 0.4
/** Letterbox and pillarbox bars are centered: top and bottom (left and right) may differ by this much at most. */
const MAX_ASYMMETRY = 0.03
/** Valid frames needed before the area is trusted; they must come from different moments of the video. */
const SAMPLES_NEEDED = 4
/** Seconds of video between two samples that both count (a paused frame sampled again says nothing new). */
const MIN_SAMPLE_GAP = 2
const SAMPLE_EARLY_MS = 1500
const SAMPLE_LATE_MS = 5000

type Bars = { top: number; bottom: number; left: number; right: number }

/** Bars of one frame as fractions, or null when the frame is too dark to judge. */
function measureFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): Bars | null {
  const width = SAMPLE_WIDTH
  const height = Math.max(1, Math.round((SAMPLE_WIDTH * video.videoHeight) / video.videoWidth))
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.drawImage(video, 0, 0, width, height)
  // Throws a SecurityError when the frame isn't readable (cross-origin without CORS); the caller gives up then.
  const pixels = context.getImageData(0, 0, width, height).data

  const bright = new Uint8Array(width * height)
  let lumaSum = 0
  for (let i = 0; i < width * height; i++) {
    const luma = 0.299 * pixels[i * 4]! + 0.587 * pixels[i * 4 + 1]! + 0.114 * pixels[i * 4 + 2]!
    lumaSum += luma
    bright[i] = luma > BRIGHT ? 1 : 0
  }
  if (lumaSum / (width * height) < MIN_MEAN_LUMA) return null

  const rowIsBar = (row: number) => {
    let count = 0
    for (let col = 0; col < width; col++) count += bright[row * width + col]!
    return count < width * BRIGHT_SHARE
  }
  const colIsBar = (col: number) => {
    let count = 0
    for (let row = 0; row < height; row++) count += bright[row * width + col]!
    return count < height * BRIGHT_SHARE
  }

  let top = 0
  while (top < height && rowIsBar(top)) top++
  let bottom = 0
  while (bottom < height - top && rowIsBar(height - 1 - bottom)) bottom++
  let left = 0
  while (left < width && colIsBar(left)) left++
  let right = 0
  while (right < width - left && colIsBar(width - 1 - right)) right++

  // Almost nothing left: a mostly black frame (credits, a title card), not bars.
  if (top + bottom > height * 0.6 || left + right > width * 0.6) return null
  // Dark on all four sides is a title card or a dark scene with a bright center, not a picture inside bars.
  if (top > height * MIN_BAR && bottom > height * MIN_BAR && left > width * MIN_BAR && right > width * MIN_BAR) return null
  // Real bars are symmetric; a dark sky on top only is picture.
  if (Math.abs(top - bottom) > height * MAX_ASYMMETRY || Math.abs(left - right) > width * MAX_ASYMMETRY) return null
  // The area inside the bars has to actually look like picture.
  let inside = 0
  for (let row = top; row < height - bottom; row++) {
    for (let col = left; col < width - right; col++) inside += bright[row * width + col]!
  }
  const insideCount = (height - top - bottom) * (width - left - right)
  if (insideCount === 0 || inside / insideCount < MIN_CONTENT_BRIGHT) return null

  const fraction = (value: number, of: number) => (value / of < MIN_BAR ? 0 : value / of)
  return { top: fraction(top, height), bottom: fraction(bottom, height), left: fraction(left, width), right: fraction(right, width) }
}

/**
 * Finds black bars that are part of the video itself (a scope film encoded as 16:9, a 4:3 show pillarboxed to 16:9)
 * by sampling a few frames. Bars only ever shrink: each side keeps the smallest bar seen, so a dark scene can't crop
 * picture away. `streamKey` restarts the detection for a new stream.
 */
export function usePictureArea(video: RefObject<HTMLVideoElement | null>, enabled: boolean, streamKey: unknown): PictureArea {
  const [area, setArea] = useState(FULL_FRAME)
  const [areaKey, setAreaKey] = useState(streamKey)
  // A new stream starts from the full frame again (reset during render, not in an effect).
  if (areaKey !== streamKey) {
    setAreaKey(streamKey)
    setArea(FULL_FRAME)
  }

  useEffect(() => {
    const element = video.current
    if (!element || !enabled) return
    const canvas = document.createElement('canvas')
    let bars: Bars | null = null
    let samples = 0
    let lastSampledAt = -Infinity
    let timer: number | undefined

    const sample = () => {
      const moved = Math.abs(element.currentTime - lastSampledAt) >= MIN_SAMPLE_GAP
      if (element.readyState >= 2 && element.videoWidth && !element.seeking && moved) {
        let frame: Bars | null
        try {
          frame = measureFrame(element, canvas)
        } catch {
          return // unreadable frames: no detection for this stream
        }
        if (frame) {
          lastSampledAt = element.currentTime
          bars = bars
            ? {
                top: Math.min(bars.top, frame.top),
                bottom: Math.min(bars.bottom, frame.bottom),
                left: Math.min(bars.left, frame.left),
                right: Math.min(bars.right, frame.right),
              }
            : frame
          samples++
          if (samples >= SAMPLES_NEEDED) {
            const next = { x: bars.left, y: bars.top, width: 1 - bars.left - bars.right, height: 1 - bars.top - bars.bottom }
            setArea((current) =>
              Math.abs(current.x - next.x) < 0.005 &&
              Math.abs(current.y - next.y) < 0.005 &&
              Math.abs(current.width - next.width) < 0.005 &&
              Math.abs(current.height - next.height) < 0.005
                ? current
                : next,
            )
          }
        }
      }
      timer = window.setTimeout(sample, samples >= SAMPLES_NEEDED ? SAMPLE_LATE_MS : SAMPLE_EARLY_MS)
    }
    timer = window.setTimeout(sample, SAMPLE_EARLY_MS)
    return () => window.clearTimeout(timer)
  }, [video, enabled, streamKey])

  return area
}

/** Picture and screen aspect ratios this close are treated as equal: stretching by up to 4 % isn't noticeable. */
const STRETCH_TOLERANCE = 1.04
/** Up to this mismatch, filling the screen crops so little of the picture that it beats bars. */
const FILL_TOLERANCE = 1.08

export function resolveFit(fit: VideoFit, pictureAspect: number, screenAspect: number): Exclude<VideoFit, 'auto'> {
  if (fit !== 'auto') return fit
  const mismatch = Math.max(pictureAspect / screenAspect, screenAspect / pictureAspect)
  if (mismatch <= STRETCH_TOLERANCE) return 'fill'
  if (mismatch <= FILL_TOLERANCE) return 'cover'
  return 'contain'
}

export interface VideoLayout {
  style: CSSProperties
  /** The band of the video frame that is on screen, in percent of the frame height (for placing subtitles). */
  visibleTop: number
  visibleBottom: number
}

/**
 * Places the <video> element so that its picture area (without burned-in bars) is fitted to the screen as `fit` says.
 * The element itself is sized and moved (instead of using object-fit) so the bars can be pushed off screen.
 */
export function videoLayout(fit: VideoFit, area: PictureArea, videoWidth: number, videoHeight: number, screenWidth: number, screenHeight: number): VideoLayout | null {
  if (!videoWidth || !videoHeight || !screenWidth || !screenHeight) return null
  const pictureWidth = area.width * videoWidth
  const pictureHeight = area.height * videoHeight
  const mode = resolveFit(fit, pictureWidth / pictureHeight, screenWidth / screenHeight)
  const contain = Math.min(screenWidth / pictureWidth, screenHeight / pictureHeight)
  const cover = Math.max(screenWidth / pictureWidth, screenHeight / pictureHeight)
  const scaleX = mode === 'fill' ? screenWidth / pictureWidth : mode === 'cover' ? cover : contain
  const scaleY = mode === 'fill' ? screenHeight / pictureHeight : mode === 'cover' ? cover : contain

  const width = videoWidth * scaleX
  const height = videoHeight * scaleY
  const left = screenWidth / 2 - (area.x + area.width / 2) * width
  const top = screenHeight / 2 - (area.y + area.height / 2) * height
  return {
    style: { position: 'absolute', left, top, width, height, maxWidth: 'none', objectFit: 'fill' },
    visibleTop: Math.max(0, (-top / height) * 100),
    visibleBottom: Math.min(100, ((screenHeight - top) / height) * 100),
  }
}

/** Size of an element, kept up to date. */
export function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return size
}

/** The video's intrinsic size, which is only known once metadata has loaded and can change mid-stream. */
export function useVideoDimensions(video: RefObject<HTMLVideoElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const element = video.current
    if (!element) return
    const update = () => setSize((current) => (current.width === element.videoWidth && current.height === element.videoHeight ? current : { width: element.videoWidth, height: element.videoHeight }))
    update()
    element.addEventListener('loadedmetadata', update)
    element.addEventListener('resize', update)
    return () => {
      element.removeEventListener('loadedmetadata', update)
      element.removeEventListener('resize', update)
    }
  }, [video])
  return size
}
