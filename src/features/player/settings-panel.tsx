import { IconChartBar, IconCheck, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocale, useMessages } from '@/lib/i18n'
import { fitLabels, mbitLabel, SPEEDS, speedLabel, VIDEO_FITS } from './labels'
import type { VideoFit } from '@/features/settings/local-settings'
import { cn } from '@/lib/utils'
import { settingsPanelMessages } from './messages'
import { moveMenuFocus, usePanelFocus } from './panel-focus'
import { QUALITY_OPTIONS, type StreamOption } from './playback'

interface SettingsPanelProps {
  audio: StreamOption[]
  audioIndex?: number
  onAudio: (index: number) => void
  subtitles: StreamOption[]
  /** -1 means subtitles are off. */
  subtitleIndex: number
  onSubtitle: (index: number) => void
  maxBitrate?: number
  onQuality: (bitrate?: number) => void
  /** Opens the "Statistik für Interessierte" overlay (and closes the panel). */
  onShowStats: () => void
  speed: number
  /** In a SyncPlay group everyone plays at normal speed. */
  speedLocked?: boolean
  onSpeed: (speed: number) => void
  /** Omitted for items without a picture. */
  fit?: VideoFit
  /** What "Automatisch" currently does, e.g. "Füllen". */
  autoFitLabel?: string
  onFit?: (fit: VideoFit) => void
  /** Playing the exit animation; the player unmounts the panel once it has finished. */
  closing?: boolean
  /** Music and audiobooks: no subtitles or picture quality, and the audio track only when there is a choice. */
  audioOnly?: boolean
}

type Page = 'main' | 'audio' | 'subtitles' | 'quality' | 'speed' | 'fit'






const ROW =
  'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-none transition-colors hover:bg-white/10 focus-visible:bg-white/10'

function Choice({ selected, onSelect, children }: { selected: boolean; onSelect: () => void; children: ReactNode }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={selected} onClick={onSelect} className={cn(ROW, selected && 'font-medium')}>
      <span className="grid size-4 shrink-0 place-items-center">{selected && <IconCheck className="size-4" />}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  )
}

function Submenu({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div role="group" aria-label={title}>
      <button type="button" role="menuitem" onClick={onBack} className={cn(ROW, 'mb-1 border-b border-white/10 rounded-b-none font-medium')}>
        <IconChevronLeft className="size-4 shrink-0" />
        {title}
      </button>
      {children}
    </div>
  )
}

/** Short names for the main menu; the full track descriptions only appear inside the submenus. */
function shortTitle(option?: StreamOption) {
  if (!option) return '–'
  return option.title.split(' - ')[0]
}

