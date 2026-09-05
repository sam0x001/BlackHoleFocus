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

  // Session close / tray behavior
  setSessionActive: (active) => ipcRenderer.invoke('session:setActive', Boolean(active)),
  confirmWindowClose: () => ipcRenderer.send('window:confirm-close'),
  hideToTray: () => ipcRenderer.send('window:hide-to-tray'),
  onCloseRequested: subscribe('app:close-requested'),
  onCheckpointBeforeQuit: subscribe('app:checkpoint-before-quit')
})
