import { IconDatabaseExclamation, IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { defineMessages, useMessages } from '@/lib/i18n'
import { dismissStorageNotice, requestPersistentStorage, usePersistentStorage } from '@/lib/persistent-storage'

const messages = defineMessages({
  de: {
    title: 'Downloads werden nicht dauerhaft gespeichert',
    body: 'Der Browser hat dauerhaften Speicher abgelehnt. Downloads funktionieren dann nicht oder nicht zuverlässig: Der Browser kann sie jederzeit löschen, etwa wenn der Speicherplatz knapp wird.',
    chrome: 'Chrome und Edge entscheiden selbst: Installiere Lumio als App (Symbol in der Adressleiste) oder setze ein Lesezeichen, dann erneut versuchen.',
    firefox: 'Firefox: Erlaube über das Schloss in der Adressleiste „Daten im dauerhaften Speicher ablegen“, dann erneut versuchen.',
    safari: 'Safari: Füge Lumio zum Home-Bildschirm bzw. Dock hinzu und öffne es von dort.',
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
  const { noticeOpen } = usePersistentStorage()
  const [tried, setTried] = useState(false)
  if (!noticeOpen) return null
  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-28 z-[60] mx-auto max-w-lg rounded-xl bg-popover p-4 text-popover-foreground shadow-2xl ring-1 ring-foreground/10 animate-page-in"
    >
      <div className="flex gap-3">
        <IconDatabaseExclamation className="mt-0.5 size-5 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-semibold">{t.title}</p>
          <p className="text-sm text-muted-foreground">{t.body}</p>
          <p className="text-sm text-muted-foreground">{browserHint(t)}</p>
          {tried && <p className="text-sm font-medium">{t.stillDenied}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
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
