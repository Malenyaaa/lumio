import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { ModeTile } from '@/components/app-switcher'
import { FadeImage } from '@/components/media/fade-image'
import { useAuthedSession } from '@/features/auth/session'
import { defineMessages, useMessages } from '@/lib/i18n'
import { portraitImageUrl } from '@/lib/images'
import { CardShell } from './music-card'
import { useMusic } from './player/music-player'
import { useArtistRadio, useSimilarLibraryArtists } from './radio'

const messages = defineMessages({
  de: { radio: 'Radio', subtitle: (names: string) => `Mit ${names}` },
  en: { radio: 'Radio', subtitle: (names: string) => `With ${names}` },
})

/** A stable soft colour per artist, like Spotify's radio covers. */
function hue(seed: string) {
  let hash = 0
  for (const char of seed) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0
  return Math.abs(hash) % 360
}

/**
 * An artist's radio as a card, as on Spotify: on a soft colour, the artist's round photo in the middle with two
 * similar artists half behind it, "RADIO" in the corner and the name at the bottom. Playing it starts the radio.
 */
export function RadioCard({ artist }: { artist: BaseItemDto }) {
  const { api } = useAuthedSession()
  const t = useMessages(messages)
  const radio = useArtistRadio()
  const similar = useSimilarLibraryArtists(artist).data ?? []
  const state = useMusic()
  const source = `radio:${artist.Id}`
  const here = state.source === source && state.index >= 0
  const h = hue(artist.Id ?? '')
  const photo = (item: BaseItemDto) => portraitImageUrl(api, item, { fillHeight: 240 }) ?? `${api.basePath}/Items/${item.Id}/Images/Primary?fillHeight=240&quality=90`
  const [left, right] = similar
  return (
    <CardShell
      href={`/listen/artist/${artist.Id}`}
      title={t.radio + ': ' + (artist.Name ?? '')}
      subtitle={similar.length ? t.subtitle(similar.slice(0, 3).map((entry) => entry.Name).join(', ')) : undefined}
      here={here}
      playing={here && state.playing}
      onPlay={() => void radio(artist)}
      cover={
        <div className="relative size-full overflow-hidden @container" style={{ background: `oklch(0.78 0.1 ${h})` }}>
          <ModeTile mode="listen" className="absolute left-[6%] top-[6%] size-[clamp(14px,11cqw,26px)] rounded-full" />
          <span className="absolute right-[6%] top-[6%] text-[clamp(9px,7cqw,14px)] font-black tracking-widest text-black/80">RADIO</span>
          {[left, right].map(
            (side, index) =>
              side && (
                <span
                  key={side.Id}
                  className="absolute top-[24%] size-[42%] overflow-hidden rounded-full bg-black/10 shadow-lg"
                  style={index === 0 ? { left: '6%' } : { right: '6%' }}
                >
                  <FadeImage src={photo(side)} alt="" className="size-full object-cover" />
                </span>
              ),
          )}
          <span className="absolute left-1/2 top-[18%] size-[54%] -translate-x-1/2 overflow-hidden rounded-full bg-black/10 shadow-xl ring-4" style={{ ['--tw-ring-color' as string]: `oklch(0.78 0.1 ${h})` }}>
            <FadeImage src={photo(artist)} alt="" className="size-full object-cover" />
          </span>
          <span className="absolute inset-x-[6%] bottom-[5%] truncate text-[clamp(12px,11cqw,24px)] font-black leading-tight text-black/85">{artist.Name}</span>
        </div>
      }
    />
  )
}
