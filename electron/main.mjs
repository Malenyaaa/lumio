/**
 * Lumio for Windows and Linux: the built pages (dist/ next to this file, built with VITE_BUNDLED: they ask for the
 * server at sign-in) in Electron's own Chromium, so video plays the same everywhere. They are served from app://lumio/
 * rather than as files, so the app's addresses (/listen/album/…) work as on the web; the Lumio server allows that
 * origin. The media keys and the system's media controls come from Chromium's media session.
 *
 * The window has no frame of its own: the system's minimize/maximize/close buttons sit in Lumio's header (a title bar
 * overlay), and the header moves the window (a setting brings the system's frame back). Closing can leave Lumio in the
 * tray or only minimize it (music plays on); it can start with the system, hidden in the tray, and in Watch or Listen.
 * The page reaches these through preload.cjs.
 */
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, nativeTheme, net, protocol, shell, Tray } from 'electron'
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DIST = join(HERE, 'dist')
const ORIGIN = 'app://lumio'
const RELEASES = 'https://api.github.com/repos/PalmarHealer/lumio/releases/latest'
/** As high as Lumio's header (h-14), so the window buttons sit in it. */
const TITLE_BAR_HEIGHT = 56
const german = () => app.getLocale().startsWith('de')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
])

// One window: opening Lumio again brings it to the front.
if (!app.requestSingleInstanceLock()) app.quit()

// ---- the desktop settings (kept beside Electron's own data) ----

/**
 * @typedef {{ autostart: boolean, startHidden: boolean, startIn: 'last' | 'watch' | 'listen', closeAction: 'tray' | 'minimize' | 'quit', frameless: boolean }} DesktopSettings
 */
/** @type {DesktopSettings} */
const DEFAULTS = { autostart: false, startHidden: false, startIn: 'last', closeAction: 'tray', frameless: true }
const settingsFile = () => join(app.getPath('userData'), 'desktop-settings.json')

/** @returns {DesktopSettings} */
function readSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(settingsFile(), 'utf8')) }
  } catch {
    return { ...DEFAULTS }
  }
}

/** @param {DesktopSettings} settings */
function applyAutostart(settings) {
  const args = settings.startHidden ? ['--hidden'] : []
  if (process.platform === 'linux') {
    // Linux has no login item API: a desktop entry in ~/.config/autostart does it. An AppImage starts from its file.
    const file = join(app.getPath('home'), '.config', 'autostart', 'lumio.desktop')
    if (!settings.autostart) return rmSync(file, { force: true })
    const exec = [process.env.APPIMAGE ?? process.execPath, ...args].map((part) => `"${part}"`).join(' ')
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, `[Desktop Entry]\nType=Application\nName=Lumio\nExec=${exec}\nX-GNOME-Autostart-enabled=true\n`)
    return
  }
  app.setLoginItemSettings({ openAtLogin: settings.autostart, args })
}

ipcMain.handle('desktop:settings', () => readSettings())
ipcMain.handle('desktop:set-settings', (_event, patch) => {
  const next = { ...readSettings(), ...patch }
  writeFileSync(settingsFile(), JSON.stringify(next, null, 2))
  if ('autostart' in patch || 'startHidden' in patch) applyAutostart(next)
  return next
})
// The window frame is chosen when the window is made: a change takes a restart.
ipcMain.handle('desktop:relaunch', () => {
  quitting = true
  app.relaunch()
  app.quit()
})

// ---- the window ----

/** @type {BrowserWindow | null} */
let window = null
let quitting = false

function startUrl() {
  const { startIn } = readSettings()
  // "last": the page decides (it opens the app used last).
  return `${ORIGIN}${startIn === 'listen' ? '/listen' : startIn === 'watch' ? '/?app=watch' : '/'}`
}

function overlayColors(dark) {
  return { color: '#00000000', symbolColor: dark ? '#fafafa' : '#0a0a0a', height: TITLE_BAR_HEIGHT }
}

function createWindow({ show }) {
  const { frameless } = readSettings()
  window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 380,
    minHeight: 500,
    backgroundColor: '#0a0a0a',
    title: 'Lumio',
    icon: join(HERE, 'icon.png'),
    // No frame (the default): the window buttons are drawn into Lumio's header (index.css keeps room for them).
    ...(frameless ? { titleBarStyle: 'hidden', titleBarOverlay: overlayColors(nativeTheme.shouldUseDarkColors) } : { autoHideMenuBar: true }),
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, preload: join(HERE, 'preload.cjs') },
  })
  if (show) window.once('ready-to-show', () => window?.show())
  // Links to other sites open in the browser, not in Lumio's window.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(ORIGIN)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(ORIGIN)) return
    event.preventDefault()
    void shell.openExternal(url)
  })
  // Closing keeps Lumio in the tray, or only minimizes the window (as set; not while really quitting).
  window.on('close', (event) => {
    const { closeAction } = readSettings()
    if (quitting || closeAction === 'quit') return
    event.preventDefault()
    if (closeAction === 'minimize') window?.minimize()
    else window?.hide()
  })
  window.on('closed', () => (window = null))
  void window.loadURL(startUrl())
  return window
}

