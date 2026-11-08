import { defineMessages } from '@/lib/i18n'

/** Fallback and marker words of the track labels (see track-labels.ts). */
export const trackLabelMessages = defineMessages({
  de: { video: 'Video', audio: 'Audio', subtitle: 'Untertitel', bitmap: 'Bild', multipleLanguages: 'Mehrsprachig' },
  en: { video: 'Video', audio: 'Audio', subtitle: 'Subtitle', bitmap: 'Image', multipleLanguages: 'Multiple languages' },
})

/** Regional/script variants named in English stream titles ("European Spanish"), keyed by the lower-case English word. */
export const qualifierLabels = defineMessages({
  de: {
    european: 'Europa',
    brazilian: 'Brasilien',
    'latin american': 'Lateinamerika',
    latin: 'Lateinamerika',
    castilian: 'Kastilisch',
    canadian: 'Kanada',
    mexican: 'Mexiko',
    simplified: 'vereinfacht',
    traditional: 'traditionell',
    mandarin: 'Mandarin',
    cantonese: 'Kantonesisch',
  },
  en: {
    european: 'Europe',
    brazilian: 'Brazil',
    'latin american': 'Latin America',
    latin: 'Latin America',
    castilian: 'Castilian',
    canadian: 'Canada',
    mexican: 'Mexico',
    simplified: 'Simplified',
    traditional: 'Traditional',
    mandarin: 'Mandarin',
    cantonese: 'Cantonese',
  },
})
