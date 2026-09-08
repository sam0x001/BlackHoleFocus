const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, Notification, nativeImage, powerMonitor, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { execFile } = require('child_process')

let mainWindow
let tray = null
let sessionActive = false
let quitting = false
const isDev = !app.isPackaged

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })}


function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dataDir() {
  // Dev: project/data
  // Production: %APPDATA%\BlackHoleFocus\data (writable)
  let dir
  if (isDev) {
    dir = path.join(__dirname, '..', 'data')
  } else {
    dir = path.join(app.getPath('userData'), 'data')
  }
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function filePath(name) {
  return path.join(dataDir(), name)
}

// ---------- Atomic JSON writes ----------
function readJSON(name, fallback) {
  const p = filePath(name)
  try {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'))
    }
  } catch (e) {
    console.error('readJSON error', name, e)
  }
  return fallback
}

function writeJSON(name, data) {
  const p = filePath(name)
  const tmp = p + '.tmp'
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
    // On Windows, rename over existing file works; if not, unlink then rename
    try {
      fs.renameSync(tmp, p)
    } catch {
      if (fs.existsSync(p)) fs.unlinkSync(p)
      fs.renameSync(tmp, p)
    }
  } catch (e) {
    console.error('writeJSON error', name, e)
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp) } catch {}
    throw e
  }
  return true
}

// ---------- Append-only sessions (NDJSON) ----------
const SESSIONS_NDJSON = 'sessions.ndjson'
let sessionsCache = null // in-memory, newest-first

function migrateSessionsJsonIfNeeded() {
  const jsonPath = filePath('sessions.json')
  const ndPath = filePath(SESSIONS_NDJSON)
  if (!fs.existsSync(jsonPath)) return
  if (fs.existsSync(ndPath) && fs.statSync(ndPath).size > 0) return
  try {
    const list = readJSON('sessions.json', [])
    if (!Array.isArray(list) || list.length === 0) return
    // Write oldest first so file order is chronological; we reverse when loading
    const chronological = [...list].reverse()
    const body = chronological.map(s => JSON.stringify(s)).join('\n') + '\n'
    const tmp = ndPath + '.tmp'
    fs.writeFileSync(tmp, body, 'utf8')
    try {
      fs.renameSync(tmp, ndPath)
    } catch {
      if (fs.existsSync(ndPath)) fs.unlinkSync(ndPath)
      fs.renameSync(tmp, ndPath)
    }
    console.log('[BlackHole] Migrated sessions.json → sessions.ndjson:', list.length)
  } catch (e) {
    console.error('Session migration failed:', e)
  }
}

function loadSessionsFromDisk() {
  migrateSessionsJsonIfNeeded()
  const p = filePath(SESSIONS_NDJSON)
  if (!fs.existsSync(p)) {
    sessionsCache = []
    return sessionsCache
  }
  try {
    const raw = fs.readFileSync(p, 'utf8')
    const list = []
    for (const line of raw.split('\n')) {
      const t = line.trim()
      if (!t) continue
      try {
        list.push(JSON.parse(t))
      } catch (e) {
        console.warn('Skip bad session line:', t.slice(0, 80))
      }
    }
    // newest first
    list.reverse()
    sessionsCache = list
    return sessionsCache
  } catch (e) {
    console.error('loadSessionsFromDisk error:', e)
    sessionsCache = []
    return sessionsCache
  }
}

function getSessions() {
  if (sessionsCache) return sessionsCache
  return loadSessionsFromDisk()
}

function appendSession(session) {
  const p = filePath(SESSIONS_NDJSON)
  fs.appendFileSync(p, JSON.stringify(session) + '\n', 'utf8')
  if (!sessionsCache) sessionsCache = []
  sessionsCache.unshift(session)
}

// ---------- Defaults ----------
const defaultCategories = []

const defaultSettings = {
  theme: 'void',
  backgrounds: { void: null, pulse: null, neon: null },
  timerMode: 'stopwatch',
  countdownTarget: 25 * 60,
  sidebarOpen: true,
  activeSession: null
}

