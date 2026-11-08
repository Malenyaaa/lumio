import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { LocationDialog } from '@/features/listen/concert-pages'
import { useConcertLocation } from '@/features/listen/concerts'
import { clearAudioCache } from '@/features/listen/player/audio-cache'
import { TasteExclusionsSection } from '@/features/listen/taste'
import { defineMessages, useMessages } from '@/lib/i18n'
import { Row, Section, SelectField, SettingsPage, SwitchField } from './fields'
import { useLocalSettings } from './local-settings'
import { playbackMessages } from './messages'

const musicMessages = defineMessages({
  de: {
    title: 'Musik',
    description: 'Wie Listen Musik, Hörbücher und Podcasts abspielt, und was es dir vorschlägt.',
    playback: 'Wiedergabe',
    quality: 'Qualität',
    qualityDescription: 'Klangqualität beim Streamen auf diesem Gerät. Downloads haben ihre eigene Qualität (Speicher & Downloads).',
    concerts: 'Konzerte',
    locationLabel: 'Standort',
    locationHint: 'Wo Lumio nach Konzerten in deiner Nähe sucht.',
    locationNone: 'Nicht festgelegt',
    change: 'Ändern',
    set: 'Festlegen',
  },
  en: {
    title: 'Music',
    description: 'How Listen plays music, audiobooks and podcasts, and what it suggests to you.',
    playback: 'Playback',
    quality: 'Quality',
    qualityDescription: 'Sound quality when streaming on this device. Downloads have a quality of their own (Storage & downloads).',
    concerts: 'Concerts',
    locationLabel: 'Location',
    locationHint: 'Where Lumio looks for concerts near you.',
    locationNone: 'Not set',
    change: 'Change',
    set: 'Set',
  },
})

const QUALITIES = [320, 256, 192, 128]

export function MusicPage() {
  const t = useMessages(musicMessages)
  const p = useMessages(playbackMessages)
  const { settings, update } = useLocalSettings()
  const location = useConcertLocation()
  const [picking, setPicking] = useState(false)
  const qualityOptions = [{ value: 0, label: p.musicOriginal }, ...QUALITIES.map((kbps) => ({ value: kbps, label: `${kbps} kbps` }))]

  return (
    <SettingsPage title={t.title} description={t.description}>
      <Section title={t.playback} scope="account">
        <SwitchField
          id="music-autoplay"
          label={p.autoplayMusicLabel}
          hint={p.autoplayMusicHint}
          checked={settings.musicAutoplay}
          onChange={(checked) => update({ musicAutoplay: checked })}
        />
      </Section>

      <Section title={t.quality} description={t.qualityDescription} scope="device">
        <SelectField
          id="music-quality"
          label={p.musicQualityLabel}
          hint={`${p.musicQualityHint} ${p.musicQualityCacheNote}`}
          value={settings.musicQuality ?? 0}
          options={qualityOptions}
          onChange={(value) => {
            update({ musicQuality: value || null })
            // The cache held the old quality: it fills again in the new one.
            if ((value || null) !== settings.musicQuality) void clearAudioCache()
          }}
        />
      </Section>

      <Section title={t.concerts} scope="account">
        <Row label={t.locationLabel} hint={t.locationHint}>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <span className="truncate text-sm text-muted-foreground">{location?.label ?? t.locationNone}</span>
            <Button variant="outline" size="sm" onClick={() => setPicking(true)}>
              {location ? t.change : t.set}
            </Button>
          </div>
        </Row>
      </Section>

      <TasteExclusionsSection />
      <LocationDialog open={picking} onOpenChange={setPicking} />
    </SettingsPage>
  )
}
