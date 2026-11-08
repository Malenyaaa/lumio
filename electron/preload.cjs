/**
 * What the page may ask of the desktop app (src/lib/desktop.ts): its settings (start with the system, hidden, in Watch
 * or Listen, what closing does, the window frame, updates) and a restart, a downloaded update, the theme for the window
 * buttons, what plays for the tray, and the tray's media commands. Nothing else of Electron reaches the page.
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('lumioDesktop', {
  platform: process.platform,
  getSettings: () => ipcRenderer.invoke('desktop:settings'),
  setSettings: (patch) => ipcRenderer.invoke('desktop:set-settings', patch),
  relaunch: () => ipcRenderer.invoke('desktop:relaunch'),
  setTheme: (theme) => ipcRenderer.send('desktop:theme', theme),
  setNowPlaying: (info) => ipcRenderer.send('desktop:now-playing', info),
  getUpdate: () => ipcRenderer.invoke('desktop:update'),
  applyUpdate: () => ipcRenderer.invoke('desktop:apply-update'),
  onUpdateReady: (handler) => {
    const listener = (_event, update) => handler(update)
    ipcRenderer.on('desktop:update-ready', listener)
    return () => ipcRenderer.removeListener('desktop:update-ready', listener)
  },
  onMediaCommand: (handler) => {
    const listener = (_event, command) => handler(command)
    ipcRenderer.on('desktop:media', listener)
    return () => ipcRenderer.removeListener('desktop:media', listener)
  },
})
