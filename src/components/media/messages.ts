import { defineMessages } from '@/lib/i18n'

export const hoverPreviewMessages = defineMessages({
  de: {
    seriesPart: (part: number, total: number, name: string) => `Teil ${part} von ${total} · ${name}`,
    preview: (title: string) => `Vorschau: ${title}`,
    play: 'Abspielen',
    details: 'Details',
    addToWatchlist: 'Zur Watchlist hinzufügen',
    removeFromWatchlist: 'Von der Watchlist entfernen',
    onWatchlist: 'Auf der Watchlist',
    seasons: (count: number) => `${count} ${count === 1 ? 'Staffel' : 'Staffeln'}`,
  },
  en: {
    seriesPart: (part: number, total: number, name: string) => `Part ${part} of ${total} · ${name}`,
    preview: (title: string) => `Preview: ${title}`,
    play: 'Play',
    details: 'Details',
    addToWatchlist: 'Add to Watchlist',
    removeFromWatchlist: 'Remove from Watchlist',
    onWatchlist: 'On your Watchlist',
    seasons: (count: number) => `${count} ${count === 1 ? 'Season' : 'Seasons'}`,
  },
})

export const ratingMessages = defineMessages({
  de: {
    tmdbRating: 'Bewertung auf TMDB',
    communityRating: 'Community-Bewertung (Jellyfin)',
    tomatometer: 'Rotten Tomatoes (Tomatometer)',
    moreOn: 'Mehr auf',
  },
  en: {
    tmdbRating: 'Rating on TMDB',
    communityRating: 'Community rating (Jellyfin)',
    tomatometer: 'Rotten Tomatoes (Tomatometer)',
    moreOn: 'More on',
  },
})

export const scrollRowMessages = defineMessages({
  de: { back: 'Zurück blättern', forward: 'Weiter blättern', page: (page: number, total: number) => `Seite ${page} von ${total}` },
  en: { back: 'Scroll back', forward: 'Scroll forward', page: (page: number, total: number) => `Page ${page} of ${total}` },
})

export const watchedMessages = defineMessages({
  de: { watched: 'Gesehen', unwatched: (count: number) => `${count} ungesehen` },
  en: { watched: 'Watched', unwatched: (count: number) => `${count} unwatched` },
})

export const cardMessages = defineMessages({
  de: { current: 'Du bist hier', artist: 'Künstler' },
  en: { current: "You're here", artist: 'Artist' },
})
