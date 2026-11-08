import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { audioCacheAvailable, clearAudioCache, OFTEN_PLAYED, trimAudioCache, useAudioCacheStats, useStorageInfo } from '@/features/listen/player/audio-cache'
import { clearVideoCache, trimVideos, useVideoCacheStats, videoCacheAvailable } from '@/features/player/video-cache'
import { appCacheBytes, clearAppCaches } from '@/lib/app-cache'
import { Section, SelectField, SettingsPage, SettingsPending, SwitchField, withCurrent } from './fields'
import { useLocalSettings, type SegmentAction, type SegmentKind } from './local-settings'
import { fitLabels, SPEEDS, speedLabel, VIDEO_FITS } from '@/features/player/labels'
import { getLocaleTag, useLocale, useMessages } from '@/lib/i18n'
import { fieldMessages, playbackMessages } from './messages'
import { useLanguageOptions } from './use-languages'
import { useUpdateConfiguration, useUserConfiguration } from './use-user-configuration'

const MBIT = 1_000_000
const BITRATES_MBIT = [120, 80, 60, 40, 20, 10, 8, 4, 3, 1.5]

const SKIP_SECONDS = [5, 10, 15, 20, 30]

const SEGMENT_ACTIONS: SegmentAction[] = ['None', 'AskToSkip', 'Skip']

const SEGMENT_KINDS: SegmentKind[] = ['Intro', 'Preview', 'Recap', 'Commercial', 'Outro']

const MB = 1024 * 1024
const GB = 1024 * MB

/** Shows sizes in MB or GB. */
function useSize() {
  const number = new Intl.NumberFormat(getLocaleTag(useLocale()), { maximumFractionDigits: 1 })
  return (bytes: number) => (bytes >= GB ? `${number.format(bytes / GB)} GB` : `${number.format(Math.max(bytes, 0) / MB)} MB`)
}

/**
 * What the browser holds for Lumio, each kind on its own line with a bar against its limit and its own clear button:
 * songs, episodes, and the app with its pictures and kept data. Below, what the browser allows in total.
 */
function StorageOverview() {
  const t = useMessages(playbackMessages)
  const { settings } = useLocalSettings()
  const size = useSize()
  const songs = useAudioCacheStats()
  const episodes = useVideoCacheStats()
  const storage = useStorageInfo()
  const app = useQuery({ queryKey: ['app-cache-bytes', songs.bytes, episodes.bytes], queryFn: appCacheBytes, staleTime: 0 })
  const [appCleared, setAppCleared] = useState(false)
  return (
    <div className="space-y-5 px-4 py-4">
      <StorageLine
        title={t.songsStored}
        detail={songs.count ? t.songCount(songs.count) : t.nothingStored}
        used={songs.bytes}
        limit={settings.musicCacheMb * MB}
        size={size}
        onClear={songs.count ? () => void clearAudioCache() : undefined}
        clear={t.clearCache}
      />
      <StorageLine
        title={t.episodesStored}
        detail={episodes.count ? t.episodeCount(episodes.count) : t.nothingStored}
        used={episodes.bytes}
        limit={settings.videoCacheGb * GB}
        size={size}
        onClear={episodes.count ? () => void clearVideoCache() : undefined}
        clear={t.clearCache}
      />
      <StorageLine
        title={t.appStored}
        detail={appCleared ? t.appCacheCleared : t.appCacheHint}
        used={app.data ?? 0}
        size={size}
        onClear={
          appCleared
            ? undefined
            : () =>
                void clearAppCaches().then(() => {
                  setAppCleared(true)
                  void app.refetch()
                })
        }
        clear={t.clearCache}
      />
      {storage.data && (
        <p className="text-xs text-muted-foreground">
          {[storage.data.quota ? t.browserTotal(size(storage.data.usage), size(storage.data.quota)) : undefined, storage.data.persisted ? t.persisted : t.notPersisted]
            .filter(Boolean)
            .join(' ')}
        </p>
      )}
    </div>
  )
}

function StorageLine({
  title,
  detail,
  used,
  limit,
  size,
  onClear,
  clear,
}: {
  title: string
  detail: string
  used: number
  limit?: number
  size: (bytes: number) => string
  onClear?: () => void
  clear: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <p className="text-right text-sm font-semibold tabular-nums">
            {size(used)}
            {limit ? <span className="font-normal text-muted-foreground"> / {size(limit)}</span> : null}
          </p>
          <Button variant="outline" size="sm" disabled={!onClear} onClick={onClear}>
            {clear}
          </Button>
        </div>
      </div>
      {!!limit && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
        </div>
      )}
    </div>
  )
}

