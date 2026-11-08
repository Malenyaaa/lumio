import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useItem } from '@/features/items/queries'
import { lumioGet, lumioSend } from '@/features/social/social'
import { plainText } from '@/lib/format'
import { defineMessages, LOCALES, useMessages, type Locale } from '@/lib/i18n'
import { localizedKey, localText, type LocalizedEntry, type LocalTexts, type TextLabel } from '@/lib/localized'
import { ownKey } from '@/lib/services'
import { cn } from '@/lib/utils'

const messages = defineMessages({
  de: {
    title: 'Texte und Sprachen',
    hint: 'Titel und Beschreibung auf Deutsch und Englisch. Lumio zeigt die Sprache der Oberfläche und sonst, was es gibt.',
    jellyfin: 'Text in Jellyfin',
    noText: 'Jellyfin hat keine Beschreibung.',
    labelTitle: 'Sprache des Jellyfin-Texts',
    labelAuto: (found: string) => `Erkennen (${found})`,
    labelName: (label: TextLabel) => ({ de: 'Deutsch', en: 'Englisch', unclear: 'unklar', none: 'kein Text' })[label],
    language: (lang: Locale) => ({ de: 'Deutsch', en: 'Englisch' })[lang],
    name: 'Titel',
    tagline: 'Slogan',
    overview: 'Beschreibung',
    fieldsHint: 'Leer lassen, um den Text von Jellyfin oder TMDb zu zeigen (grau vorgeschlagen).',
    sourceName: (source: 'jellyfin' | 'tmdb' | 'none') => ({ jellyfin: 'aus Jellyfin', tmdb: 'von TMDb', none: 'fehlt' })[source],
    save: 'Speichern',
    saved: 'Gespeichert',
    failed: 'Das hat nicht geklappt.',
    unavailable: 'Der Lumio-Server ist nicht erreichbar.',
    loading: 'Lädt …',
  },
  en: {
    title: 'Texts and languages',
    hint: 'Title and overview in German and English. Lumio shows the interface language, and otherwise whatever there is.',
    jellyfin: 'Text in Jellyfin',
    noText: 'Jellyfin has no overview.',
    labelTitle: "Language of Jellyfin's text",
    labelAuto: (found: string) => `Detect (${found})`,
    labelName: (label: TextLabel) => ({ de: 'German', en: 'English', unclear: 'unclear', none: 'no text' })[label],
    language: (lang: Locale) => ({ de: 'German', en: 'English' })[lang],
    name: 'Title',
    tagline: 'Tagline',
    overview: 'Overview',
    fieldsHint: "Leave empty to show Jellyfin's or TMDb's text (suggested in grey).",
    sourceName: (source: 'jellyfin' | 'tmdb' | 'none') => ({ jellyfin: 'from Jellyfin', tmdb: 'from TMDb', none: 'missing' })[source],
    save: 'Save',
    saved: 'Saved',
    failed: "That didn't work.",
    unavailable: "The Lumio server can't be reached.",
    loading: 'Loading …',
  },
})

export interface AdminLocalized extends LocalizedEntry {
  labelManual: boolean
  meta: { name: string; type: string; series?: string; year?: number; season?: number; episode?: number }
}

export const adminLocalizedKey = (id: string) => ['admin-localized-entry', id] as const

/** An item's full entry as an administrator sees it (made from Jellyfin's text when there is none yet). */
export function useAdminLocalized(id: string | null) {
  return useQuery({
    queryKey: adminLocalizedKey(id ?? ''),
    enabled: !!id,
    // Asked again on every opening: what is edited must be the current entry.
    refetchOnMount: 'always',
    queryFn: async () => {
      const response = await lumioGet(`/admin/localized/${id}`)
      if (!response?.ok) throw new Error('Unavailable')
      return (await response.json()) as AdminLocalized
    },
  })
}

/** After a change: the entry, the lists and everything showing the item ask again. */
export function useLocalizedChanged() {
  const client = useQueryClient()
  return (id: string, entry?: AdminLocalized | LocalizedEntry) => {
    if (entry) client.setQueryData(localizedKey(id), { label: entry.label, tmdb: entry.tmdb, edited: entry.edited, images: entry.images })
    void client.invalidateQueries({ queryKey: localizedKey(id) })
    void client.invalidateQueries({ queryKey: adminLocalizedKey(id) })
    void client.invalidateQueries({ queryKey: ['admin-localized'] })
  }
}

const FIELDS: Array<keyof LocalTexts> = ['name', 'tagline', 'overview']

function jellyfinField(item: BaseItemDto | undefined, field: keyof LocalTexts) {
  if (field === 'name') return item?.Name ?? undefined
  if (field === 'tagline') return item?.Taglines?.[0]
  return plainText(item?.Overview) || undefined
}

/** Where a text shown without an administrator's would come from. */
function sourceOf(entry: LocalizedEntry, lang: Locale, field: keyof LocalTexts, jellyfin: string | undefined) {
  const shown = localText({ ...entry, edited: {} }, lang, field, jellyfin)
  if (!shown) return 'none'
  return shown === jellyfin ? 'jellyfin' : 'tmdb'
}

