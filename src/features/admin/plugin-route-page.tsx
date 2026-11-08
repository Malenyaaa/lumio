import { useEffect, useRef } from 'react'
import { useParams } from 'react-router'
import { NotFound } from '@/components/not-found'
import { usePluginRegistry } from './plugins'

/** Pages that plugins add with `lumio.addRoute({ path, render })`, served at /plugin/<path>. */
export function PluginRoutePage() {
  const path = (useParams()['*'] ?? '').replace(/^\/+|\/+$/g, '')
  const route = usePluginRegistry().routes.find((candidate) => candidate.path === path)
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = host.current
    if (!element || !route) return
    if (route.title) document.title = route.title
    let cleanup: void | (() => void)
    try {
      cleanup = route.render(element, { path })
    } catch (error) {
      console.error(`Plugin page "${path}" failed`, error)
    }
    return () => {
      if (typeof cleanup === 'function') cleanup()
      element.replaceChildren()
    }
  }, [route, path])

  if (!route) return <NotFound />
  return <div ref={host} className="px-4 pb-12 pt-20 sm:px-8" />
}
