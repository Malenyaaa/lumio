import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { title: 'Dein musikalisches Sonnensystem' },
  en: { title: 'Your musical solar system' },
})

/** The orbit's radius (in the 400-wide drawing): small enough that the names beside the planets fit. */
const ORBIT = 220

const PLANETS = ['#ff8a1e', '#f774c2', '#12d861', '#8b7bff', '#f1ff47']

/** A glowing sun cut off at the left, an orbit, each artist a small planet along it (2022's genres). */
export default {
  id: 'top-artists-orbit',
  topic: 'top-artists',
  backdrop: false,
  ink: '#ffffff',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const artists = data.topArtists.slice(0, 5)
    return (
      <>
        <div aria-hidden className="absolute inset-0 bg-[#07070d]/90" />
        <div
          aria-hidden
          className="absolute top-1/2 -left-56 size-80 -translate-y-1/2 animate-pulse rounded-full"
          style={{ background: `radial-gradient(circle, #fff3b0, ${palette.accent} 45%, transparent 70%)`, boxShadow: `0 0 120px ${palette.accent}` }}
        />
        <svg aria-hidden viewBox="0 0 400 700" className="absolute inset-0 size-full" fill="none">
          <circle cx="-40" cy="380" r={ORBIT} stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" className="wrapped-draw" />
        </svg>
        <Body className="gap-4 text-white">
          <In>
            <Headline look={look} className="text-3xl">
              {t.title}
            </Headline>
          </In>
          <div className="relative flex-1">
            {artists.map((artist, index) => {
              // Along the orbit: from the top of the arc to its bottom.
              const angle = (-52 + index * 26) * (Math.PI / 180)
              const x = -40 + ORBIT * Math.cos(angle)
              const y = 380 + ORBIT * Math.sin(angle) - 120
              return (
                <In key={artist.name} delay={500 + index * 220} from="zoom" className="absolute flex items-center gap-3" style={{ left: `${(x / 400) * 100}%`, top: `${(y / 580) * 100}%` }}>
                  <span className="size-8 shrink-0 rounded-full shadow-[0_0_20px_currentColor]" style={{ background: PLANETS[index], color: PLANETS[index] }} />
                  <span className="max-w-[9rem] break-words">
                    <span className="block text-sm font-bold">{index + 1}</span>
                    <span className="block text-lg leading-tight font-extrabold" style={{ color: PLANETS[index] }}>
                      {artist.name}
                    </span>
                  </span>
                </In>
              )
            })}
          </div>
        </Body>
      </>
    )
  },
} satisfies WrappedSlide
