const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, Notification, nativeImage, powerMonitor, shell, globalShortcut } = require('electron')
const path = require('path')
const fs = require('fs')
const { execFile } = require('child_process')

let mainWindow
let tray = null
let sessionActive = false
let quitting = false
// Live session info mirrored into the tray tooltip / menu (fed by the renderer)
let trayState = { active: false, paused: false, label: '' }
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

const CUSTOM_DIR_FILE = 'custom-data-dir.txt'

/** User-chosen data folder (persisted in userData, outside the data dir). */
function customDataDirPath() {
  try {
    const p = path.join(app.getPath('userData'), CUSTOM_DIR_FILE)
    if (fs.existsSync(p)) {
      const dir = fs.readFileSync(p, 'utf8').trim()
      if (dir && fs.existsSync(dir)) return dir
    }
  } catch {}
  return null
}

function dataDir() {
  // Custom folder (Settings → data) wins; else dev: project/data,
  // production: %APPDATA%\BlackHoleFocus\data (writable)
  let dir = customDataDirPath()
  if (!dir) {
    if (isDev) {
      dir = path.join(__dirname, '..', 'data')
    } else {
      dir = path.join(app.getPath('userData'), 'data')
    }
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

// ---------- Window bounds ----------
function loadWindowBounds() {
  const b = readJSON('window-bounds.json', null)
  if (!b || !Number.isFinite(b.width) || !Number.isFinite(b.height)) return null
  if (b.width < 1000 || b.height < 650) return null
  return b
}

function saveWindowBounds() {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMaximized() || mainWindow.isMinimized()) return
    writeJSON('window-bounds.json', mainWindow.getBounds())
  } catch (e) {
    console.warn('saveWindowBounds failed:', e)
  }
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
        // Preserve corrupt lines for manual recovery instead of silently dropping
        try { fs.appendFileSync(filePath('sessions.corrupt.ndjson'), t + '\n', 'utf8') } catch {}
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

/** Rewrite the whole NDJSON file atomically (list is newest-first). */
function writeSessionsToDisk(list) {
  sessionsCache = list
  const p = filePath(SESSIONS_NDJSON)
  const tmp = p + '.tmp'
  const body = [...list].reverse().map(s => JSON.stringify(s)).join('\n')
  fs.writeFileSync(tmp, body ? body + '\n' : '', 'utf8')
  try {
    fs.renameSync(tmp, p)
  } catch {
    if (fs.existsSync(p)) fs.unlinkSync(p)
    fs.renameSync(tmp, p)
  }
}

function uid() {
  return require('crypto').randomUUID()
}

/** A session crossing local midnight is split so each day gets its own record. */
function splitAtMidnight(session) {
  if (!session || !Number.isFinite(session.duration) || !Number.isFinite(session.createdAt)) return [session]
  const startMs = session.createdAt - session.duration * 1000
  const startDate = localDateStr(new Date(startMs))
  if (startDate === session.date || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return [session]
  const endOfStartDay = new Date(`${startDate}T00:00:00`)
  endOfStartDay.setDate(endOfStartDay.getDate() + 1)
  const part1 = Math.max(0, Math.round((endOfStartDay.getTime() - startMs) / 1000))
  const part2 = session.duration - part1
  const out = []
  if (part1 > 0) out.push({ ...session, id: uid(), date: startDate, duration: part1 })
  if (part2 > 0) out.push({ ...session, duration: part2 })
  return out
}

/** Merge incoming sessions with overlapping/touching sessions of the same category+day. */
function mergeSessionsInto(existing, incoming) {
  const list = [...existing]
  for (const s of incoming) {
    const sStart = s.createdAt - s.duration * 1000
    const sEnd = s.createdAt
    const idx = list.findIndex(o => {
      if (o.category !== s.category || o.date !== s.date) return false
      const oStart = o.createdAt - o.duration * 1000
      return sStart <= o.createdAt + 60000 && sEnd >= oStart - 60000
    })
    if (idx >= 0) {
      const o = list[idx]
      list.splice(idx, 1, {
        ...o,
        duration: o.duration + s.duration,
        createdAt: Math.max(o.createdAt, s.createdAt),
        note: [o.note, s.note].filter(Boolean).join(' · ') || undefined
      })
    } else {
      list.push(s)
    }
  }
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  return list
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
  if (!fs.existsSync(filePath('restDays.json'))) writeJSON('restDays.json', [])
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

  const savedBounds = loadWindowBounds()

  mainWindow = new BrowserWindow({
    width: savedBounds ? savedBounds.width : 1280,
    height: savedBounds ? savedBounds.height : 800,
    x: savedBounds && Number.isFinite(savedBounds.x) ? savedBounds.x : undefined,
    y: savedBounds && Number.isFinite(savedBounds.y) ? savedBounds.y : undefined,
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
    saveWindowBounds()
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

function buildTrayMenu() {
  if (!tray) return
  const items = [{ label: 'Open BlackHole Focus', click: showMainWindow }]
  if (trayState.active) {
    items.push({
      label: trayState.paused ? 'Resume session' : 'Pause session',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('app:tray-toggle-pause')
        }
      }
    })
  }
  items.push({ type: 'separator' }, { label: 'Quit', click: quitApp })
  tray.setContextMenu(Menu.buildFromTemplate(items))
}

function ensureTray() {
  if (tray) return tray
  const icon = resolveAppIcon()
  tray = new Tray(icon ? nativeImage.createFromPath(icon) : nativeImage.createEmpty())
  tray.setToolTip('BlackHole Focus')
  buildTrayMenu()
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
  // Global hotkey: Ctrl/Cmd+Alt+F toggles pause/resume from anywhere
  try {
    globalShortcut.register('CommandOrControl+Alt+F', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('app:tray-toggle-pause')
      }
    })
  } catch (e) {
    console.error('Global shortcut registration failed:', e)
  }
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  try { globalShortcut.unregisterAll() } catch {}
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

// ---------- Autostart ----------
ipcMain.handle('app:getAutostart', () => {
  try {
    return Boolean(app.getLoginItemSettings().openAtLogin)
  } catch {
    return false
  }
})

ipcMain.handle('app:setAutostart', (_e, on) => {
  try {
    app.setLoginItemSettings({
      openAtLogin: Boolean(on),
      path: process.execPath,
      args: isDev ? [app.getAppPath()] : []
    })
    return true
  } catch (e) {
    console.error('setAutostart failed:', e)
    return false
  }
})

// ---------- IPC: Sessions ----------
ipcMain.handle('db:path', () => dataDir())

ipcMain.handle('db:getSessions', () => {
  return getSessions()
})

ipcMain.handle('db:addSession', (_e, session) => {
  try {
    const parts = splitAtMidnight(session)
    const merged = mergeSessionsInto(getSessions(), parts)
    writeSessionsToDisk(merged)
    return true
  } catch (e) {
    console.error('addSession failed:', e)
    try { appendSession(session) } catch {}
    return false
  }
})

ipcMain.handle('db:updateSession', (_e, id, patch) => {
  try {
    const clean = { ...patch }
    delete clean.id
    const list = getSessions().map(s => (s.id === id ? { ...s, ...clean, id: s.id } : s))
    writeSessionsToDisk(list)
    return true
  } catch (e) {
    console.error('updateSession failed:', e)
    return false
  }
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

// ---------- Rest days ("Break Time" in charts & reports) ----------
const REST_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function readRestDays() {
  const list = readJSON('restDays.json', [])
  return Array.isArray(list) ? list.filter(d => typeof d === 'string' && REST_DATE_RE.test(d)) : []
}

ipcMain.handle('db:getRestDays', () => readRestDays())

ipcMain.handle('db:addRestDay', (_e, date) => {
  if (typeof date !== 'string' || !REST_DATE_RE.test(date)) return readRestDays()
  const list = readRestDays()
  if (!list.includes(date)) list.push(date)
  list.sort()
  writeJSON('restDays.json', list)
  return list
})

ipcMain.handle('db:removeRestDay', (_e, date) => {
  const list = readRestDays().filter(d => d !== date)
  writeJSON('restDays.json', list)
  return list
})

// ---------- Session deletion (rewrites the append-only NDJSON log) ----------
ipcMain.handle('db:deleteSession', (_e, id) => {
  try {
    writeSessionsToDisk(getSessions().filter(s => s.id !== id))
    return true
  } catch (e) {
    console.error('deleteSession failed:', e)
    return false
  }
})

// ---------- Crash-recovery journal (renderer writes every tick) ----------
const JOURNAL_FILE = 'active-session.json'
let journalLastWrite = 0
ipcMain.on('session:journal', (_e, data) => {
  const now = Date.now()
  if (now - journalLastWrite < 2000) return
  journalLastWrite = now
  try { writeJSON(JOURNAL_FILE, { ...data, savedAt: now }) } catch {}
})
ipcMain.on('session:journal-clear', () => {
  try {
    const p = filePath(JOURNAL_FILE)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  } catch {}
})
ipcMain.handle('session:journal-get', () => readJSON(JOURNAL_FILE, null))

// ---------- Data management: backup / import / custom folder ----------
ipcMain.handle('data:backup', async () => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'Save backup',
    defaultPath: `blackhole-backup-${localDateStr()}.json`,
    filters: [{ name: 'Backup', extensions: ['json'] }]
  })
  if (res.canceled || !res.filePath) return { success: false, canceled: true }
  try {
    const bundle = {
      app: 'BlackHoleFocus',
      bundleVersion: 1,
      exportedAt: new Date().toISOString(),
      sessions: getSessions(),
      categories: readJSON('categories.json', []),
      tasks: readJSON('tasks.json', []),
      restDays: readJSON('restDays.json', []),
      settings: readJSON('settings.json', {})
    }
    fs.writeFileSync(res.filePath, JSON.stringify(bundle, null, 2), 'utf8')
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('data:import', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Import sessions',
    filters: [{ name: 'Session data', extensions: ['ndjson', 'json', 'txt'] }],
    properties: ['openFile']
  })
  if (res.canceled || !res.filePaths[0]) return { success: false, canceled: true }
  try {
    const raw = fs.readFileSync(res.filePaths[0], 'utf8')
    const existing = getSessions()
    const ids = new Set(existing.map(s => s.id))
    const incoming = []
    for (const line of raw.split('\n')) {
      const t = line.trim()
      if (!t) continue
      try {
        const parsed = JSON.parse(t)
        const items = Array.isArray(parsed) ? parsed : [parsed]
        for (const it of items) {
          if (
            it && typeof it.category === 'string' && Number.isFinite(it.duration) &&
            typeof it.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(it.date) && !ids.has(it.id)
          ) {
            const rec = {
              ...it,
              id: it.id || uid(),
              createdAt: Number.isFinite(it.createdAt) ? it.createdAt : Date.now()
            }
            incoming.push(rec)
            ids.add(rec.id)
          }
        }
      } catch {}
    }
    if (incoming.length === 0) return { success: true, imported: 0 }
    writeSessionsToDisk(mergeSessionsInto(existing, incoming))
    return { success: true, imported: incoming.length }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('data:pick-folder', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose data folder',
    properties: ['openDirectory', 'createDirectory']
  })
  if (res.canceled || !res.filePaths[0]) return { success: false, canceled: true }
  const target = path.resolve(res.filePaths[0])
  try {
    const src = path.resolve(dataDir())
    if (target === src) return { success: false, error: 'Already using this folder' }
    for (const name of fs.readdirSync(src)) {
      const from = path.join(src, name)
      if (fs.statSync(from).isFile()) fs.copyFileSync(from, path.join(target, name))
    }
    fs.writeFileSync(path.join(app.getPath('userData'), CUSTOM_DIR_FILE), target, 'utf8')
    sessionsCache = null
    return { success: true, path: target }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('data:reset-folder', () => {
  try {
    const marker = path.join(app.getPath('userData'), CUSTOM_DIR_FILE)
    if (fs.existsSync(marker)) fs.unlinkSync(marker)
    sessionsCache = null
    return true
  } catch {
    return false
  }
})

ipcMain.handle('data:open', () => {
  shell.openPath(dataDir())
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

ipcMain.on('session:ended', (_e, payload) => {
  playSessionEndSound()
  // Notification when the window is hidden (tray), or always when asked
  // (e.g. break-over alerts during Pomodoro cycles).
  try {
    const hidden = !mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()
    if (Notification.isSupported() && (hidden || (payload && payload.always))) {
      const secs = Math.max(0, Number(payload && payload.seconds) || 0)
      const m = Math.floor(secs / 60)
      const s = secs % 60
      const duration = m > 0 ? `${m}m ${s}s` : `${s}s`
      const body = (payload && payload.body) ||
        `${(payload && payload.category) || 'Focus session'} · ${duration} recorded`
      const notification = new Notification({
        title: (payload && payload.title) || 'Focus session complete',
        body
      })
      notification.on('click', showMainWindow)
      notification.show()
    }
  } catch (e) {
    console.error('Session-end notification failed:', e)
  }
})

// ---------- Tray live state (elapsed time + pause/resume) ----------
ipcMain.on('session:update-tray', (_e, info) => {
  if (!info) return
  const next = {
    active: Boolean(info.active),
    paused: Boolean(info.paused),
    label: String(info.label || '')
  }
  const changed = next.active !== trayState.active || next.paused !== trayState.paused
  trayState = next
  ensureTray()
  if (tray) tray.setToolTip(trayState.label || 'BlackHole Focus')
  if (changed) buildTrayMenu()
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
