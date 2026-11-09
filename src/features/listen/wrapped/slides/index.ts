import type { WrappedSlide } from '../slide-kit'

/**
 * Every Wrapped slide: each file in this folder is one (its default export). A new file is picked up by itself and
 * joins the draw for its topic. Give a new slide `since: <the coming year>`, so years already out keep their slides,
 * and keep a slide's id once it shipped.
 */
const modules = import.meta.glob<{ default: WrappedSlide }>(['./*.tsx'], { eager: true })

export const SLIDES: WrappedSlide[] = Object.values(modules)
  .map((module) => module.default)
  .sort((a, b) => a.id.localeCompare(b.id))
