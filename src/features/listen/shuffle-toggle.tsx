import { IconArrowsShuffle } from '@tabler/icons-react'
import { defineMessages, useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { music, useShuffleFor } from './player/music-player'

const messages = defineMessages({
  de: { on: 'Zufallswiedergabe an', off: 'Zufallswiedergabe aus' },
  en: { on: 'Turn on shuffle', off: 'Turn off shuffle' },
})

/**
 * The big shuffle switch next to a collection's play button (album, artist, playlist). Lit green with a dot below
 * while on, like the player bar's own shuffle button; the setting belongs to the collection (see `useShuffleFor`).
 */
export function ShuffleToggle({ source }: { source: string }) {
  const t = useMessages(messages)
  const on = useShuffleFor(source)
  return (
    <button
      type="button"
      aria-label={on ? t.off : t.on}
      title={on ? t.off : t.on}
      aria-pressed={on}
      onClick={() => music.setShuffleFor(source, !on)}
      className={cn(
        'relative grid size-10 place-items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
        on ? 'text-listen' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <IconArrowsShuffle className="size-7" />
      {on && <span className="absolute -bottom-0.5 size-1.5 rounded-full bg-listen" />}
    </button>
  )
}
