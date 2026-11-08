import type { VideoFit } from '@/features/settings/local-settings'
import type { TrickplayFrame } from './trickplay'
import { videoLayout, type PictureArea } from './video-fit'

interface ScrubPreviewProps {
  frame: TrickplayFrame
  pictureArea: PictureArea
  fit: VideoFit
  screen: { width: number; height: number }
}

/**
 * While the seek bar is dragged, the trickplay frame of the target time is shown full size in place of the video
 * (laid out exactly like the video, so nothing jumps when letting go).
 */
export function ScrubPreview({ frame, pictureArea, fit, screen }: ScrubPreviewProps) {
  const layout = videoLayout(fit, pictureArea, frame.width, frame.height, screen.width, screen.height)
  if (!layout) return null
  const box = layout.style as { left: number; top: number; width: number; height: number }
  const scaleX = box.width / frame.width
  const scaleY = box.height / frame.height
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-black">
      <div
        className="absolute"
        style={{
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          backgroundImage: `url("${frame.url}")`,
          backgroundSize: `${frame.sheetWidth * scaleX}px ${frame.sheetHeight * scaleY}px`,
          backgroundPosition: `-${frame.x * scaleX}px -${frame.y * scaleY}px`,
        }}
      />
    </div>
  )
}