function LanguageForm({ id, item, entry, onSaved }: { id: string; item: BaseItemDto | undefined; entry: AdminLocalized; onSaved: () => void }) {
  const t = useMessages(messages)
  const changed = useLocalizedChanged()
  const [label, setLabel] = useState<'auto' | Locale>(entry.labelManual && (entry.label === 'de' || entry.label === 'en') ? entry.label : 'auto')
  const [edited, setEdited] = useState<Partial<Record<Locale, LocalTexts>>>(entry.edited)
  const withTagline = entry.meta.type === 'Movie' || entry.meta.type === 'Series'
  const overview = plainText(item?.Overview)
  // What the fields suggest follows the chosen label right away.
  const preview: LocalizedEntry = { ...entry, label: label === 'auto' ? entry.label : label }
  const save = useMutation({
    mutationFn: async () => {
      const response = await lumioSend('POST', `/admin/localized/${id}`, { label: label === 'auto' ? (entry.labelManual ? null : undefined) : label, edited, tmdbKey: ownKey('tmdb') })
      if (!response?.ok) throw new Error('Failed')
      return (await response.json()) as AdminLocalized
    },
    onSuccess: (next) => {
      toast.success(t.saved)
      changed(id, next)
      onSaved()
    },
    onError: () => toast.error(t.failed),
  })
  const set = (lang: Locale, field: keyof LocalTexts, value: string) => setEdited((current) => ({ ...current, [lang]: { ...current[lang], [field]: value || undefined } }))
  const detected = entry.labelManual ? null : entry.label

  return (
    <div className="space-y-5">
      <section className="space-y-2 rounded-lg border p-3">
        <p className="text-xs font-medium text-muted-foreground">{t.jellyfin}</p>
        <p className="text-sm font-medium">{item?.Name}</p>
        {overview ? <p className="line-clamp-4 text-sm text-muted-foreground">{overview}</p> : <p className="text-sm text-muted-foreground">{t.noText}</p>}
      </section>

      <section className="space-y-2">
        <p className="text-sm font-medium">{t.labelTitle}</p>
        <div className="flex flex-wrap gap-2">
          {(['auto', ...LOCALES] as const).map((value) => (
            <Button key={value} size="sm" variant={label === value ? 'default' : 'outline'} onClick={() => setLabel(value)}>
              {value === 'auto' ? t.labelAuto(t.labelName(detected ?? 'unclear')) : t.labelName(value)}
            </Button>
          ))}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">{t.fieldsHint}</p>
      {LOCALES.map((lang) => (
        <section key={lang} className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold">{t.language(lang)}</h3>
          {FIELDS.filter((field) => field !== 'tagline' || withTagline).map((field) => {
            const jellyfin = jellyfinField(item, field)
            const suggestion = localText({ ...preview, edited: {} }, lang, field, jellyfin) ?? ''
            const source = sourceOf(preview, lang, field, jellyfin)
            const common = {
              value: edited[lang]?.[field] ?? '',
              placeholder: suggestion,
              onChange: (event: { target: { value: string } }) => set(lang, field, event.target.value),
              'aria-label': `${t[field]} (${t.language(lang)})`,
            }
            return (
              <label key={field} className="grid gap-1 text-sm">
                <span className="flex items-baseline justify-between gap-2 text-muted-foreground">
                  {t[field]}
                  {!edited[lang]?.[field] && <span className={cn('text-xs', source === 'none' && 'text-destructive')}>{t.sourceName(source)}</span>}
                </span>
                {field === 'overview' ? (
                  <textarea
                    {...common}
                    rows={5}
                    className="w-full rounded-lg border border-input bg-background/60 p-3 text-sm outline-none placeholder:text-muted-foreground/70 focus-visible:border-foreground/35 focus-visible:bg-background"
                  />
                ) : (
                  <Input {...common} />
                )}
              </label>
            )
          })}
        </section>
      ))}

      <div className="flex justify-end">
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          <IconDeviceFloppy /> {t.save}
        </Button>
      </div>
    </div>
  )
}

/**
 * An item's texts in both languages: which language Jellyfin's text is in (found by its words, or set here), and
 * texts written by hand where TMDb has none or a poor one.
 */
export function LanguageDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useMessages(messages)
  const item = useItem(id ?? '', !!id).data
  const entry = useAdminLocalized(id)
  const meta = entry.data?.meta
  const subtitle = meta ? [meta.series, meta.season !== undefined && meta.episode !== undefined ? `S${meta.season} · E${meta.episode}` : undefined, meta.year].filter(Boolean).join(' · ') : ''
  return (
    <Dialog open={!!id} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-4 overflow-hidden p-6 sm:max-w-2xl">
        <div className="space-y-1 pr-8">
          <DialogTitle className="truncate text-xl font-bold">
            {t.title}: {item?.Name ?? meta?.name}
          </DialogTitle>
          <DialogDescription>{subtitle || t.hint}</DialogDescription>
        </div>
        <div className="-mx-6 -mb-6 min-h-0 overflow-y-auto px-6 pb-6">
          {entry.isError && <p className="text-sm text-destructive">{t.unavailable}</p>}
          {!entry.isError && !entry.isFetchedAfterMount && <p className="text-sm text-muted-foreground">{t.loading}</p>}
          {/* The form starts from the server's current entry, never from one kept from an earlier visit. */}
          {id && entry.data && entry.isFetchedAfterMount && <LanguageForm key={id} id={id} item={item} entry={entry.data} onSaved={onClose} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
