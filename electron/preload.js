const { contextBridge, ipcRenderer } = require('electron')

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
  saveExcel: (buffer, defaultName) => ipcRenderer.invoke('save-excel', buffer, defaultName)
})
