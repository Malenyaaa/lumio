import { IconAlertTriangle, IconCode, IconLink, IconPuzzle, IconTrash } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Section, SettingsPage } from '@/features/settings/fields'
import { useLocale, useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useLumioConfig } from './branding'
import type { PluginEntry } from './lumio-config'
import { adminMessages } from './messages'
import { useIsAdmin, useSaveConfig } from './use-admin-config'

export function PluginsPage() {
  const t = useMessages(adminMessages)
  const isAdmin = useIsAdmin()
  const plugins = useLumioConfig().data?.plugins ?? []
  const save = useSaveConfig()

  if (!isAdmin) {
    return (
      <SettingsPage title={t.pluginsTitle}>
        <p className="text-sm text-muted-foreground">{t.adminOnly}</p>
      </SettingsPage>
    )
  }

  const change = (fn: (plugins: PluginEntry[]) => PluginEntry[]) => save.mutate((current) => ({ ...current, plugins: fn(current.plugins ?? []) }))

  return (
    <SettingsPage title={t.pluginsTitle} description={t.pluginsDescription}>
      <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
        <IconAlertTriangle className="size-5 shrink-0 text-amber-400" />
        <p>{t.pluginsWarning}</p>
      </div>

      <Section title={t.installed}>
        {plugins.length === 0 && <p className="p-4 text-sm text-muted-foreground">{t.noPlugins}</p>}
        {plugins.map((plugin) => (
          <div key={plugin.id} className="flex items-center gap-3 p-4">
            {plugin.source.type === 'url' ? <IconLink className="size-4 shrink-0 text-muted-foreground" /> : <IconCode className="size-4 shrink-0 text-muted-foreground" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{plugin.name}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {plugin.source.type === 'url' ? plugin.source.url : `${plugin.source.code.length} B`}
              </p>
            </div>
            <Toggle
              label={`${t.enabled}: ${plugin.name}`}
              checked={plugin.enabled}
              disabled={save.isPending}
              onChange={(enabled) => change((list) => list.map((entry) => (entry.id === plugin.id ? { ...entry, enabled } : entry)))}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t.deletePlugin(plugin.name)}
              title={t.deletePlugin(plugin.name)}
              disabled={save.isPending}
              onClick={() => change((list) => list.filter((entry) => entry.id !== plugin.id))}
            >
              <IconTrash />
            </Button>
          </div>
        ))}
      </Section>

      <Catalog installed={plugins} pending={save.isPending} onAdd={(plugin) => change((list) => [...list, plugin])} />

      <AddPlugin pending={save.isPending} onAdd={(plugin) => change((list) => [...list, plugin])} />

      <Section title={t.apiTitle}>
        <div className="space-y-3 p-4 text-sm">
          <p className="text-muted-foreground">{t.apiIntro}</p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {[t.apiStyle, t.apiNav, t.apiSlots, t.apiRoutes, t.apiHide, t.apiTransform, t.apiEvents].map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 font-mono text-xs leading-relaxed">{EXAMPLE}</pre>
        </div>
      </Section>
    </SettingsPage>
  )
}

const EXAMPLE = `export default function setup(lumio) {
  lumio.addStyle('.hero h1 { color: gold }')
  lumio.addNavLink({ id: 'requests', label: 'Requests', href: 'https://requests.example.com', external: true })
  lumio.hide('header:cast')
  lumio.addSlot('item:bottom', (element, { item }) => {
    element.textContent = \`Item: \${item.Name}\`
  })
  lumio.transform('homeRows', (rows) => rows.filter((row) => row.id !== 'latest-music'))
  lumio.on('playback:start', ({ itemId }) => console.log('playing', itemId))
}`

/**
 * The plugin store: the catalog in Lumio's repository (plugins/catalog.json), read when the page opens, so plugins
 * merged there show up on every instance without a redeploy. VITE_PLUGIN_CATALOG_URL points elsewhere.
 */
const CATALOG_URL = import.meta.env.VITE_PLUGIN_CATALOG_URL?.trim() || 'https://raw.githubusercontent.com/PalmarHealer/lumio/main/plugins/catalog.json'

interface CatalogEntry {
  id: string
  name: string
  description: Partial<Record<'de' | 'en', string>>
  url: string
  author?: string
  homepage?: string
  /** A Jellyfin plugin it needs, by name. */
  requires?: string
}

/** The plugins that come with Lumio (public/plugins), one click to add; served with the app, so they update with it. */
function Catalog({ installed, pending, onAdd }: { installed: PluginEntry[]; pending: boolean; onAdd: (plugin: PluginEntry) => void }) {
  const t = useMessages(adminMessages)
  const locale = useLocale()
  const catalog = useQuery({
    queryKey: ['plugin-catalog'],
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const response = await fetch(CATALOG_URL, { cache: 'no-cache' }).catch(() => null)
      const entries = response?.ok ? ((await response.json()) as unknown) : []
      // Only well-formed entries with an https module.
      return (Array.isArray(entries) ? entries : []).filter(
        (entry): entry is CatalogEntry => !!entry && typeof entry.id === 'string' && typeof entry.name === 'string' && typeof entry.url === 'string' && entry.url.startsWith('https://'),
      )
    },
  })
  if (!catalog.data?.length) return null
  return (
    <Section title={t.available} description={t.availableHint}>
      {catalog.data.map((entry) => {
        const added = installed.some((plugin) => plugin.id === entry.id)
        return (
          <div key={entry.id} className="flex items-center gap-3 p-4">
            <IconPuzzle className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{entry.name}</p>
              <p className="text-xs text-muted-foreground">{entry.description[locale] ?? entry.description.en}</p>
              {entry.requires && <p className="text-xs text-muted-foreground">{t.requiresJellyfin(entry.requires)}</p>}
              {(entry.author || entry.homepage) && (
                <p className="text-xs text-muted-foreground">
                  {entry.homepage ? (
                    <a href={entry.homepage} target="_blank" rel="noreferrer noopener" className="hover:underline">
                      {entry.author ?? entry.homepage}
                    </a>
                  ) : (
                    entry.author
                  )}
                </p>
              )}
            </div>
            <Button size="sm" variant={added ? 'ghost' : 'outline'} disabled={pending || added} onClick={() => onAdd({ id: entry.id, name: entry.name, enabled: true, source: { type: 'url', url: entry.url } })}>
              {added ? t.added : t.addFromCatalog}
            </Button>
          </div>
        )
      })}
    </Section>
  )
}

