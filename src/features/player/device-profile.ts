import { DlnaProfileType, EncodingContext, MediaStreamProtocol, type DeviceProfile } from '@jellyfin/sdk/lib/generated-client/models'
import { getBrowserDeviceProfile } from '@jellyfin/sdk/lib/utils/browser-profiles'

const MAX_BITRATE = 120_000_000

/**
 * Describes what this browser can play so the server can choose direct play, direct stream or transcode.
 * The SDK's own `getBrowserDeviceProfile` only fills subtitle profiles, so the rest is probed here.
 */
export function buildDeviceProfile(maxAudioChannels = 6): DeviceProfile {
  const video = document.createElement('video')
  const can = (type: string) => video.canPlayType(type) !== ''

  const videoCodecs = [
    can('video/mp4; codecs="avc1.640029"') && 'h264',
    (can('video/mp4; codecs="hvc1.1.6.L120.B0"') || can('video/mp4; codecs="hev1.1.6.L120.B0"')) && 'hevc',
    can('video/webm; codecs="vp9"') && 'vp9',
    can('video/mp4; codecs="av01.0.15M.08"') && 'av1',
  ].filter(Boolean) as string[]

  const mp4Audio = [
    can('audio/mp4; codecs="mp4a.40.2"') && 'aac',
    can('audio/mpeg') && 'mp3',
    can('audio/mp4; codecs="ac-3"') && 'ac3',
    can('audio/mp4; codecs="ec-3"') && 'eac3',
    can('audio/webm; codecs="opus"') && 'opus',
    can('audio/flac') && 'flac',
  ].filter(Boolean) as string[]

  const hlsAudio = mp4Audio.filter((codec) => ['aac', 'mp3', 'ac3', 'eac3'].includes(codec))
  // Chromium (Chrome, Edge, Opera …) plays Matroska with supported codecs even though canPlayType says no. WebM support
  // alone says nothing about that: Firefox and Safari play WebM but refuse .mkv files.
  const matroska = can('video/x-matroska') || /\bChrome\//.test(navigator.userAgent)

  // Audio containers the browser can play as-is (checked one by one; support differs a lot between browsers).
  const audioFormats = [
    can('audio/mpeg') && 'mp3',
    can('audio/wav') && 'wav',
    can('audio/flac') && 'flac',
    can('audio/mp4; codecs="mp4a.40.2"') && 'aac,m4a,m4b,mp4',
    can('audio/ogg; codecs="vorbis"') && 'ogg,oga',
    can('audio/ogg; codecs="opus"') && 'opus',
    can('audio/webm; codecs="opus"') && 'webm,webma',
  ].filter(Boolean) as string[]

  const directPlayVideo = (container: string) => ({
    Type: DlnaProfileType.Video,
    Container: container,
    VideoCodec: videoCodecs.join(','),
    AudioCodec: mp4Audio.join(','),
  })

  return {
    Name: 'Lumio Web',
    MaxStreamingBitrate: MAX_BITRATE,
    MaxStaticBitrate: MAX_BITRATE,
    MusicStreamingTranscodingBitrate: 192_000,
    DirectPlayProfiles: [
      directPlayVideo('mp4,m4v'),
      ...(matroska ? [directPlayVideo('mkv')] : []),
      { Type: DlnaProfileType.Video, Container: 'webm', VideoCodec: 'vp8,vp9,av1', AudioCodec: 'vorbis,opus' },
      ...audioFormats.map((container) => ({ Type: DlnaProfileType.Audio, Container: container })),
    ],
    TranscodingProfiles: [
      {
        Type: DlnaProfileType.Video,
        Container: 'ts',
        VideoCodec: 'h264',
        AudioCodec: hlsAudio.join(',') || 'aac',
        Context: EncodingContext.Streaming,
        Protocol: MediaStreamProtocol.Hls,
        MaxAudioChannels: String(maxAudioChannels),
        MinSegments: 1,
        BreakOnNonKeyFrames: true,
      },
      {
        Type: DlnaProfileType.Audio,
        Container: 'mp3',
        AudioCodec: 'mp3',
        Context: EncodingContext.Streaming,
        Protocol: MediaStreamProtocol.Http,
      },
    ],
    CodecProfiles: [],
    ContainerProfiles: [],
    SubtitleProfiles: getBrowserDeviceProfile({}, video).SubtitleProfiles,
  }
}
