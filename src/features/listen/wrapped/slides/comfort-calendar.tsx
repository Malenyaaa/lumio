import { defineMessages, useMessages } from '@/lib/i18n'
import { contrast, Body, Headline, In, Picture, useTrackCover, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { lead: 'Dein Wohlfühlsong', line: (days: number) => `An ${days} verschiedenen Tagen bist du zu ihm zurückgekehrt.` },
  en: { lead: 'Your comfort song', line: (days: number) => `You came back to it on ${days} different days.` },
})

/** The song you returned to on the most days: a calendar sheet filling with ticks. */
export default {
  id: 'comfort-calendar',
  topic: 'comfort',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const track = data.comfort!
    const cover = useTrackCover(track, 320)
    const ticks = Math.min(track.days, 35)
    return (
      <Body className="justify-center gap-6">
        <In>
          <p className="text-xl font-bold">{t.lead}</p>
        </In>
        <In delay={150} className="flex items-center gap-4">
          <Picture src={cover} className="size-24 shrink-0" />
          <div className="min-w-0">
            <Headline look={look} className="text-3xl break-words">
              {track.title}
            </Headline>
            {track.artist && <p className="mt-1 font-bold">{track.artist}</p>}
          </div>
        </In>
        <In delay={400} from="zoom" className="rounded-xl bg-white p-4 text-[#111] shadow-xl">
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 35 }, (_, index) => (
              <span key={index} className="grid aspect-square place-items-center rounded-md bg-black/5 text-sm font-black">
                {index < ticks && (
                  <span className="animate-in zoom-in-0 fill-mode-both" style={{ color: contrast(palette.accent, '#ffffff') >= 3 ? palette.accent : '#111111', animationDelay: `${700 + index * 60}ms` }}>
                    ✓
                  </span>
                )}
              </span>
            ))}
          </div>
        </In>
        <In delay={900 + ticks * 60}>
          <p className="text-lg font-semibold">{t.line(track.days)}</p>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
