import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react'
import { isRouteErrorResponse, useLocation, useRouteError } from 'react-router'
import { errorMessages } from '@/components/messages'
import { Button } from '@/components/ui/button'
import { useMessages } from '@/lib/i18n'

interface Props {
  children: ReactNode
  resetKey: string
}

interface State {
  error: Error | null
  resetKey: string
}

class Boundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <ErrorScreen message={this.state.error.message} />
  }
}

function ErrorScreen({ message }: { message: string }) {
  const t = useMessages(errorMessages)
  return (
    <div className="grid min-h-svh place-items-center px-4 text-center">
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">{t.title}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
        <Button onClick={() => window.location.reload()}>{t.reload}</Button>
      </div>
    </div>
  )
}

/** Catches render errors per route; navigating elsewhere clears the error. */
export function ErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <Boundary resetKey={pathname}>{children}</Boundary>
}

/**
 * The data router catches errors thrown while rendering a route (and failed lazy chunk loads) itself, before
 * ErrorBoundary sees them; this is what it shows instead of its built-in developer page.
 */
export function RouteError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : String(error)
  useEffect(() => console.error('Route error', error), [error])
  return <ErrorScreen message={message} />
}