function ensureDataFiles() {
  dataDir()
  migrateSessionsJsonIfNeeded()
  if (!fs.existsSync(filePath(SESSIONS_NDJSON))) {
    fs.writeFileSync(filePath(SESSIONS_NDJSON), '', 'utf8')
  }
  if (!fs.existsSync(filePath('categories.json'))) writeJSON('categories.json', [])
  if (!fs.existsSync(filePath('tasks.json'))) writeJSON('tasks.json', [])
  if (!fs.existsSync(filePath('settings.json'))) writeJSON('settings.json', defaultSettings)
  loadSessionsFromDisk()
}

// ---------- Window ----------
function createWindow() {
  const iconCandidates = [
    path.join(__dirname, '..', 'build', 'icon.ico'),
    path.join(__dirname, '..', 'public', 'icon.ico'),
    path.join(process.resourcesPath || '', 'icon.ico'),
  ]
  const iconPath = iconCandidates.find(p => p && fs.existsSync(p))
  console.log('[BlackHole] Window icon:', iconPath || 'NONE')

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 650,
    backgroundColor: '#050508',
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#05050800',
      symbolColor: '#ffffff',
      height: 40
    },
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Keep the 1s timer running accurately while hidden in the system tray
      backgroundThrottling: false
    },
    show: false
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('closed', () => { mainWindow = null })

  // Closing is always intercepted: with an active session ask the user,
  // otherwise quietly keep running from the system tray.
  mainWindow.on('close', (e) => {
    if (quitting) return
    e.preventDefault()
    if (sessionActive && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:close-requested')
    } else {
      hideWindowToTray(false)
    }
  })
}

// ---------- Tray / background session ----------
function resolveAppIcon() {
  const candidates = [
    path.join(__dirname, '..', 'build', 'icon.ico'),
    path.join(__dirname, '..', 'public', 'icon.ico'),
    path.join(process.resourcesPath || '', 'icon.ico'),
    path.join(process.resourcesPath || '', 'tray.ico')
  ]
  return candidates.find(p => p && fs.existsSync(p)) || null
}


function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function ensureTray() {
  if (tray) return tray
  const icon = resolveAppIcon()
  tray = new Tray(icon ? nativeImage.createFromPath(icon) : nativeImage.createEmpty())
  tray.setToolTip('BlackHole Focus')
  const menu = Menu.buildFromTemplate([
    { label: 'Open BlackHole Focus', click: showMainWindow },
    { type: 'separator' },
    { label: 'Quit', click: quitApp },
  ])
  tray.setContextMenu(menu)
  tray.on('double-click', showMainWindow)
  tray.on('click', showMainWindow)
  return tray
}

function notifyTrayed() {
  if (!Notification.isSupported()) return
  const opts = {
    title: 'BlackHole Focus',
    body: 'Your focus session is still running — BlackHole Focus has moved to the system tray and keeps tracking time.',
  }
  const icon = resolveAppIcon()
  if (icon) opts.icon = icon
  const notification = new Notification(opts)
  notification.on('click', showMainWindow)
  notification.show()
}

function hideWindowToTray(notify) {
  ensureTray()
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide()
  if (notify) notifyTrayed()
}

function quitApp() {
  if (quitting) return
  quitting = true
  const finish = () => app.quit()
  if (sessionActive && mainWindow && !mainWindow.isDestroyed()) {
    // Give the renderer a moment to write the active-session checkpoint first
    mainWindow.webContents.send('app:checkpoint-before-quit')
    setTimeout(finish, 400)
  } else {
    finish()
  }
}

