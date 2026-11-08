import { useEffect, useRef } from 'react'
import { useParams } from 'react-router'
import { NotFound } from '@/components/not-found'
import { useIsAdmin } from './use-admin-config'
import { usePluginRegistry } from './plugins'

/** A settings page a plugin added with `lumio.addSettingsPage({ id, label, render })`, at /settings/plugin/<id>. */
export function PluginSettingsPage() {
  const { id = '' } = useParams()
  const page = usePluginRegistry().settingsPages.find((candidate) => candidate.id === id)
  const isAdmin = useIsAdmin()
  const host = useRef<HTMLDivElement>(null)
  const allowed = !!page && (!page.admin || isAdmin)

  useEffect(() => {
    const element = host.current
    if (!element || !page || !allowed) return
    let cleanup: void | (() => void)
    try {
      cleanup = page.render(element, { id })
    } catch (error) {
      console.error(`Plugin settings page "${id}" failed`, error)
    }
    return () => {
      if (typeof cleanup === 'function') cleanup()
      element.replaceChildren()
    }
  }, [page, id, allowed])

  if (!allowed) return <NotFound />
  return (
    <div className="min-w-0 flex-1 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{page.label}</h1>
      </header>
      <div ref={host} />
    </div>
  )
}
