const { contextBridge, ipcRenderer } = require('electron')

const subscribe = (channel) => (callback) => {
  const listener = () => callback()
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (data) => ipcRenderer.invoke('settings:set', data),

  // Database
  getDbPath: () => ipcRenderer.invoke('db:path'),
  getSessions: () => ipcRenderer.invoke('db:getSessions'),
  addSession: (s) => ipcRenderer.invoke('db:addSession', s),
  getTodayTotal: () => ipcRenderer.invoke('db:getTodayTotal'),
  getTodayByCategory: () => ipcRenderer.invoke('db:getTodayByCategory'),
  getCategories: () => ipcRenderer.invoke('db:getCategories'),
  addCategory: (cat) => ipcRenderer.invoke('db:addCategory', cat),
  removeCategory: (id) => ipcRenderer.invoke('db:removeCategory', id),
  getTasks: () => ipcRenderer.invoke('db:getTasks'),
  addTask: (task) => ipcRenderer.invoke('db:addTask', task),
  toggleTask: (id, done) => ipcRenderer.invoke('db:toggleTask', id, done),
  removeTask: (id) => ipcRenderer.invoke('db:removeTask', id),

  // Excel
  saveExcel: (buffer, defaultName) => ipcRenderer.invoke('save-excel', buffer, defaultName),

  // Rest days ("Break Time")
  getRestDays: () => ipcRenderer.invoke('db:getRestDays'),
  addRestDay: (date) => ipcRenderer.invoke('db:addRestDay', date),
  removeRestDay: (date) => ipcRenderer.invoke('db:removeRestDay', date),

  // Session deletion
  deleteSession: (id) => ipcRenderer.invoke('db:deleteSession', id),
  updateSession: (id, patch) => ipcRenderer.invoke('db:updateSession', id, patch),

  // Crash-recovery journal (written every tick, cleared on clean stop)
  writeJournal: (data) => ipcRenderer.send('session:journal', data),
  clearJournal: () => ipcRenderer.send('session:journal-clear'),
  getJournal: () => ipcRenderer.invoke('session:journal-get'),

  // Data management (backup / import / custom folder)
  backupData: () => ipcRenderer.invoke('data:backup'),
  importSessions: () => ipcRenderer.invoke('data:import'),
  pickDataFolder: () => ipcRenderer.invoke('data:pick-folder'),
  resetDataFolder: () => ipcRenderer.invoke('data:reset-folder'),
  openDataFolder: () => ipcRenderer.invoke('data:open'),

  // App behaviour
  getAutostart: () => ipcRenderer.invoke('app:getAutostart'),
  setAutostart: (on) => ipcRenderer.invoke('app:setAutostart', on),

  // Session close / tray behavior
  setSessionActive: (active) => ipcRenderer.invoke('session:setActive', Boolean(active)),
  notifySessionEnded: (payload) => ipcRenderer.send('session:ended', payload),
  updateTray: (info) => ipcRenderer.send('session:update-tray', info),
  confirmWindowClose: () => ipcRenderer.send('window:confirm-close'),
  hideToTray: () => ipcRenderer.send('window:hide-to-tray'),
  onCloseRequested: subscribe('app:close-requested'),
  onCheckpointBeforeQuit: subscribe('app:checkpoint-before-quit'),
  onTrayTogglePause: subscribe('app:tray-toggle-pause')
})
