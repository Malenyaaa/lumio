import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import type { ReactNode } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMessages } from '@/lib/i18n'
import { audioLabel, labelStreams, subtitleLabel, videoLabel } from '@/lib/track-labels'
import { trackPickerMessages } from './messages'

export interface TrackChoice {
  audio?: number
  /** -1 = subtitles off. */
  subtitle?: number
}

interface TrackPickerProps {
  item: BaseItemDto
  value: TrackChoice
  onChange: (next: TrackChoice) => void
}

/**
 * Audio language and subtitles before playing; unset = server default. A choice with only one option is shown as
 * plain information (like the video quality), subtitles not at all when the file has none.
 */
export function TrackPicker({ item, value, onChange }: TrackPickerProps) {
  const t = useMessages(trackPickerMessages)
  const source = item.MediaSources?.[0]
  const streams = source?.MediaStreams ?? []
  const video = streams.find((stream) => stream.Type === 'Video')

  const audioIndex = value.audio ?? source?.DefaultAudioStreamIndex ?? undefined
  const subtitleIndex = value.subtitle ?? source?.DefaultSubtitleStreamIndex ?? -1

  const audio = labelStreams(streams.filter((stream) => stream.Type === 'Audio'), audioLabel, [audioIndex])
  const subtitles = labelStreams(streams.filter((stream) => stream.Type === 'Subtitle'), subtitleLabel, [subtitleIndex])
  if (!video && audio.length === 0 && subtitles.length === 0) return null

  const audioItems = audio.map((entry) => ({ value: String(entry.index), label: entry.label }))
  const subtitleItems = [{ value: '-1', label: t.off }, ...subtitles.map((entry) => ({ value: String(entry.index), label: entry.label }))]

  return (
    <div className="flex max-w-3xl flex-wrap items-start gap-x-6 gap-y-3">
      {video && <Info label={t.video}>{videoLabel(video)}</Info>}

      {audio.length === 1 && <Info label={t.language}>{audio[0]!.label}</Info>}
      {audio.length > 1 && (
        <Picker
          label={t.language}
          value={String(audioIndex ?? audio[0]?.index ?? '')}
          items={audioItems}
          onChange={(picked) => onChange({ ...value, audio: Number(picked) })}
        />
      )}

      {subtitles.length > 0 && (
        <Picker label={t.subtitles} value={String(subtitleIndex)} items={subtitleItems} onChange={(picked) => onChange({ ...value, subtitle: Number(picked) })} />
      )}
    </div>
  )
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="flex h-9 items-center text-sm">{children}</p>
    </div>
  )
}

interface PickerProps {
  label: string
  value: string
  items: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}

function Picker({ label, value, items, onChange }: PickerProps) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <Select value={value} items={items} onValueChange={(picked) => picked && onChange(picked)}>
        {/* Sized by the longest option (within limits), so labels like "Englisch · Dolby Digital Plus 5.1" fit. */}
        <SelectTrigger aria-label={label} className="h-9 w-auto min-w-48 max-w-[min(26rem,calc(100vw-2rem))] gap-3">
          <SelectValue className="truncate" />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {items.map((entry) => (
            <SelectItem key={entry.value} value={entry.value}>
              {entry.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
