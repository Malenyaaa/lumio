import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useUserViews } from '@/features/home/queries'
import { Section, SettingsPage, SwitchField } from '@/features/settings/fields'
import { useMessages } from '@/lib/i18n'
import { useLumioConfig } from './branding'
import type { HoverPreviewRules } from './lumio-config'
import { adminMessages } from './messages'
import { useIsAdmin, useSaveConfig } from './use-admin-config'

/** Item types a card can show, with the key of their label. */
const TYPES = [
  ['Movie', 'typeMovie'],
  ['Series', 'typeSeries'],
  ['Season', 'typeSeason'],
  ['Episode', 'typeEpisode'],
  ['BoxSet', 'typeBoxSet'],
  ['MusicAlbum', 'typeMusicAlbum'],
  ['MusicArtist', 'typeMusicArtist'],
  ['Audio', 'typeAudio'],
  ['AudioBook', 'typeAudioBook'],
  ['Book', 'typeBook'],
  ['Video', 'typeVideo'],
  ['Playlist', 'typePlaylist'],
] as const

/** Server-wide presentation settings: for now, where the hover preview opens. */
export function DisplayPage() {
  const t = useMessages(adminMessages)
  const isAdmin = useIsAdmin()
  const config = useLumioConfig().data ?? {}
  const views = useUserViews()
  const save = useSaveConfig()
  // Edits collect in a draft until saved, like on the branding page.
  const [draft, setDraft] = useState<HoverPreviewRules | null>(null)
  const rules = draft ?? config.hoverPreview ?? {}

  if (!isAdmin) {
    return (
      <SettingsPage title={t.displayTitle}>
        <p className="text-sm text-muted-foreground">{t.adminOnly}</p>
      </SettingsPage>
    )
  }

  const toggle = (key: keyof HoverPreviewRules, value: string, enabled: boolean) => {
    const current = new Set(rules[key] ?? [])
    if (enabled) current.delete(value)
    else current.add(value)
    setDraft({ ...rules, [key]: [...current] })
  }

  return (
    <SettingsPage title={t.displayTitle} description={t.displayDescription}>
      <p className="text-sm text-muted-foreground">{t.hoverPreviewHint}</p>
      <Section title={`${t.hoverPreview} · ${t.byType}`}>
        {TYPES.map(([type, label]) => (
          <SwitchField
            key={type}
            id={`hover-type-${type}`}
            label={t[label]}
            checked={!rules.disabledTypes?.includes(type)}
            onChange={(enabled) => toggle('disabledTypes', type, enabled)}
          />
        ))}
      </Section>

      <Section title={`${t.hoverPreview} · ${t.byLibrary}`}>
        {(views.data ?? []).map((view) => (
          <SwitchField
            key={view.Id}
            id={`hover-library-${view.Id}`}
            label={view.Name ?? ''}
            checked={!rules.disabledLibraries?.includes(view.Id!)}
            onChange={(enabled) => toggle('disabledLibraries', view.Id!, enabled)}
          />
        ))}
      </Section>

      <p className="text-xs text-muted-foreground">{t.storageNote}</p>

      <Section title={t.playerTitle}>
        <SwitchField
          id="player-loading-art"
          label={t.loadingArtLabel}
          hint={t.loadingArtHint}
          checked={config.playerLoadingArt !== false}
          disabled={save.isPending}
          onChange={(enabled) => save.mutate((current) => ({ ...current, playerLoadingArt: enabled }))}
        />
      </Section>

      {/* Users in a browser on these systems are pointed to the app (once, and in the profile menu). */}
      <Section title={t.appsTitle} description={t.appsDescription}>
        {([['android', 'Android'], ['windows', 'Windows'], ['linux', 'Linux']] as const).map(([platform, name]) => (
          <SwitchField
            key={platform}
            id={`promote-${platform}`}
            label={name}
            checked={config.appPromotion?.[platform] !== false}
            disabled={save.isPending}
            onChange={(enabled) => save.mutate((current) => ({ ...current, appPromotion: { ...current.appPromotion, [platform]: enabled } }))}
          />
        ))}
      </Section>

      <Section title={t.cacheTitle} description={t.cacheDescription}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-muted-foreground">{config.cacheVersion ? t.cacheResetCount(config.cacheVersion) : t.cacheNeverReset}</p>
          <Button
            variant="outline"
            disabled={save.isPending}
            onClick={() => save.mutate((current) => ({ ...current, cacheVersion: (current.cacheVersion ?? 0) + 1 }))}
          >
            {t.cacheReset}
          </Button>
        </div>
      </Section>

      {draft && (
        <div className="sticky bottom-[calc(var(--bottom-inset,0px)+1rem)] z-30 flex items-center justify-between gap-3 rounded-xl bg-popover/95 ring-1 ring-foreground/10 p-3 shadow-xl backdrop-blur animate-in fade-in-0 slide-in-from-bottom-2">
          <span className="text-sm text-muted-foreground">{t.unsaved}</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={save.isPending}>
              {t.discard}
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate((current) => ({ ...current, hoverPreview: draft }), { onSuccess: () => setDraft(null) })}>
              {save.isPending ? t.saving : t.save}
            </Button>
          </div>
        </div>
      )}
    </SettingsPage>
  )
}
