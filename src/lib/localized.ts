import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { lumioSend } from '@/features/social/social'
import { useLocale, type Locale } from './i18n'
import { apiBase } from './platform'
import { hasService, ownKey } from './services'

/**
 * Films and series in the interface's language. Jellyfin keeps one title, overview and tagline per item; the Lumio
 * server knows which language that text is in and keeps the other from TMDb (or as an administrator wrote it), along
 * with posters and logos per language (see server/src/languages.ts). Cards, the hero and the detail pages show the
 * item through `useLocalizedItem`; whatever exists is shown when only one language does.
 */

export interface LocalTexts {
  name?: string
  overview?: string
  tagline?: string
}

export type LocalImageKind = 'Primary' | 'Logo' | 'Thumb' | 'Banner'
export type TextLabel = Locale | 'unclear' | 'none'

export interface LocalizedEntry {
  /** The language of Jellyfin's text (found by its words, or set by an administrator). */
  label: TextLabel
  tmdb: Partial<Record<Locale, LocalTexts>>
  edited: Partial<Record<Locale, LocalTexts>>
  /** The pictures to show per language, by when they changed; null: Jellyfin's. */
  images: Partial<Record<Locale, Partial<Record<LocalImageKind, number | null>>>>
}

/** What can be told in two languages (TMDb knows them). */
export const LOCALIZABLE = new Set(['Movie', 'Series', 'Season', 'Episode'])

// ---- entries, asked for together: a row of cards is one request ----

let waiting = new Map<string, Array<{ resolve: (value: LocalizedEntry | null) => void; reject: (error: Error) => void }>>()
let timer: number | undefined

function flush() {
  const batch = waiting
  waiting = new Map()
  timer = undefined
  const ids = [...batch.keys()]
  for (let start = 0; start < ids.length; start += 300) {
    const chunk = ids.slice(start, start + 300)
    void lumioSend('POST', '/localized', { ids: chunk })
      .then(async (response) => {
        // No connection yet (right after loading) or the server failed: the queries ask again shortly.
        if (!response?.ok) throw new Error('Lumio server unavailable')
        return (await response.json()) as Record<string, LocalizedEntry>
      })
      .then(
        (known) => {
          for (const id of chunk) for (const { resolve } of batch.get(id) ?? []) resolve(known[id] ?? null)
        },
        (error: Error) => {
          for (const id of chunk) for (const { reject } of batch.get(id) ?? []) reject(error)
        },
      )
  }
}

function storedEntry(id: string): Promise<LocalizedEntry | null> {
  return new Promise((resolve, reject) => {
    waiting.set(id, [...(waiting.get(id) ?? []), { resolve, reject }])
    timer ??= window.setTimeout(flush, 20)
  })
}

export const localizedKey = (id: string) => ['localized', id] as const

export function localizedQuery(id: string) {
  // Kept with the other queries across starts (lib/query-persist), so asked again soon: an administrator's change shows
  // up within a minute everywhere.
  return { queryKey: localizedKey(id), queryFn: () => storedEntry(id), staleTime: 60_000, retry: 2 }
}

// ---- which text and picture to show ----

const other = (lang: Locale): Locale => (lang === 'de' ? 'en' : 'de')

/**
 * One text in a language: an administrator's, else Jellyfin's when it is in that language (or can't be told), else
 * TMDb's, else whatever there is.
 */
export function localText(entry: LocalizedEntry, lang: Locale, field: keyof LocalTexts, jellyfin: string | null | undefined): string | undefined {
  const edited = entry.edited[lang]?.[field]
  if (edited) return edited
  if (jellyfin && (entry.label === lang || entry.label === 'unclear')) return jellyfin
  return entry.tmdb[lang]?.[field] || jellyfin || entry.edited[other(lang)]?.[field] || entry.tmdb[other(lang)]?.[field] || undefined
}

export function localizedImageUrl(id: string, lang: Locale, kind: LocalImageKind, at: number) {
  return `${apiBase()}/localized-image/${id}/${lang}/${kind}?v=${at}`
}

/** The language's pictures of an item and of its series, carried on the item for lib/images. */
export interface LumioImages {
  own: Partial<Record<LocalImageKind, string>>
  series: Partial<Record<LocalImageKind, string>>
}

export type LocalizedItem = BaseItemDto & { LumioImages?: LumioImages }

function imagesOf(id: string | null | undefined, entry: LocalizedEntry | null | undefined, lang: Locale): Partial<Record<LocalImageKind, string>> {
  const result: Partial<Record<LocalImageKind, string>> = {}
  if (!id || !entry) return result
  for (const [kind, at] of Object.entries(entry.images[lang] ?? {}) as Array<[LocalImageKind, number | null]>) {
    if (at) result[kind] = localizedImageUrl(id, lang, kind, at)
  }
  return result
}

/** An item as told in a language: its texts (and its series' name), and its language's pictures. */
export function localize<T extends BaseItemDto>(item: T, entry: LocalizedEntry | null | undefined, seriesEntry: LocalizedEntry | null | undefined, lang: Locale): T & LocalizedItem {
  if (!entry && !seriesEntry) return item
  const next: T & LocalizedItem = { ...item }
  if (entry) {
    next.Name = localText(entry, lang, 'name', item.Name) ?? item.Name
    next.Overview = localText(entry, lang, 'overview', item.Overview) ?? item.Overview
    const tagline = localText(entry, lang, 'tagline', item.Taglines?.[0])
    if (tagline) next.Taglines = [tagline]
  }
  if (seriesEntry && item.SeriesName) next.SeriesName = localText(seriesEntry, lang, 'name', item.SeriesName) ?? item.SeriesName
  next.LumioImages = { own: imagesOf(item.Id, entry, lang), series: imagesOf(item.SeriesId, seriesEntry, lang) }
  return next
}

/**
 * The item in the interface's language (the same item until the Lumio server answered, or when it knows nothing of
 * it). With `lookUp`, an item not filled in yet is looked up on TMDb now (its whole film or series, once per session).
 */
export function useLocalizedItem<T extends BaseItemDto | undefined>(item: T, lookUp = false): T extends BaseItemDto ? T & LocalizedItem : T {
  const lang = useLocale()
  const client = useQueryClient()
  const enabled = !!item?.Id && LOCALIZABLE.has(item.Type ?? '')
  const seriesId = enabled && item?.SeriesId && item.SeriesId !== item.Id ? item.SeriesId : undefined
  const [own, series] = useQueries({
    queries: [
      { ...localizedQuery(item?.Id ?? ''), enabled },
      { ...localizedQuery(seriesId ?? ''), enabled: !!seriesId },
    ],
  })
  const missing = enabled && own?.isSuccess && own.data === null
  useEffect(() => {
    if (!lookUp || !missing || !item?.Id || !hasService('tmdb') || lookedUp.has(item.Id)) return
    lookedUp.add(item.Id)
    void lumioSend('POST', '/localized/lookup', { id: item.Id, tmdbKey: ownKey('tmdb') }).then(async (response) => {
      if (!response?.ok) return
      // The whole film or series is filled in now: everything of it that was missing is asked for again.
      await client.invalidateQueries({ queryKey: ['localized'], predicate: (query) => query.state.data === null })
    })
  }, [lookUp, missing, item?.Id, client])
  return useMemo(
    () => (enabled && item ? localize(item, own?.data, series?.data, lang) : item) as T extends BaseItemDto ? T & LocalizedItem : T,
    [enabled, item, own?.data, series?.data, lang],
  )
}

const lookedUp = new Set<string>()