export function SettingsPanel({
  audio,
  audioIndex,
  onAudio,
  subtitles,
  subtitleIndex,
  onSubtitle,
  maxBitrate,
  onQuality,
  onShowStats,
  speed,
  speedLocked,
  onSpeed,
  fit,
  autoFitLabel,
  onFit,
  closing,
  audioOnly,
}: SettingsPanelProps) {
  const t = useMessages(settingsPanelMessages)
  const fitNames = useMessages(fitLabels)
  const locale = useLocale()
  const [page, setPage] = useState<Page>('main')
  // Which way the content slides: into a submenu from the right, back to the overview from the left. Nothing on open.
  const [direction, setDirection] = useState<'forward' | 'back' | null>(null)
  const open = (next: Exclude<Page, 'main'>) => {
    setDirection('forward')
    setPage(next)
  }
  const back = () => {
    setDirection('back')
    setPage('main')
  }
  const menu = useRef<HTMLDivElement>(null)
  usePanelFocus(menu, page)

  // The panel animates its height between pages, so it is set explicitly from the measured content.
  const content = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState<number | null>(null)
  useEffect(() => {
    const element = content.current
    if (!element) return
    const observer = new ResizeObserver(() => setContentHeight(element.offsetHeight))
    observer.observe(element)
    return () => observer.disconnect()
    // The content element is re-created (keyed) for every page.
  }, [page])

  const currentAudio = audio.find((option) => option.index === audioIndex)
  const currentSubtitle = subtitles.find((option) => option.index === subtitleIndex)
  // The default from the settings page may not be one of the fixed steps; keep it in the list so it shows as selected.
  const qualityOptions = (QUALITY_OPTIONS.some((option) => option.bitrate === maxBitrate) ? QUALITY_OPTIONS : [...QUALITY_OPTIONS, { bitrate: maxBitrate }]).map(
    ({ resolution, bitrate }) => ({
      bitrate,
      label: bitrate === undefined ? t.original : [resolution, mbitLabel(bitrate, undefined, locale)].filter(Boolean).join(' · '),
    }),
  )
  const currentQuality = qualityOptions.find((option) => option.bitrate === maxBitrate)

  // A category with nothing to choose (a single audio track, no subtitles) only shows what there is and can't be opened.
  const allRows: Array<{ page: Exclude<Page, 'main'>; label: string; value: string; disabled?: boolean }> = [
    { page: 'audio', label: t.audio, value: audio.length ? shortTitle(currentAudio ?? audio[0]) : t.none, disabled: audio.length <= 1 },
    {
      page: 'subtitles',
      label: t.subtitles,
      value: subtitles.length === 0 ? t.none : subtitleIndex < 0 ? t.off : shortTitle(currentSubtitle),
      disabled: subtitles.length === 0,
    },
    { page: 'quality', label: t.quality, value: currentQuality?.label ?? t.original },
    { page: 'speed', label: t.speed, value: speedLabel(speed, locale), disabled: speedLocked },
    ...(fit && onFit
      ? [{ page: 'fit' as const, label: t.fit, value: fit === 'auto' && autoFitLabel ? t.autoShort(autoFitLabel) : fitNames[fit] }]
      : []),
  ]
  const rows = audioOnly ? allRows.filter((row) => row.page === 'speed' || (row.page === 'audio' && audio.length > 1)) : allRows

  // A choice closes the submenu so the effect is visible right away.
  const pick = (action: () => void) => () => {
    action()
    back()
  }

  return (
    <div
      ref={menu}
      role="menu"
      aria-label={t.title}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' && page !== 'main') back()
        else moveMenuFocus(event)
      }}
      // Keep clicks inside the panel from reaching the click surface behind it (which would toggle playback).
      onPointerUp={(event) => event.stopPropagation()}
      style={{ height: contentHeight === null ? undefined : contentHeight + PANEL_PADDING }}
      inert={closing}
      className={cn(
        'absolute bottom-[4.75rem] right-4 z-20 max-h-[65svh] w-72 origin-bottom-right overflow-y-auto overflow-x-hidden overscroll-contain rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border border-white/10 bg-black/85 p-1.5 text-white shadow-2xl backdrop-blur-md transition-[height] duration-200 ease-out motion-reduce:transition-none sm:right-8',
        // Grows out of the settings button (bottom right) and shrinks back into it.
        closing
          ? 'pointer-events-none animate-out fade-out-0 zoom-out-95 slide-out-to-bottom-2 fill-mode-forwards duration-150'
          : 'animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2',
      )}
    >
      <div
        ref={content}
        key={page}
        className={cn(
          'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200',
          direction === 'forward' && 'motion-safe:slide-in-from-right-6',
          direction === 'back' && 'motion-safe:slide-in-from-left-6',
        )}
      >
      {page === 'main' && (
        <>
          {rows.map((row) => (
            <button key={row.page} type="button" role="menuitem" disabled={row.disabled} onClick={() => open(row.page)} className={cn(ROW, 'disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent')}>
              <span className="flex-1">{row.label}</span>
              <span className="max-w-32 truncate text-white/60">{row.value}</span>
              <IconChevronRight className={cn('size-4 shrink-0 text-white/60', row.disabled && 'invisible')} />
            </button>
          ))}
          <div className="my-1 border-t border-white/10" />
          <button type="button" role="menuitem" onClick={onShowStats} className={cn(ROW, 'text-white/70')}>
            <IconChartBar className="size-4 shrink-0" />
            <span className="flex-1">{t.stats}</span>
          </button>
        </>
      )}

      {page === 'audio' && (
        <Submenu title={t.audio} onBack={back}>
          {audio.map((option) => (
            <Choice key={option.index} selected={option.index === audioIndex} onSelect={pick(() => onAudio(option.index))}>
              {option.title}
            </Choice>
          ))}
        </Submenu>
      )}

      {page === 'subtitles' && (
        <Submenu title={t.subtitles} onBack={back}>
          <Choice selected={subtitleIndex < 0} onSelect={pick(() => onSubtitle(-1))}>
            {t.off}
          </Choice>
          {subtitles.map((option) => (
            <Choice key={option.index} selected={option.index === subtitleIndex} onSelect={pick(() => onSubtitle(option.index))}>
              {option.title}
            </Choice>
          ))}
          {subtitles.length === 0 && <p className="px-2 py-2 text-sm text-white/50">{t.none}</p>}
        </Submenu>
      )}

      {page === 'quality' && (
        <Submenu title={t.quality} onBack={back}>
          {qualityOptions.map((option) => (
            <Choice key={option.bitrate ?? 'original'} selected={option.bitrate === maxBitrate} onSelect={pick(() => onQuality(option.bitrate))}>
              {option.label}
            </Choice>
          ))}
        </Submenu>
      )}

      {page === 'speed' && (
        <Submenu title={t.speed} onBack={back}>
          {SPEEDS.map((option) => (
            <Choice key={option} selected={option === speed} onSelect={pick(() => onSpeed(option))}>
              {speedLabel(option, locale)}
            </Choice>
          ))}
        </Submenu>
      )}

      {page === 'fit' && fit && onFit && (
        <Submenu title={t.fit} onBack={back}>
          {VIDEO_FITS.map((option) => (
            <Choice key={option} selected={option === fit} onSelect={pick(() => onFit(option))}>
              {option === 'auto' && autoFitLabel ? t.autoLong(autoFitLabel) : fitNames[option]}
            </Choice>
          ))}
        </Submenu>
      )}
      </div>
    </div>
  )
}

/**
 * Added to the measured content height: the padding (p-1.5 on both sides) and the 1px border on both sides. The panel is
 * border-box sized, so leaving the border out made the content 2px too tall for it, which showed a scrollbar.
 */
const PANEL_PADDING = 14
