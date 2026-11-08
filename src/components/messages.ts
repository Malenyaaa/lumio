import { defineMessages } from '@/lib/i18n'

export const shellMessages = defineMessages({
  de: {
    back: 'Zurück',
    home: 'Start',
    watchlist: 'Watchlist',
    profile: 'Profil',
    settings: 'Einstellungen',
    history: 'Verlauf',
    administration: 'Administration',
    dashboard: 'Jellyfin-Dashboard',
    metadata: 'Metadaten',
    quickConnect: 'Quick Connect',
    logout: 'Abmelden',
    theme: 'Design',
    themeSystem: 'Wie das Gerät',
    themeDark: 'Dunkel',
    themeLight: 'Hell',
  },
  en: {
    back: 'Back',
    home: 'Home',
    watchlist: 'Watchlist',
    profile: 'Profile',
    settings: 'Settings',
    history: 'History',
    administration: 'Administration',
    dashboard: 'Jellyfin-Dashboard',
    metadata: 'Metadata',
    quickConnect: 'Quick Connect',
    logout: 'Sign out',
    theme: 'Theme',
    themeSystem: 'Match device',
    themeDark: 'Dark',
    themeLight: 'Light',
  },
})

export const errorMessages = defineMessages({
  de: { title: 'Etwas ist schiefgelaufen', reload: 'Neu laden' },
  en: { title: 'Something went wrong', reload: 'Reload' },
})

export const notFoundMessages = defineMessages({
  de: { title: 'Seite nicht gefunden', home: 'Zur Startseite' },
  en: { title: 'Page not found', home: 'Go to Home' },
})

export const expandingSearchMessages = defineMessages({
  de: { close: 'Suche schließen' },
  en: { close: 'Close search' },
})

export const codeInputMessages = defineMessages({
  de: { digit: (position: number, length: number) => `Ziffer ${position} von ${length}` },
  en: { digit: (position: number, length: number) => `Digit ${position} of ${length}` },
})

/** For the generated shadcn components in ui/. */
export const uiMessages = defineMessages({
  de: { close: 'Schließen' },
  en: { close: 'Close' },
})
