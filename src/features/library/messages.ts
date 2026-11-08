import { defineMessages } from '@/lib/i18n'

export const historyMessages = defineMessages({
  de: {
    title: 'Verlauf',
    search: 'Im Verlauf suchen',
    today: 'Heute',
    yesterday: 'Gestern',
    earlier: 'Früher',
    noMatches: (term: string) => `Keine Treffer für „${term}“ im Verlauf.`,
    empty: 'Noch nichts gesehen. Was du zu Ende schaust, erscheint hier.',
    time: (time: string) => `${time} Uhr`,
  },
  en: {
    title: 'History',
    search: 'Search history',
    today: 'Today',
    yesterday: 'Yesterday',
    earlier: 'Earlier',
    noMatches: (term: string) => `No matches for “${term}” in your history.`,
    empty: 'Nothing watched yet. Whatever you finish shows up here.',
    time: (time: string) => time,
  },
})

export const libraryMessages = defineMessages({
  de: {
    count: (n: number) => (n === 1 ? '1 Eintrag' : `${n} Einträge`),
    noMatches: 'Nichts passt zu diesen Filtern.',
    empty: 'Diese Bibliothek ist leer.',
    allLibraries: 'Alle',
    artists: 'Künstler',
    libraries: 'Bibliotheken',
  },
  en: {
    count: (n: number) => (n === 1 ? '1 title' : `${n} titles`),
    noMatches: 'Nothing matches these filters.',
    empty: 'This library is empty.',
    allLibraries: 'All',
    artists: 'Artists',
    libraries: 'Libraries',
  },
})

export const toolbarMessages = defineMessages({
  de: {
    name: 'Name',
    added: 'Hinzugefügt',
    released: 'Erscheinungsdatum',
    rating: 'Bewertung',
    critics: 'Kritiken',
    runtime: 'Laufzeit',
    random: 'Zufällig',
    unplayed: 'Ungesehen',
    played: 'Gesehen',
    favorite: 'Auf der Watchlist',
    sortBy: 'Sortieren nach',
    sortedDescending: 'Absteigend sortiert',
    sortedAscending: 'Aufsteigend sortiert',
    descending: 'Absteigend',
    ascending: 'Aufsteigend',
    filter: 'Filter',
    show: 'Anzeigen',
    reset: 'Zurücksetzen',
    search: 'In der Bibliothek suchen',
    allGenres: 'Alle Genres',
  },
  en: {
    name: 'Name',
    added: 'Date added',
    released: 'Release date',
    rating: 'Rating',
    critics: 'Critics',
    runtime: 'Runtime',
    random: 'Random',
    unplayed: 'Unwatched',
    played: 'Watched',
    favorite: 'On your watchlist',
    sortBy: 'Sort by',
    sortedDescending: 'Sorted descending',
    sortedAscending: 'Sorted ascending',
    descending: 'Descending',
    ascending: 'Ascending',
    filter: 'Filter',
    show: 'Show',
    reset: 'Reset',
    search: 'Search library',
    allGenres: 'All genres',
  },
})

export const personMessages = defineMessages({
  de: {
    born: (date: string) => `Geboren am ${date}`,
    bornWithAge: (date: string, age: number) => `Geboren am ${date} (${age} Jahre)`,
    died: (date: string, age: number) => `Gestorben am ${date} (${age} Jahre)`,
    readMore: 'Mehr lesen',
    showLess: 'Weniger anzeigen',
    movies: 'Filme',
    series: 'Serien',
    episodes: 'Auftritte in Folgen',
    noTitles: 'Keine Titel in deiner Bibliothek.',
  },
  en: {
    born: (date: string) => `Born ${date}`,
    bornWithAge: (date: string, age: number) => `Born ${date} (age ${age})`,
    died: (date: string, age: number) => `Died ${date} (age ${age})`,
    readMore: 'Read more',
    showLess: 'Show less',
    movies: 'Movies',
    series: 'Series',
    episodes: 'Episode appearances',
    noTitles: 'No titles in your library.',
  },
})

export const watchlistMessages = defineMessages({
  de: {
    title: 'Watchlist',
    empty: 'Noch nichts auf der Watchlist. Auf einer Detailseite „Watchlist“ wählen, dann erscheint der Titel hier.',
  },
  en: {
    title: 'Watchlist',
    empty: 'Your watchlist is empty. Choose “Watchlist” on a title’s page and it shows up here.',
  },
})
