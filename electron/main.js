const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow
const isDev = !app.isPackaged

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
      sandbox: true
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
}

app.whenReady().then(() => {
  ensureDataFiles()
  console.log('[BlackHole] Data folder:', dataDir())
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
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