export function PlaybackPage() {
  const user = useUserConfiguration()
  const config = user.data?.Configuration
  const save = useUpdateConfiguration()
  const languages = useLanguageOptions()
  const { settings, update } = useLocalSettings()
  const locale = useLocale()
  const fitNames = useMessages(fitLabels)
  const speedOptions = SPEEDS.map((speed) => ({ value: speed, label: speedLabel(speed, locale) }))
  const fitOptions = VIDEO_FITS.map((fit) => ({ value: fit, label: fitNames[fit] }))
  const t = useMessages(playbackMessages)
  const { seconds } = useMessages(fieldMessages)
  const number = new Intl.NumberFormat(getLocaleTag(locale))
  const channelOptions = [
    { value: -1, label: t.auto },
    { value: 1, label: t.mono },
    { value: 2, label: t.stereo },
    { value: 6, label: t.channels(number.format(5.1)) },
    { value: 8, label: t.channels(number.format(7.1)) },
  ]
  const bitrateOptions = [{ value: 0, label: t.auto }, ...BITRATES_MBIT.map((mbit) => ({ value: mbit * MBIT, label: `${number.format(mbit)} Mbit/s` }))]
  const skipOptions = SKIP_SECONDS.map((value) => ({ value, label: seconds(value) }))
  const segmentActions = SEGMENT_ACTIONS.map((value) => ({ value, label: t[`action${value}`] }))

  if (!config) {
    return (
      <SettingsPage title={t.title}>
        <SettingsPending error={user.isError} onRetry={() => void user.refetch()} rows={4} />
      </SettingsPage>
    )
  }

  const audioLanguage = config.AudioLanguagePreference ?? ''

  return (
    <SettingsPage title={t.title} description={t.description}>
      <Section title={t.audio} scope="account">
        <SelectField
          id="audio-language"
          label={t.audioLanguageLabel}
          hint={t.audioLanguageHint}
          value={audioLanguage}
          options={withCurrent(languages, audioLanguage)}
          onChange={(value) => save.mutate({ AudioLanguagePreference: value || null })}
        />
        <SwitchField
          id="play-default-audio"
          label={t.defaultAudioLabel}
          hint={t.defaultAudioHint}
          checked={config.PlayDefaultAudioTrack ?? true}
          onChange={(checked) => save.mutate({ PlayDefaultAudioTrack: checked })}
        />
      </Section>

      <Section title={t.streaming} description={t.streamingDescription} scope="device">
        <SelectField
          id="max-bitrate"
          label={t.bitrateLabel}
          hint={t.bitrateHint}
          value={settings.maxBitrate ?? 0}
          options={bitrateOptions}
          onChange={(value) => update({ maxBitrate: value || null })}
        />
        <SelectField
          id="max-audio-channels"
          label={t.channelsLabel}
          hint={t.channelsHint}
          value={settings.maxAudioChannels}
          options={channelOptions}
          onChange={(value) => update({ maxAudioChannels: value })}
        />
      </Section>

      <Section title={t.music} description={t.musicDescription} scope="device">
        <SelectField
          id="music-quality"
          label={t.musicQualityLabel}
          hint={t.musicQualityHint}
          value={settings.musicQuality ?? 0}
          options={[{ value: 0, label: t.musicOriginal }, ...[320, 256, 192, 128].map((kbps) => ({ value: kbps, label: `${kbps} kbps` }))]}
          onChange={(value) => update({ musicQuality: value || null })}
        />
        <SwitchField
          id="music-autoplay"
          label={t.autoplayMusicLabel}
          hint={t.autoplayMusicHint}
          checked={settings.musicAutoplay}
          onChange={(checked) => update({ musicAutoplay: checked })}
        />
      </Section>

      {audioCacheAvailable && (
        <Section title={t.cache} description={t.cacheDescription} scope="device">
          <SelectField
            id="music-prefetch"
            label={t.prefetchLabel}
            hint={t.prefetchHint}
            value={settings.musicPrefetch}
            options={[0, 1, 2, 3, 5, 10].map((count) => ({ value: count, label: count ? t.prefetchTracks(count) : t.off }))}
            onChange={(value) => update({ musicPrefetch: value })}
          />
          <SelectField
            id="music-cache-size"
            label={t.cacheSizeLabel}
            hint={t.cacheSizeHint}
            value={settings.musicCacheMb}
            options={[256, 512, 1024, 2048, 5120, 10240].map((mb) => ({ value: mb, label: mb >= 1024 ? `${number.format(mb / 1024)} GB` : `${mb} MB` }))}
            onChange={(value) => {
              update({ musicCacheMb: value })
              trimAudioCache({ maxBytes: value * MB, keepOftenPlayed: settings.musicKeepOften })
            }}
          />
          <SwitchField
            id="music-keep-often"
            label={t.keepOftenLabel}
            hint={t.keepOftenHint(OFTEN_PLAYED)}
            checked={settings.musicKeepOften}
            onChange={(checked) => update({ musicKeepOften: checked })}
          />
        </Section>
      )}

      {videoCacheAvailable && (
        <Section title={t.videoCache} description={t.videoCacheDescription} scope="device">
          <SelectField
            id="video-prefetch"
            label={t.videoPrefetchLabel}
            hint={t.videoPrefetchHint}
            value={settings.videoPrefetch}
            options={[0, 1, 2, 3].map((count) => ({ value: count, label: count ? t.videoPrefetchEpisodes(count) : t.off }))}
            onChange={(value) => update({ videoPrefetch: value })}
          />
          <SelectField
            id="video-cache-size"
            label={t.cacheSizeLabel}
            hint={t.videoCacheSizeHint}
            value={settings.videoCacheGb}
            options={[2, 5, 10, 20, 50].map((gb) => ({ value: gb, label: `${gb} GB` }))}
            onChange={(value) => {
              update({ videoCacheGb: value })
              void trimVideos(value * GB)
            }}
          />
          <SelectField
            id="video-bitrate"
            label={t.videoBitrateLabel}
            hint={t.videoBitrateHint}
            value={settings.videoBitrateMbit}
            options={[3, 5, 8, 12, 20].map((mbit) => ({ value: mbit, label: `${mbit} Mbit/s` }))}
            onChange={(value) => update({ videoBitrateMbit: value })}
          />
        </Section>
      )}

      {(audioCacheAvailable || videoCacheAvailable) && (
        <Section title={t.storage} description={t.storageDescription} scope="device">
          <StorageOverview />
        </Section>
      )}

      <Section title={t.behavior} scope="account">
        <SwitchField
          id="autoplay-next"
          label={t.autoplayNextLabel}
          checked={config.EnableNextEpisodeAutoPlay ?? true}
          onChange={(checked) => save.mutate({ EnableNextEpisodeAutoPlay: checked })}
        />
        <SwitchField
          id="remember-audio"
          label={t.rememberAudioLabel}
          hint={t.rememberAudioHint}
          checked={config.RememberAudioSelections ?? true}
          onChange={(checked) => save.mutate({ RememberAudioSelections: checked })}
        />
        <SwitchField
          id="remember-subtitles"
          label={t.rememberSubtitlesLabel}
          hint={t.rememberSubtitlesHint}
          checked={config.RememberSubtitleSelections ?? true}
          onChange={(checked) => save.mutate({ RememberSubtitleSelections: checked })}
        />
      </Section>

      <Section title={t.player} scope="device">
        <SelectField
          id="playback-rate"
          label={t.speedLabel}
          hint={t.speedHint}
          value={settings.playbackRate}
          options={speedOptions}
          onChange={(value) => update({ playbackRate: value })}
        />
        <SelectField
          id="video-fit"
          label={t.fitLabel}
          hint={t.fitHint}
          value={settings.videoFit}
          options={fitOptions}
          onChange={(value) => update({ videoFit: value })}
        />
        <SwitchField
          id="start-after-intro"
          label={t.startAfterIntroLabel}
          hint={t.startAfterIntroHint}
          checked={settings.startAfterIntro}
          onChange={(checked) => update({ startAfterIntro: checked })}
        />
      </Section>

      <Section title={t.preload} description={t.preloadDescription} scope="device">
        <SwitchField
          id="preload-next"
          label={t.preloadNextLabel}
          hint={t.preloadNextHint}
          checked={settings.preloadNextEpisode}
          onChange={(checked) => update({ preloadNextEpisode: checked })}
        />
        <SwitchField
          id="preload-trickplay"
          label={t.preloadTrickplayLabel}
          hint={t.preloadTrickplayHint}
          checked={settings.preloadTrickplay}
          onChange={(checked) => update({ preloadTrickplay: checked })}
        />
      </Section>

      <Section title={t.skip} scope="device">
        <SelectField
          id="skip-forward"
          label={t.skipForward}
          value={settings.skipForwardSeconds}
          options={skipOptions}
          onChange={(value) => update({ skipForwardSeconds: value })}
        />
        <SelectField
          id="skip-back"
          label={t.skipBack}
          value={settings.skipBackSeconds}
          options={skipOptions}
          onChange={(value) => update({ skipBackSeconds: value })}
        />
      </Section>

      <Section
        title={t.segments}
        description={t.segmentsDescription}
        scope="device"
      >
        {SEGMENT_KINDS.map((kind) => (
          <SelectField
            key={kind}
            id={`segment-${kind}`}
            label={t[`kind${kind}`]}
            value={settings.segmentActions[kind]}
            options={segmentActions}
            onChange={(value) => update({ segmentActions: { ...settings.segmentActions, [kind]: value } })}
          />
        ))}
      </Section>
    </SettingsPage>
  )
}
