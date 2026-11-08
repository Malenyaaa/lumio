import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { useState } from 'react'
import { useAuthedSession } from '@/features/auth/session'
import { formatRuntime, plainText } from '@/lib/format'
import { logoImageUrl } from '@/lib/images'
import { cn } from '@/lib/utils'

interface PauseSpotlightProps {
  item?: BaseItemDto
  visible: boolean
}

/**
 * Cinematic overlay shown while a paused video sits idle: logo (or title), episode line, key facts and the synopsis,
 * on a gradient from the left edge. It never takes pointer events, so it can't get in the way of the player.
 */
export function PauseSpotlight({ item, visible }: PauseSpotlightProps) {
  const { api } = useAuthedSession()
  const [failedLogo, setFailedLogo] = useState<string | null>(null)
  if (!item) return null

  const isEpisode = item.Type === 'Episode'
  const logo = logoImageUrl(api, item)
  const showLogo = !!logo && failedLogo !== logo
  const title = isEpisode ? item.SeriesName : item.Name
  const facts = [
    item.ProductionYear ? String(item.ProductionYear) : null,
    item.CommunityRating ? `★ ${item.CommunityRating.toFixed(1)}` : null,
    formatRuntime(item.RunTimeTicks) ?? null,
    item.Genres?.slice(0, 3).join(' · ') || null,
  ].filter(Boolean)

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        'pointer-events-none absolute inset-0 z-[5] flex items-center bg-linear-to-r from-black/85 via-black/50 to-transparent text-white transition-opacity duration-500',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    >
      <div
        className={cn(
          'ml-[5vw] flex max-w-[55vw] origin-left flex-col items-start gap-4 transition-transform duration-500 ease-out',
          visible ? 'scale-100' : 'scale-[1.18]',
        )}
      >
        {isEpisode && (
          <p className="text-sm uppercase tracking-wider text-white/85">
            {item.SeriesName} · S{item.ParentIndexNumber}E{item.IndexNumber}
          </p>
        )}
        {showLogo ? (
          <img
            src={logo}
            alt={title ?? ''}
            onError={() => setFailedLogo(logo)}
            className="max-h-[28vh] max-w-[50vw] object-contain object-left drop-shadow-[0_6px_24px_rgba(0,0,0,0.6)]"
          />
        ) : (
          <h2 className="text-5xl font-bold leading-none drop-shadow-[0_4px_24px_rgba(0,0,0,0.7)]">{title}</h2>
        )}
        {isEpisode && <p className="text-2xl font-medium">{item.Name}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/85">
          {item.OfficialRating && <span className="rounded bg-white/15 px-2 py-0.5">{item.OfficialRating}</span>}
          {facts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
        </div>
        {item.Overview && <p className="line-clamp-3 max-w-[50vw] text-base leading-relaxed text-white/90">{plainText(item.Overview)}</p>}
      </div>
    </div>
  )
}
