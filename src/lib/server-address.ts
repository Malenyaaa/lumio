import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

/** How long one try may take before the next one (http after https) is made. */
const TRY_MS = 5000

async function answers(url: string) {
  try {
    const response = await fetch(`${url}/System/Info/Public`, { signal: AbortSignal.timeout(TRY_MS) })
    return response.ok
  } catch {
    return false
  }
}

/**
 * The server address as typed, made whole: with a scheme it stays as it is; without one ("jelly.example.org"),
 * https:// is tried first and http:// when that doesn't answer (https when neither does, so the error says why).
 */
export async function resolveServerAddress(typed: string): Promise<string> {
  const value = typed.trim().replace(/\/+$/, '')
  if (!value || /^https?:\/\//i.test(value)) return value
  if (await answers(`https://${value}`)) return `https://${value}`
  if (await answers(`http://${value}`)) return `http://${value}`
  return `https://${value}`
}

/** The address being typed, resolved a moment after typing stops ('' while that runs). */
export function useServerAddress(typed: string) {
  const [settled, setSettled] = useState(typed)
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(typed), 500)
    return () => window.clearTimeout(timer)
  }, [typed])
  const resolved = useQuery({
    queryKey: ['server-address', settled.trim()],
    queryFn: () => resolveServerAddress(settled),
    enabled: !!settled.trim(),
    staleTime: Infinity,
    retry: false,
  })
  if (typed !== settled) return { address: '', resolving: true }
  return { address: resolved.data ?? '', resolving: resolved.isFetching }
}
