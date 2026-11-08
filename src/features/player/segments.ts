import { getMediaSegmentApi } from '@jellyfin/sdk/lib/utils/api/media-segment-api'
import type { Api } from '@jellyfin/sdk'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { useAuthedSession } from '@/features/auth/session'
import { ticksToSeconds } from '@/lib/format'
import type { SegmentKind } from '@/features/settings/local-settings'

export interface Segment {
  id: string
  kind: SegmentKind
  start: number
  end: number
}

const KINDS = new Set<string>(['Intro', 'Outro', 'Preview', 'Recap', 'Commercial'] satisfies SegmentKind[])

/** Intro/outro/... ranges of an item in seconds. Servers without media segments (or items without any) yield an empty list. */
export function useMediaSegments(itemId: string, enabled: boolean) {
  const { api } = useAuthedSession()
  return useQuery({ ...segmentsOptions(api, itemId), enabled })
}

export function segmentsOptions(api: Api, itemId: string) {
  return queryOptions({
    queryKey: ['media-segments', itemId],
    retry: false,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Segment[]> => {
      try {
        const { data } = await getMediaSegmentApi(api).getItemSegments({ itemId })
        return (data.Items ?? [])
          .filter((segment) => segment.Type && KINDS.has(segment.Type) && segment.StartTicks != null && segment.EndTicks != null)
          .map((segment) => ({
            id: segment.Id ?? `${segment.Type}-${segment.StartTicks}`,
            kind: segment.Type as SegmentKind,
            start: ticksToSeconds(segment.StartTicks!),
            end: ticksToSeconds(segment.EndTicks!),
          }))
      } catch {
        return []
      }
    },
  })
}

/** Intros that start this close to the start position count as "playback would begin in the intro". */
const INTRO_LEAD_SECONDS = 5

/**
 * Where playback should really start when "start after the intro" is on: right after the intro if the start position
 * lies in it (or just before it), otherwise unchanged.
 */
export function startAfterIntro(startSeconds: number, segments: Segment[]): number {
  const intro = segments.find((segment) => segment.kind === 'Intro' && startSeconds >= segment.start - INTRO_LEAD_SECONDS && startSeconds < segment.end)
  return intro ? intro.end : startSeconds
}