function showWindow() {
  if (!window) createWindow({ show: true })
  else {
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  }
}

// The page's theme: the window buttons follow it (light symbols on dark, dark on light).
ipcMain.on('desktop:theme', (_event, theme) => {
  if (readSettings().frameless) window?.setTitleBarOverlay?.(overlayColors(theme === 'dark'))
})

// ---- the tray ----

/** @type {Tray | null} */
let tray = null
let nowPlaying = { title: '', playing: false, loaded: false }

function trayMenu() {
  const de = german()
  return Menu.buildFromTemplate([
    { label: de ? 'Lumio öffnen' : 'Open Lumio', click: showWindow },
    { type: 'separator' },
    {
      label: nowPlaying.playing ? (de ? 'Pause' : 'Pause') : de ? 'Abspielen' : 'Play',
      enabled: nowPlaying.loaded,
      click: () => window?.webContents.send('desktop:media', 'toggle'),
    },
    { label: de ? 'Nächster Titel' : 'Next', enabled: nowPlaying.loaded, click: () => window?.webContents.send('desktop:media', 'next') },
    { type: 'separator' },
    {
      label: de ? 'Beenden' : 'Quit',
      click: () => {
        quitting = true
        app.quit()
      },
    },
  ])
}

function updateTray() {
  if (!tray) return
  tray.setToolTip(nowPlaying.title ? `Lumio · ${nowPlaying.title}` : 'Lumio')
  tray.setContextMenu(trayMenu())
}

// What plays (from the page), for the tray's tooltip and menu.
ipcMain.on('desktop:now-playing', (_event, info) => {
  nowPlaying = { title: String(info?.title ?? ''), playing: !!info?.playing, loaded: !!info?.loaded }
  updateTray()
})

function createTray() {
  const image = nativeImage.createFromPath(join(HERE, 'icon.png')).resize({ width: 32, height: 32 })
  tray = new Tray(image)
  tray.on('click', showWindow)
  updateTray()
}

// ---- updates ----

/** Whether `a` (1.2.3) is newer than `b`. */
function newer(a, b) {
  const parts = (version) => version.replace(/^v/, '').split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0)
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0)
  return false
}

/** A newer release on GitHub is offered once per start (its page opens in the browser, with the installers). */
async function checkForUpdate() {
  try {
    const response = await net.fetch(RELEASES, { headers: { Accept: 'application/vnd.github+json' } })
    if (!response.ok) return
    const release = await response.json()
    if (!release.tag_name || !newer(release.tag_name, app.getVersion()) || !window) return
    const de = german()
    const { response: choice } = await dialog.showMessageBox(window, {
      type: 'info',
      buttons: de ? ['Herunterladen', 'Später'] : ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1,
      message: de ? `Lumio ${release.tag_name} ist da` : `Lumio ${release.tag_name} is available`,
      detail: de ? `Installiert ist ${app.getVersion()}.` : `You have ${app.getVersion()}.`,
    })
    if (choice === 0) void shell.openExternal(release.html_url)
  } catch {
    // Offline or GitHub unreachable: next start.
  }
}

app.on('second-instance', showWindow)

app.whenReady().then(() => {
  // The app's files; every other address is its page (the app routes itself), as the Lumio server does.
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url)
    const file = normalize(join(DIST, decodeURIComponent(pathname)))
    const isFile = file.startsWith(DIST + sep) && (statSync(file, { throwIfNoEntry: false })?.isFile() ?? false)
    return net.fetch(pathToFileURL(isFile ? file : join(DIST, 'index.html')).toString())
  })
  createTray()
  // Started with the system and set to start hidden: only the tray (the page loads, so music can be started from it).
  const hidden = process.argv.includes('--hidden')
  const created = createWindow({ show: !hidden })
  if (app.isPackaged) created.webContents.once('did-finish-load', () => void checkForUpdate())
  app.on('activate', showWindow)
})

app.on('before-quit', () => (quitting = true))
// The window only hides while the tray keeps Lumio; set to quit, closing it quits.
app.on('window-all-closed', () => app.quit())
