import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { IconChevronDown, IconChevronUp, IconEye, IconEyeOff, IconGripVertical } from '@tabler/icons-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useUserViews } from '@/features/home/queries'
import { categoryMessages, categoryOf, orderViews } from '@/features/library/categories'
import { useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Section, SelectField, SettingsPage, SettingsPending } from './fields'
import { homeSettingsMessages } from './home-settings-messages'
import { useLocalSettings, type HomeLayout } from './local-settings'
import { useUpdateConfiguration, useUserConfiguration } from './use-user-configuration'


export function HomeSettingsPage() {
  const t = useMessages(homeSettingsMessages)
  const categories = useMessages(categoryMessages)
  const { settings, update } = useLocalSettings()
  const user = useUserConfiguration()
  const views = useUserViews()
  const save = useUpdateConfiguration()
  const [dragging, setDragging] = useState<string | null>(null)

  const config = user.data?.Configuration
  const layoutOptions: Array<{ value: HomeLayout; label: string }> = [
    { value: 'personal', label: t.layoutPersonal },
    { value: 'jellyfin', label: t.layoutJellyfin },
  ]

  if (!config || !views.data) {
    return (
      <SettingsPage title={t.title}>
        <SettingsPending error={user.isError || views.isError} onRetry={() => void Promise.all([user.refetch(), views.refetch()])} rows={4} />
      </SettingsPage>
    )
  }

  const ordered = orderViews(views.data, config.OrderedViews)
  const hidden = new Set(config.MyMediaExcludes ?? [])

  const saveOrder = (next: BaseItemDto[]) => save.mutate({ OrderedViews: next.map((view) => view.Id!) })
  const move = (from: number, to: number) => {
    if (to < 0 || to >= ordered.length || from === to) return
    const next = [...ordered]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved!)
    saveOrder(next)
  }
  const toggle = (id: string) => {
    const next = new Set(hidden)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    save.mutate({ MyMediaExcludes: [...next] })
  }

  return (
    <SettingsPage title={t.title} description={t.description} resetKeys={['homeLayout']}>
      <Section title={t.layout} scope="account">
        <SelectField
          id="home-layout"
          label={t.layoutLabel}
          hint={t.layoutHint}
          value={settings.homeLayout}
          options={layoutOptions}
          onChange={(value) => update({ homeLayout: value })}
        />
      </Section>

      <Section anchor="libraries" title={t.libraries} description={t.librariesHint} scope="account">
        <ul className="divide-y">
          {ordered.map((view, index) => {
            const name = view.Name ?? ''
            const isHidden = hidden.has(view.Id!)
            const category = categoryOf(view)
            return (
              <li
                key={view.Id}
                draggable
                onDragStart={(event) => {
                  setDragging(view.Id!)
                  event.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(event) => {
                  if (dragging && dragging !== view.Id) event.preventDefault()
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  const from = ordered.findIndex((entry) => entry.Id === dragging)
                  if (from >= 0) move(from, index)
                  setDragging(null)
                }}
                onDragEnd={() => setDragging(null)}
                className={cn('flex items-center gap-3 px-4 py-2.5', dragging === view.Id && 'opacity-50')}
              >
                <IconGripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
                <span className={cn('min-w-0 flex-1 truncate text-sm', isHidden && 'text-muted-foreground line-through')}>{name}</span>
                {/* Where it shows up in the navigation, which groups libraries by media type. */}
                {category && <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{categories[category]}</span>}
                {isHidden && <span className="text-xs text-muted-foreground">{t.hidden}</span>}
                <Button variant="ghost" size="icon-sm" aria-label={t.moveUp(name)} disabled={index === 0 || save.isPending} onClick={() => move(index, index - 1)}>
                  <IconChevronUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t.moveDown(name)}
                  disabled={index === ordered.length - 1 || save.isPending}
                  onClick={() => move(index, index + 1)}
                >
                  <IconChevronDown />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={t.show(name)} aria-pressed={!isHidden} disabled={save.isPending} onClick={() => toggle(view.Id!)}>
                  {isHidden ? <IconEyeOff /> : <IconEye />}
                </Button>
              </li>
            )
          })}
        </ul>
        <p className="px-4 pb-3 pt-1 text-xs text-muted-foreground">{t.dragHint}</p>
      </Section>
    </SettingsPage>
  )
}
