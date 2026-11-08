import { IconBadgeCc, IconCards, IconDownload, IconHome, IconKeyboard, IconLayoutDashboard, IconLock, IconPalette, IconPlayerPlay, IconPuzzle, IconTags, IconUserCircle } from '@tabler/icons-react'
import { inMode, useAppMode } from '@/lib/app-mode'
import { defineMessages, useMessages } from '@/lib/i18n'
import { useUserConfiguration } from './use-user-configuration'

const labels = defineMessages({
  de: {
    profile: 'Konto',
    home: 'Startseite',
    playback: 'Wiedergabe',
    downloads: 'Downloads',
    subtitles: 'Untertitel',
    controls: 'Steuerung',
    interface: 'Oberfläche',
    privacy: 'Privatsphäre',
    display: 'Darstellung',
    branding: 'Branding',
    plugins: 'Plugins',
    metadata: 'Musik-Metadaten',
  },
  en: {
    profile: 'Account',
    home: 'Home',
    playback: 'Playback',
    downloads: 'Downloads',
    subtitles: 'Subtitles',
    controls: 'Controls',
    interface: 'Interface',
    privacy: 'Privacy',
    display: 'Display',
    branding: 'Branding',
    plugins: 'Plugins',
    metadata: 'Music metadata',
  },
})

const PAGES = [
  { key: 'profile', to: '/settings/profile', icon: IconUserCircle },
  { key: 'home', to: '/settings/home', icon: IconHome },
  { key: 'playback', to: '/settings/playback', icon: IconPlayerPlay },
  { key: 'downloads', to: '/settings/downloads', icon: IconDownload },
  { key: 'subtitles', to: '/settings/subtitles', icon: IconBadgeCc },
  { key: 'controls', to: '/settings/controls', icon: IconKeyboard },
  { key: 'interface', to: '/settings/interface', icon: IconLayoutDashboard },
  { key: 'privacy', to: '/settings/privacy', icon: IconLock },
  // Server-wide, for administrators only.
  { key: 'display', to: '/settings/display', icon: IconCards, admin: true },
  { key: 'branding', to: '/settings/branding', icon: IconPalette, admin: true },
  { key: 'plugins', to: '/settings/plugins', icon: IconPuzzle, admin: true },
  { key: 'metadata', to: '/settings/metadata', icon: IconTags, admin: true },
] as const

/** The settings sub-pages, shared by the side navigation and the profile menu so both always list the same entries. */
export function useSettingsPages() {
  const names = useMessages(labels)
  const isAdmin = !!useUserConfiguration().data?.Policy?.IsAdministrator
  // Settings open inside whichever app is in use (/settings in Watch, /listen/settings in Listen).
  const mode = useAppMode()
  return PAGES.filter((page) => !('admin' in page) || isAdmin).map((page) => ({
    ...page,
    to: inMode(mode, page.to),
    admin: 'admin' in page,
    label: names[page.key],
  }))
}
