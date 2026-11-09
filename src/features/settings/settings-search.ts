import { inCapacitor } from '@/lib/capacitor'
import { desktop } from '@/lib/desktop'
import { useMessages } from '@/lib/i18n'
import { networkTypeKnown } from '@/lib/network'
import { homeSettingsMessages } from './home-settings-messages'
import {
  appMessages,
  controlsMessages,
  interfaceMessages,
  musicMessages,
  playbackMessages,
  privacyMessages,
  profileMessages,
  subtitlesMessages,
} from './messages'
import { useSettingsPages } from './settings-pages'

/** One searchable setting: where it lives, the id of its row (or section), and what it is called. */
export interface SearchResult {
  key: string
  to: string
  label: string
  hint?: string
  page: string
}

type Entry = [page: string, anchor: string, label: string, hint?: string]

/**
 * Every setting the search finds. Labels and hints come from the pages' own texts, so a search matches what is shown;
 * the anchors are the ids the pages give their rows and sections.
 */
function useEntries(): Entry[] {
  const controls = useMessages(controlsMessages)
  const ui = useMessages(interfaceMessages)
  const play = useMessages(playbackMessages)
  const music = useMessages(musicMessages)
  const subs = useMessages(subtitlesMessages)
  const home = useMessages(homeSettingsMessages)
  const profile = useMessages(profileMessages)
  const privacy = useMessages(privacyMessages)
  const app = useMessages(appMessages)
  const cellular = networkTypeKnown()
  const entries: Array<Entry | false> = [
    ['profile', 'profile-image', profile.image],
    ['profile', 'password', profile.changePassword, profile.passwordAndSignIn],
    ['profile', 'devices', profile.devices],
    ['privacy', 'privacy-playlists', privacy.showPlaylists, privacy.showPlaylistsHint],
    ['privacy', 'privacy-following', privacy.showFollowing, privacy.showFollowingHint],
    ['privacy', 'privacy-followers', privacy.showFollowers, privacy.showFollowersHint],
    ['privacy', 'privacy-activity', privacy.shareActivity, privacy.shareActivityHint],
    ['playback', 'audio-language', play.audioLanguageLabel, play.audioLanguageHint],
    ['playback', 'play-default-audio', play.defaultAudioLabel, play.defaultAudioHint],
    ['playback', 'remember-audio', play.rememberAudioLabel, play.rememberAudioHint],
    ['playback', 'remember-subtitles', play.rememberSubtitlesLabel, play.rememberSubtitlesHint],
    ['playback', 'autoplay-next', play.autoplayNextLabel],
    ['playback', 'playback-rate', play.speedLabel, play.speedHint],
    ['playback', 'video-fit', play.fitLabel, play.fitHint],
    ['playback', 'skip-forward', play.skipForward],
    ['playback', 'skip-back', play.skipBack],
    ['playback', 'segment-Intro', play.segments, `${play.segmentsDescription} ${play.kindIntro} ${play.kindOutro} ${play.kindRecap} ${play.kindPreview} ${play.kindCommercial}`],
    ['playback', 'start-after-intro', play.startAfterIntroLabel, play.startAfterIntroHint],
    ['playback', 'max-bitrate', play.bitrateLabel, play.bitrateHint],
    cellular && ['playback', 'max-bitrate-cellular', play.bitrateCellularLabel, play.bitrateCellularHint],
    ['playback', 'max-audio-channels', play.channelsLabel, play.channelsHint],
    ['playback', 'preload-next', play.preloadNextLabel, play.preloadNextHint],
    ['playback', 'preload-trickplay', play.preloadTrickplayLabel, play.preloadTrickplayHint],
    ['subtitles', 'subtitle-language', subs.languageLabel],
    ['subtitles', 'subtitle-mode', subs.modeLabel],
    ['subtitles', 'subtitle-style', subs.styleLabel],
    ['subtitles', 'subtitle-size', subs.sizeLabel],
    ['subtitles', 'subtitle-weight', subs.weightLabel],
    ['subtitles', 'subtitle-font', subs.fontLabel],
    ['subtitles', 'subtitle-color', subs.colorLabel],
    ['subtitles', 'subtitle-shadow', subs.shadowLabel],
    ['subtitles', 'subtitle-line', subs.lineLabel],
    ['music', 'music-autoplay', play.autoplayMusicLabel, play.autoplayMusicHint],
    ['music', 'music-normalization', music.normalizationLabel, music.normalizationHint],
    ['music', 'music-quality', play.musicQualityLabel, play.musicQualityHint],
    cellular && ['music', 'music-quality-cellular', play.musicQualityCellularLabel, play.musicQualityCellularHint],
    ['music', 'concerts', music.locationLabel, `${music.concerts} ${music.locationHint}`],
    ['music', 'taste', music.taste],
    ['home', 'home-layout', home.layoutLabel, home.layoutHint],
    ['home', 'libraries', home.libraries, home.librariesHint],
    ['interface', 'theme', ui.themeLabel, ui.themeHint],
    ['interface', 'language', ui.languageLabel, ui.languageHint],
    ['interface', 'apps', ui.appsLabel, ui.appsHint],
    ['interface', 'hover-preview', ui.hoverPreviewLabel, ui.hoverPreviewHint],
    ['interface', 'hover-delay', ui.hoverDelayLabel, ui.hoverDelayHint],
    ['interface', 'page-animations', ui.pageAnimationsLabel, ui.pageAnimationsHint],
    ['interface', 'smooth-scrolling', ui.smoothScrollingLabel, ui.smoothScrollingHint],
    ['interface', 'toasts', ui.toastsLabel, ui.toastsHint],
    ['controls', 'keyboard-shortcuts', controls.shortcutsLabel, controls.shortcutsHint],
    ['controls', 'controls-hide', controls.hideLabel, controls.hideHint],
    ['controls', 'pause-spotlight', controls.spotlightLabel, controls.spotlightHint],
    inCapacitor() && ['controls', 'player-gestures', controls.gesturesLabel, controls.gesturesHint],
    inCapacitor() && ['controls', 'player-gesture-deadzone', controls.deadzoneLabel, controls.deadzoneHint],
    ['downloads', 'storage', play.storage, play.storageDescription],
    cellular && ['downloads', 'downloads-wifi-only', play.wifiOnlyLabel, play.wifiOnlyHint],
    ['downloads', 'video-download-quality', `${play.videoDownloadQualityLabel} (${play.videoDownloadsTitle})`, play.videoDownloadQualityHint],
    ['downloads', 'music-download-quality', `${play.downloadQualityLabel} (${play.musicDownloadsTitle})`, play.downloadQualityHint],
    ['downloads', 'video-prefetch', play.videoPrefetchLabel, play.videoPrefetchHint],
    ['downloads', 'video-cache-size', `${play.cacheSizeLabel} (${play.videoCache})`, play.videoCacheSizeHint],
    ['downloads', 'video-bitrate', play.videoBitrateLabel, play.videoBitrateHint],
    ['downloads', 'music-prefetch', play.prefetchLabel, play.prefetchHint],
    ['downloads', 'music-cache-size', `${play.cacheSizeLabel} (${play.cache})`, play.cacheSizeHint],
    ['downloads', 'music-keep-often', play.keepOftenLabel],
    inCapacitor() && ['app', 'auto-update', app.autoUpdateLabel, app.autoUpdateHint],
    inCapacitor() && ['app', 'auto-pip', app.autoPipLabel, app.autoPipHint],
    !!desktop() && ['app', 'desktop-autostart', ui.autostartLabel, ui.autostartHint],
    !!desktop() && ['app', 'desktop-start-in', ui.startInLabel, ui.startInHint],
    !!desktop() && ['app', 'desktop-close', ui.closeLabel, ui.closeHint],
    !!desktop() && ['app', 'desktop-auto-update', ui.autoUpdateLabel, ui.desktopAutoUpdateHint],
    !!desktop() && ['app', 'desktop-frameless', ui.framelessLabel, ui.framelessHint],
    ['app', 'about', app.about, `${app.version} ${app.build} ${app.server} ${app.updates}`],
  ]
  return entries.filter((entry): entry is Entry => !!entry)
}

/** Lower case without accents, so "uberblenden" finds "Überblenden". */
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** The settings matching every word of `query`: labels first, then those found only in their explanation. */
export function useSettingsSearch(query: string): SearchResult[] {
  const entries = useEntries()
  const pages = useSettingsPages()
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const scored = entries.flatMap(([pageKey, anchor, label, hint]) => {
    const page = pages.find((candidate) => candidate.key === pageKey)
    if (!page) return []
    const title = fold(`${label} ${page.label}`)
    const all = `${title} ${fold(hint ?? '')}`
    if (!words.every((word) => all.includes(word))) return []
    const score = words.every((word) => title.includes(word)) ? 0 : 1
    return [{ score, result: { key: `${pageKey}:${anchor}`, to: `${page.to}#${anchor}`, label, hint, page: page.label } }]
  })
  return scored.sort((a, b) => a.score - b.score).map((entry) => entry.result)
}
