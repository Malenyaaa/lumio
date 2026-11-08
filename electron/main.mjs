/**
 * Lumio for Windows and Linux: the built pages (dist/ next to this file, built with VITE_BUNDLED: they ask for the
 * server at sign-in) in Electron's own Chromium, so video plays the same everywhere. They are served from app://lumio/
 * rather than as files, so the app's addresses (/listen/album/…) work as on the web; the Lumio server allows that
 * origin. The media keys and the system's media controls come from Chromium's media session.
 */
import { app, BrowserWindow, dialog, net, protocol, shell } from 'electron'
import { statSync } from 'node:fs'
import { dirname, join, normalize, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const DIST = join(dirname(fileURLToPath(import.meta.url)), 'dist')
const ORIGIN = 'app://lumio'
const RELEASES = 'https://api.github.com/repos/PalmarHealer/lumio/releases/latest'

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
])

// One window: opening Lumio again brings it to the front.
if (!app.requestSingleInstanceLock()) app.quit()

function createWindow() {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 380,
    minHeight: 500,
    backgroundColor: '#0a0a0a',
    title: 'Lumio',
    autoHideMenuBar: true,
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true },
  })
  window.once('ready-to-show', () => window.show())
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
  void window.loadURL(`${ORIGIN}/`)
  return window
}

/** Whether `a` (1.2.3) is newer than `b`. */
function newer(a, b) {
  const parts = (version) => version.replace(/^v/, '').split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0)
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0)
  return false
}

/** Once a day at most: a newer release on GitHub is offered (its page opens in the browser, with the installers). */
async function checkForUpdate(window) {
  try {
    const response = await net.fetch(RELEASES, { headers: { Accept: 'application/vnd.github+json' } })
    if (!response.ok) return
    const release = await response.json()
    if (!release.tag_name || !newer(release.tag_name, app.getVersion())) return
    const german = app.getLocale().startsWith('de')
    const { response: choice } = await dialog.showMessageBox(window, {
      type: 'info',
      buttons: german ? ['Herunterladen', 'Später'] : ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1,
      message: german ? `Lumio ${release.tag_name} ist da` : `Lumio ${release.tag_name} is available`,
      detail: german ? `Installiert ist ${app.getVersion()}.` : `You have ${app.getVersion()}.`,
    })
    if (choice === 0) void shell.openExternal(release.html_url)
  } catch {
    // Offline or GitHub unreachable: next start.
  }
}

app.on('second-instance', () => {
  const [window] = BrowserWindow.getAllWindows()
  if (!window) return
  if (window.isMinimized()) window.restore()
  window.focus()
})

app.whenReady().then(() => {
  // The app's files; every other address is its page (the app routes itself), as the Lumio server does.
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url)
    const file = normalize(join(DIST, decodeURIComponent(pathname)))
    const isFile = file.startsWith(DIST + sep) && (statSync(file, { throwIfNoEntry: false })?.isFile() ?? false)
    return net.fetch(pathToFileURL(isFile ? file : join(DIST, 'index.html')).toString())
  })
  const window = createWindow()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
  if (app.isPackaged) window.webContents.once('did-finish-load', () => void checkForUpdate(window))
})

app.on('window-all-closed', () => app.quit())
