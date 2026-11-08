import { defineMessages } from '@/lib/i18n'

export const homeSettingsMessages = defineMessages({
  de: {
    title: 'Startseite',
    description: 'Was auf der Startseite steht und welche Bibliotheken Lumio zeigt.',
    layout: 'Zeilen',
    layoutLabel: 'Inhalt der Startseite',
    layoutHint: '„Persönlich“ baut die Zeilen aus deinem Verlauf: Weiter, Ähnliches, deine Genres und etwas Neues. „Jellyfin“ zeigt die neuesten Einträge jeder Bibliothek.',
    layoutPersonal: 'Persönlich',
    layoutJellyfin: 'Jellyfin',
    libraries: 'Bibliotheken',
    librariesHint:
      'Die Navigation fasst Bibliotheken nach Medientyp zusammen (Filme, Serien, Anime …). Die Reihenfolge hier gilt innerhalb eines Typs: für die Reiter auf der Typseite, für die Startseite, und bei Titeln, die in mehreren Bibliotheken liegen, zeigt Lumio den aus der oberen. Ausgeblendete Bibliotheken fehlen überall. Gilt für dein Konto, auch in anderen Jellyfin-Apps.',
    moveUp: (name: string) => `${name} nach oben`,
    moveDown: (name: string) => `${name} nach unten`,
    show: (name: string) => `${name} anzeigen`,
    hidden: 'Ausgeblendet',
    dragHint: 'Ziehen oder mit den Pfeilen sortieren.',
  },
  en: {
    title: 'Home',
    description: 'What the home screen shows and which libraries Lumio shows.',
    layout: 'Rows',
    layoutLabel: 'Home screen content',
    layoutHint: '"Personal" builds the rows from your history: continue, similar titles, your genres and something new. "Jellyfin" shows the latest additions of each library.',
    layoutPersonal: 'Personal',
    layoutJellyfin: 'Jellyfin',
    libraries: 'Libraries',
    librariesHint:
      'The navigation groups libraries by media type (movies, shows, anime …). The order here applies within a type: to the tabs on the type page, to the home screen, and for titles that exist in several libraries Lumio shows the one from the library listed first. Hidden libraries are left out everywhere. Applies to your account, in other Jellyfin apps too.',
    moveUp: (name: string) => `Move ${name} up`,
    moveDown: (name: string) => `Move ${name} down`,
    show: (name: string) => `Show ${name}`,
    hidden: 'Hidden',
    dragHint: 'Drag or use the arrows to reorder.',
  },
})
