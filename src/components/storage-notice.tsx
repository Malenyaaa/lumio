import { IconDatabaseExclamation, IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { defineMessages, useMessages } from '@/lib/i18n'
import { dismissStorageNotice, requestPersistentStorage, usePersistentStorage } from '@/lib/persistent-storage'

const messages = defineMessages({
  de: {
    title: 'Downloads werden nicht dauerhaft gespeichert',
    body: 'Der Browser hat dauerhaften Speicher abgelehnt. Downloads funktionieren dann nicht oder nicht zuverlässig: Der Browser kann sie jederzeit löschen, etwa wenn der Speicherplatz knapp wird.',
    chrome: 'Chrome und Edge entscheiden selbst: Installiere Lumio als App (Symbol in der Adressleiste) oder setze ein Lesezeichen, dann erneut versuchen.',
    firefox: 'Firefox: Erlaube über das Schloss in der Adressleiste „Daten im dauerhaften Speicher ablegen“, dann erneut versuchen.',
    safari: 'Safari: Füge Lumio zum Home-Bildschirm bzw. Dock hinzu und öffne es von dort.',
    askingTitle: 'Bitte erlaube dauerhaften Speicher',
    askingBody: 'Dein Browser fragt gerade, ob Lumio Daten dauerhaft speichern darf. Erlaube es, sonst funktionieren Downloads nicht oder nicht zuverlässig: Der Browser könnte sie sonst jederzeit löschen.',
    askingHint: 'Die Frage ist oben links an der Adressleiste. Ist sie zu, öffnet ein Klick auf das Symbol dort sie wieder.',
    retry: 'Erneut versuchen',
    stillDenied: 'Immer noch abgelehnt.',
    dismiss: 'Verstanden',
    close: 'Schließen',
  },
  en: {
    title: "Downloads aren't stored for good",
    body: "The browser declined persistent storage. Downloads then don't work, or not reliably: the browser may delete them at any time, for example when disk space runs low.",
    chrome: 'Chrome and Edge decide on their own: install Lumio as an app (the icon in the address bar) or bookmark it, then try again.',
    firefox: 'Firefox: allow “Store data in persistent storage” via the lock in the address bar, then try again.',
    safari: 'Safari: add Lumio to the home screen or Dock and open it from there.',
    askingTitle: 'Please allow persistent storage',
    askingBody: "Your browser is asking whether Lumio may store data for good. Allow it, or downloads won't work, or not reliably: the browser could delete them at any time.",
    askingHint: "The question is at the top left of the address bar. If it's closed, clicking the icon there opens it again.",
    retry: 'Try again',
    stillDenied: 'Still declined.',
    dismiss: 'Got it',
    close: 'Close',
  },
})

function browserHint(t: (typeof messages)['de']) {
  const agent = navigator.userAgent
  if (/firefox/i.test(agent)) return t.firefox
  if (/safari/i.test(agent) && !/chrome|chromium|edg/i.test(agent)) return t.safari
  return t.chrome
}

/** Shown when the browser declined persistent storage (see persistent-storage): what that means for downloads. */
export function StorageNotice() {
  const t = useMessages(messages)
  const { state, noticeOpen } = usePersistentStorage()
  const [tried, setTried] = useState(false)
  if (!noticeOpen) return null
  const asking = state === 'asking'
  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-28 z-[60] mx-auto max-w-lg rounded-xl bg-popover p-4 text-popover-foreground shadow-2xl ring-1 ring-foreground/10 animate-page-in"
    >
      <div className="flex gap-3">
        <IconDatabaseExclamation className="mt-0.5 size-5 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-semibold">{asking ? t.askingTitle : t.title}</p>
          <p className="text-sm text-muted-foreground">{asking ? t.askingBody : t.body}</p>
          <p className="text-sm text-muted-foreground">{asking ? t.askingHint : browserHint(t)}</p>
          {tried && !asking && <p className="text-sm font-medium">{t.stillDenied}</p>}
          <div className={cn('flex flex-wrap gap-2 pt-1', asking && 'hidden')}>
            <Button size="sm" onClick={() => void requestPersistentStorage().then((granted) => setTried(!granted))}>
              {t.retry}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismissStorageNotice}>
              {t.dismiss}
            </Button>
          </div>
        </div>
        <button type="button" aria-label={t.close} title={t.close} onClick={dismissStorageNotice} className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground">
          <IconX className="size-4" />
        </button>
      </div>
    </div>
  )
}