function AddPlugin({ pending, onAdd }: { pending: boolean; onAdd: (plugin: PluginEntry) => void }) {
  const t = useMessages(adminMessages)
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'url' | 'code'>('url')
  const [url, setUrl] = useState('')
  const [code, setCode] = useState('')
  const valid = name.trim() && (mode === 'url' ? /^https?:\/\/\S+$/.test(url.trim()) : code.trim())

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!valid) return
    onAdd({
      id: crypto.randomUUID(),
      name: name.trim(),
      enabled: true,
      source: mode === 'url' ? { type: 'url', url: url.trim() } : { type: 'code', code },
    })
    setName('')
    setUrl('')
    setCode('')
  }

  return (
    <Section title={t.addPlugin}>
      <form onSubmit={onSubmit} className="space-y-3 p-4">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t.pluginName} aria-label={t.pluginName} maxLength={60} />
        <div className="inline-flex rounded-lg border p-0.5" role="group">
          {(['url', 'code'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => setMode(option)}
              className={cn('rounded-md px-3 py-1 text-sm transition-colors', mode === option ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')}
            >
              {option === 'url' ? t.sourceUrl : t.sourceCode}
            </button>
          ))}
        </div>
        {mode === 'url' ? (
          <div className="space-y-1">
            <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/lumio-plugin.js" aria-label={t.moduleUrl} className="font-mono" />
            <p className="text-xs text-muted-foreground">{t.moduleUrlHint}</p>
          </div>
        ) : (
          <textarea
            value={code}
            onChange={(event) => setCode(event.target.value)}
            aria-label={t.moduleCode}
            spellCheck={false}
            rows={10}
            placeholder={EXAMPLE}
            className="w-full rounded-lg border border-input bg-background/60 p-3 font-mono text-xs outline-none focus-visible:border-foreground/35 focus-visible:bg-background"
          />
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={!valid || pending}>
            {t.add}
          </Button>
        </div>
      </form>
    </Section>
  )
}

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-input',
      )}
    >
      <span className={cn('size-5 rounded-full shadow transition-transform', checked ? 'translate-x-5 bg-primary-foreground' : 'bg-background')} />
    </button>
  )
}
