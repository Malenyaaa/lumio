import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, In, Picture, displayClass, useFormats, useTrackCover, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { lead: (date: string) => `Am ${date} lief ein Song in Dauerschleife:`, count: (plays: number) => `${plays}-mal an einem Tag.` },
  en: { lead: (date: string) => `On ${date}, one song was on repeat:`, count: (plays: number) => `${plays} times in one day.` },
})

/** The title with offset copies stacked behind it, like an echo (2025's vibe blender). */
export default {
  id: 'repeat-echo',
  topic: 'repeat',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { day } = useFormats()
    const track = data.onRepeat!
    const cover = useTrackCover(track, 320)
    return (
      <Body className="justify-center gap-7">
        <In>
          <p className="text-xl font-bold">{t.lead(day.format(new Date(`${track.date}T00:00:00Z`)))}</p>
        </In>
        <div className="relative">
          {[4, 3, 2, 1].map((layer) => (
            <p
              key={layer}
              aria-hidden
              className={`absolute inset-0 animate-in fade-in-0 text-5xl break-words fill-mode-both ${displayClass(look)}`}
              style={{ transform: `translate(${layer * 5}px, ${layer * 5}px)`, color: palette.accent, opacity: 0.85 - layer * 0.18, animationDelay: `${300 + layer * 120}ms` }}
            >
              {track.title}
            </p>
          ))}
          <In from="zoom">
            <p className={`relative text-5xl break-words ${displayClass(look)}`}>{track.title}</p>
          </In>
        </div>
        <In delay={900} className="flex items-center gap-4">
          <Picture src={cover} className="size-16 shrink-0" />
          <div>
            {track.artist && <p className="font-bold">{track.artist}</p>}
            <p className="text-3xl font-black">{t.count(track.plays)}</p>
          </div>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