app.whenReady().then(() => {
  ensureDataFiles()
  console.log('[BlackHole] Data folder:', dataDir())
  if (process.platform === 'win32') app.setAppUserModelId('com.blackhole.focus')
  ensureTray()
  // Windows shutdown / logoff: quit without showing the session dialog
  powerMonitor.on('session-end', () => quitApp())
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  if (tray) {
    tray.destroy()
    tray = null
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ---------- IPC: Settings ----------
ipcMain.handle('settings:get', () => {
  return { ...defaultSettings, ...readJSON('settings.json', defaultSettings) }
})

ipcMain.handle('settings:set', (_e, data) => {
  writeJSON('settings.json', data)
  return true
})

// ---------- IPC: Sessions ----------
ipcMain.handle('db:path', () => dataDir())

ipcMain.handle('db:getSessions', () => {
  return getSessions()
})

ipcMain.handle('db:addSession', (_e, session) => {
  appendSession(session)
  return true
})

ipcMain.handle('db:getTodayTotal', () => {
  const today = localDateStr()
  return getSessions()
    .filter(s => s.date === today)
    .reduce((sum, s) => sum + (s.duration || 0), 0)
})

ipcMain.handle('db:getTodayByCategory', () => {
  const today = localDateStr()
  const map = {}
  getSessions()
    .filter(s => s.date === today)
    .forEach(s => {
      map[s.category] = (map[s.category] || 0) + (s.duration || 0)
    })
  return map
})

// ---------- IPC: Categories ----------
ipcMain.handle('db:getCategories', () => {
  return readJSON('categories.json', [])
})

ipcMain.handle('db:addCategory', (_e, cat) => {
  const list = readJSON('categories.json', [])
  list.push(cat)
  writeJSON('categories.json', list)
  return true
})

ipcMain.handle('db:removeCategory', (_e, id) => {
  let list = readJSON('categories.json', [])
  list = list.filter(c => c.id !== id)
  writeJSON('categories.json', list)
  return true
})

// ---------- IPC: Tasks ----------
ipcMain.handle('db:getTasks', () => {
  return readJSON('tasks.json', [])
})

ipcMain.handle('db:addTask', (_e, task) => {
  const list = readJSON('tasks.json', [])
  list.push(task)
  writeJSON('tasks.json', list)
  return true
})

ipcMain.handle('db:toggleTask', (_e, id, done) => {
  const list = readJSON('tasks.json', [])
  const item = list.find(t => t.id === id)
  if (item) item.done = done
  writeJSON('tasks.json', list)
  return true
})

ipcMain.handle('db:removeTask', (_e, id) => {
  let list = readJSON('tasks.json', [])
  list = list.filter(t => t.id !== id)
  writeJSON('tasks.json', list)
  return true
})

// ---------- Session end sound ----------
// The original "Bip-Bip" (two 350ms 880Hz tones, 100ms apart) is synthesized
// as a WAV and played from the main process, so it is audible even when the
// window is hidden in the system tray (renderer audio may be suspended).
function buildBipBipWav() {
  const sampleRate = 44100
  const freq = 880
  const beepSeconds = 0.35
  const gapSeconds = 0.1
  const amp = 0.3
  const beepSamples = Math.floor(beepSeconds * sampleRate)
  const gapSamples = Math.floor(gapSeconds * sampleRate)
  const totalSamples = beepSamples * 2 + gapSamples
  const dataSize = totalSamples * 2
  const buf = Buffer.alloc(44 + dataSize)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // mono
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)
  for (let i = 0; i < totalSamples; i++) {
    const inBeep = i < beepSamples || i >= beepSamples + gapSamples
    const v = inBeep ? amp * Math.sin(2 * Math.PI * freq * i / sampleRate) : 0
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2)
  }
  return buf
}

function playFallbackBeep() {
  shell.beep()
  setTimeout(() => shell.beep(), 450)
}

function playSessionEndSound() {
  if (process.platform !== 'win32') {
    playFallbackBeep()
    return
  }
  try {
    const wavPath = path.join(app.getPath('temp'), 'blackhole-bipbip.wav')
    fs.writeFileSync(wavPath, buildBipBipWav())
    const ps = `$p = New-Object System.Media.SoundPlayer '${wavPath}'; $p.PlaySync()`
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', ps], (err) => {
      if (err) playFallbackBeep()
    })
  } catch (e) {
    console.error('Session-end sound failed:', e)
    playFallbackBeep()
  }
}

ipcMain.on('session:ended', () => {
  playSessionEndSound()
})

// ---------- Session close / tray ----------
ipcMain.handle('session:setActive', (_e, active) => {
  sessionActive = Boolean(active)
})

ipcMain.on('window:confirm-close', () => {
  // User picked "Exit anyway" — renderer already saved the session checkpoint.
  if (quitting) return
  quitting = true
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close()
})

ipcMain.on('window:hide-to-tray', () => {
  hideWindowToTray(sessionActive)
})

// ---------- Excel ----------
ipcMain.handle('save-excel', async (_e, buffer, defaultName) => {
  const { filePath: savePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Excel Report',
    defaultPath: defaultName || 'focus-report.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  })
  if (canceled || !savePath) return { success: false }
  try {
    fs.writeFileSync(savePath, Buffer.from(buffer))
    return { success: true, path: savePath }
  } catch (err) {
    return { success: false, error: err.message }
  }
})
