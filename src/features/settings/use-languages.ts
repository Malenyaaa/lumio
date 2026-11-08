import { getLocalizationApi } from '@jellyfin/sdk/lib/utils/api/localization-api'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useAuthedSession } from '@/features/auth/session'
import { getLocaleTag, useLocale, useMessages } from '@/lib/i18n'
import { fieldMessages } from './messages'

// Shown first in the language lists; the rest follows alphabetically.
const COMMON_LANGUAGES = ['deu', 'eng', 'jpn', 'fra', 'spa', 'ita', 'kor', 'zho', 'tur', 'rus']

/**
 * Languages Jellyfin knows, named in the interface language, after an "any language" entry (the only one while the
 * list loads or if it can't be loaded). The value is the three-letter code the user settings store.
 */
export function useLanguageOptions() {
  const { api } = useAuthedSession()
  const locale = useLocale()
  const { anyLanguage } = useMessages(fieldMessages)
  const cultures = useQuery({
    queryKey: ['cultures'],
    staleTime: Infinity,
    queryFn: async () => (await getLocalizationApi(api).getCultures()).data,
  })

  return useMemo(() => {
    const tag = getLocaleTag(locale)
    const names = new Intl.DisplayNames([tag], { type: 'language' })
    const seen = new Set<string>()
    const options: Array<{ value: string; label: string }> = []
    for (const culture of cultures.data ?? []) {
      const code = culture.ThreeLetterISOLanguageName
      if (!code || seen.has(code)) continue
      seen.add(code)
      let label = culture.DisplayName ?? code
      try {
        if (culture.TwoLetterISOLanguageName) label = names.of(culture.TwoLetterISOLanguageName) ?? label
      } catch {
        // Unknown tag for Intl: keep the server's name.
      }
      options.push({ value: code, label })
    }
    const rank = (code: string) => (COMMON_LANGUAGES.includes(code) ? COMMON_LANGUAGES.indexOf(code) : COMMON_LANGUAGES.length)
    options.sort((a, b) => rank(a.value) - rank(b.value) || a.label.localeCompare(b.label, tag))
    return [{ value: '', label: anyLanguage }, ...options]
  }, [cultures.data, locale, anyLanguage])
}
