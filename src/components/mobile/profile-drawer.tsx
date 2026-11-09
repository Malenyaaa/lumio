import {
  IconAdjustments,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconDownload,
  IconExternalLink,
  IconConfetti,
  IconHistory,
  IconLogout,
  IconMoon,
  IconServer,
  IconSettings,
  IconSun,
  type Icon,
} from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAdminLinks, UserAvatar } from '@/components/account'
import { appSwitcherMessages, ModeEntry } from '@/components/app-switcher'
import { Link } from '@/components/link'
import { shellMessages } from '@/components/messages'
import { Sheet, SheetBody, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { usePluginRegistry } from '@/features/admin/plugins'
import { ConnectDeviceDialog } from '@/features/auth/connect-device-dialog'
import { useAuthedSession } from '@/features/auth/session'
import { useLocalSettings } from '@/features/settings/local-settings'
import { APP_MODES, inMode, modeHome, useAppMode } from '@/lib/app-mode'
import { useMessages } from '@/lib/i18n'
import { inJellyfinApp, openAppSettings, openServerSelection } from '@/lib/native-app'
import { useAppPromoted } from '@/components/app-promo'
import { setAppDownloadOpen } from '@/lib/apps'
import { useThemePreference, type ThemePreference } from '@/lib/theme'
import { cn } from '@/lib/utils'

/**
 * The phone's menu behind the profile picture (top left, as in Spotify): the switch between Watch and Listen, then
 * everything the desktop header keeps in its profile menu.
 */
export function ProfileDrawer() {
  const { session, logout } = useAuthedSession()
  const t = useMessages(shellMessages)
  const switcher = useMessages(appSwitcherMessages)
  const mode = useAppMode()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { settings } = useLocalSettings()
  const plugins = usePluginRegistry()
  const admin = useAdminLinks()
  const appPromoted = useAppPromoted()
  // Open on the page it was opened on: following a link closes it.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === pathname
  const setOpen = (next: boolean) => setOpenOn(next ? pathname : null)
  const [connectOpen, setConnectOpen] = useState(false)

  return (
    <>
      <Sheet side="left" open={open} onOpenChange={setOpen}>
        <SheetTrigger aria-label={t.menu} className="-ml-1 shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <UserAvatar />
        </SheetTrigger>
        <SheetContent className="bg-background">
          <div className="flex shrink-0 items-center gap-3 px-4 pt-5 pb-4">
            <UserAvatar className="size-12 text-base" />
            <div className="min-w-0">
              <SheetTitle className="truncate text-lg">{session.userName}</SheetTitle>
              {/* Listen has public profiles (playlists, follows); Watch doesn't. */}
              {mode === 'listen' && (
                <Link to={`/listen/user/${session.userId}`} className="text-sm text-muted-foreground">
                  {t.viewProfile}
                </Link>
              )}
            </div>
          </div>
          <SheetBody className="px-2">
            {settings.apps === 'both' && (
              <Section title={t.apps}>
                {APP_MODES.map((entry) => (
                  <ModeEntry
                    key={entry}
                    mode={entry}
                    current={entry === mode}
                    description={switcher[entry]}
                    onPick={() => (entry === mode ? setOpen(false) : void navigate(modeHome(entry)))}
                  />
                ))}
              </Section>
            )}
            <Section>
              <Row icon={IconHistory} label={t.history} to={inMode(mode, '/history')} />
              <Row icon={IconConfetti} label={t.wrapped} to="/listen/wrapped" />
              <Row icon={IconSettings} label={t.settings} to={inMode(mode, '/settings')} />
              <ThemeRow />
            </Section>
            {admin.length > 0 && (
              <Section title={t.administration}>
                {admin.map((link) => (
                  <Row key={link.key} icon={link.icon} label={link.label} to={link.to} href={link.href} external={link.external} />
                ))}
              </Section>
            )}
            {plugins.menuItems.length > 0 && (
              <Section>
                {plugins.menuItems.map((item) => (
                  <Row key={item.id} label={item.label} to={item.href} onClick={item.href ? undefined : item.onClick} />
                ))}
              </Section>
            )}
            <Section>
              <Row icon={IconDeviceMobile} label={t.quickConnect} onClick={() => setConnectOpen(true)} />
              {/* In a browser on a system with an app the admin promotes (never inside one of the apps). */}
              {appPromoted && <Row icon={IconDownload} label={t.getApp} onClick={() => setAppDownloadOpen(true)} />}
              {/* Inside Jellyfin's Android app: its own screens, which its own web client reaches the same way. */}
              {inJellyfinApp() && (
                <>
                  <Row icon={IconAdjustments} label={t.appSettings} onClick={openAppSettings} />
                  <Row icon={IconServer} label={t.switchServer} onClick={openServerSelection} />
                </>
              )}
              <Row icon={IconLogout} label={t.logout} onClick={() => void logout()} />
            </Section>
          </SheetBody>
        </SheetContent>
      </Sheet>
      <ConnectDeviceDialog open={connectOpen} onOpenChange={setConnectOpen} />
    </>
  )
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="border-t py-2 first:border-t-0">
      {title && <p className="px-3 pt-1 pb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>}
      {children}
    </section>
  )
}

const ROW = 'flex w-full items-center gap-3.5 rounded-lg px-3 py-3 text-left text-[15px] outline-none transition-colors active:bg-muted focus-visible:bg-muted [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground'

function Row({ icon: Icon, label, to, href, external, onClick }: { icon?: Icon; label: string; to?: string; href?: string; external?: boolean; onClick?: () => void }) {
  const content = (
    <>
      {Icon && <Icon />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {external && <IconExternalLink className="size-4!" />}
    </>
  )
  if (to) return <Link to={to} className={ROW}>{content}</Link>
  if (href) return <a href={href} className={ROW} {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}>{content}</a>
  return <button type="button" onClick={onClick} className={ROW}>{content}</button>
}

/** Dark, light or like the device, in one row rather than a submenu. */
function ThemeRow() {
  const t = useMessages(shellMessages)
  const [preference, setPreference] = useThemePreference()
  const options: Array<{ value: ThemePreference; label: string; icon: Icon }> = [
    { value: 'system', label: t.themeSystem, icon: IconDeviceDesktop },
    { value: 'dark', label: t.themeDark, icon: IconMoon },
    { value: 'light', label: t.themeLight, icon: IconSun },
  ]
  return (
    <div className="px-3 py-2">
      <p className="mb-2 text-sm text-muted-foreground">{t.theme}</p>
      <div role="radiogroup" aria-label={t.theme} className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {options.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={preference === value}
            onClick={() => setPreference(value)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-md px-1 py-2 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              preference === value ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground',
            )}
          >
            <Icon className="size-4" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
