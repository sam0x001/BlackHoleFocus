const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow
const isDev = !app.isPackaged

function projectRoot() {
  // Always the folder that contains package.json / the project
  if (isDev) {
    return path.join(__dirname, '..')
  }
  return path.dirname(app.getPath('exe'))
}

function dataDir() {
  const dir = path.join(projectRoot(), 'data')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function filePath(name) {
  return path.join(dataDir(), name)
}

// ---------- JSON helpers ----------
function readJSON(name, fallback) {
  const p = filePath(name)
  try {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8')
      return JSON.parse(raw)
    }
  } catch (e) {
    console.error('readJSON error', name, e)
  }
  return fallback
}

function writeJSON(name, data) {
  const p = filePath(name)
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8')
  return true
}

// ---------- Defaults ----------
const defaultCategories = [
  { id: '1', name: 'Programming', color: '#3b82f6' },
  { id: '2', name: 'Learning', color: '#a855f7' },
  { id: '3', name: 'Building', color: '#22c55e' },
  { id: '4', name: 'Research', color: '#f59e0b' },
  { id: '5', name: 'Social Media', color: '#ef4444' },
]

const defaultSettings = {
  theme: 'void',
  backgrounds: { void: null, pulse: null, neon: null },
  timerMode: 'stopwatch',
  countdownTarget: 25 * 60,
  sidebarOpen: true
}

function ensureDataFiles() {
  dataDir()
  if (!fs.existsSync(filePath('sessions.json'))) writeJSON('sessions.json', [])
  if (!fs.existsSync(filePath('categories.json'))) writeJSON('categories.json', defaultCategories)
  if (!fs.existsSync(filePath('tasks.json'))) writeJSON('tasks.json', [])
  if (!fs.existsSync(filePath('settings.json'))) writeJSON('settings.json', defaultSettings)
}

// ---------- Window ----------
function createWindow() {
  // Icon: try build/, public/, and packaged resources
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
      sandbox: false
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
  return readJSON('sessions.json', [])
})

ipcMain.handle('db:addSession', (_e, session) => {
  const list = readJSON('sessions.json', [])
  list.unshift(session) // newest first
  writeJSON('sessions.json', list)
  return true
})

ipcMain.handle('db:getTodayTotal', () => {
  const today = new Date().toISOString().slice(0, 10)
  const list = readJSON('sessions.json', [])
  return list.filter(s => s.date === today).reduce((sum, s) => sum + (s.duration || 0), 0)
})

ipcMain.handle('db:getTodayByCategory', () => {
  const today = new Date().toISOString().slice(0, 10)
  const list = readJSON('sessions.json', [])
  const map = {}
  list.filter(s => s.date === today).forEach(s => {
    map[s.category] = (map[s.category] || 0) + (s.duration || 0)
  })
  return map
})

// ---------- IPC: Categories ----------
ipcMain.handle('db:getCategories', () => {
  const list = readJSON('categories.json', defaultCategories)
  return list.length ? list : defaultCategories
})

ipcMain.handle('db:addCategory', (_e, cat) => {
  const list = readJSON('categories.json', defaultCategories)
  list.push(cat)
  writeJSON('categories.json', list)
  return true
})

ipcMain.handle('db:removeCategory', (_e, id) => {
  let list = readJSON('categories.json', defaultCategories)
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
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Excel Report',
    defaultPath: defaultName || 'focus-report.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  })
  if (canceled || !filePath) return { success: false }
  try {
    fs.writeFileSync(filePath, Buffer.from(buffer))
    return { success: true, path: filePath }
  } catch (err) {
    return { success: false, error: err.message }
  }
})
