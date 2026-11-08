import type { BaseItemPerson } from '@jellyfin/sdk/lib/generated-client/models'
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models'
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api'
import { Link } from '@/components/link'
import { FadeImage } from '@/components/media/fade-image'
import { useAuthedSession } from '@/features/auth/session'

interface PersonCardProps {
  person: BaseItemPerson
  /** Second line; defaults to the character the person plays. */
  subtitle?: string
}

function initials(name?: string | null) {
  return (name ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function PersonCard({ person, subtitle }: PersonCardProps) {
  const { api } = useAuthedSession()
  const image =
    person.Id && person.PrimaryImageTag
      ? getImageApi(api).getItemImageUrlById(person.Id, ImageType.Primary, { fillHeight: 240, tag: person.PrimaryImageTag, quality: 85 })
      : undefined

  return (
    <Link to={`/person/${person.Id}`} className="group/person flex w-28 shrink-0 flex-col items-center gap-2 rounded-lg p-1 text-center outline-none sm:w-32">
      <div className="size-24 overflow-hidden rounded-full bg-muted ring-1 ring-border transition group-focus-visible/person:ring-2 group-focus-visible/person:ring-ring sm:size-28">
        {/* Portrait headshots in a circle: centred, the forehead gets cut off. The face sits in the upper part of the
            picture, so the crop is taken mostly from the bottom (shoulders) instead. */}
        {image ? (
          <FadeImage src={image} alt="" loading="lazy" className="size-full object-cover object-[50%_18%]" />
        ) : (
          <div className="grid size-full place-items-center text-xl font-medium text-muted-foreground">{initials(person.Name)}</div>
        )}
      </div>
      <div className="min-w-0 max-w-full">
        <p className="truncate text-sm font-medium">{person.Name}</p>
        <p className="line-clamp-2 text-xs text-muted-foreground">{subtitle ?? person.Role}</p>
      </div>
    </Link>
  )
}
