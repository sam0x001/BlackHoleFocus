/// <reference types="vite/client" />

export {}

declare module 'sql.js' {
  const initSqlJs: any
  export = initSqlJs
}

declare global {
  interface ElectronAPI {
    // Settings
    getSettings: () => Promise<any>
    setSettings: (data: any) => Promise<boolean>

    // Database
    getDbPath: () => Promise<string>
    getSessions: () => Promise<any[]>
    addSession: (s: any) => Promise<boolean>
    getTodayTotal: () => Promise<number>
    getTodayByCategory: () => Promise<Record<string, number>>
    getCategories: () => Promise<any[]>
    addCategory: (cat: any) => Promise<boolean>
    removeCategory: (id: string) => Promise<boolean>
    getTasks: () => Promise<any[]>
    addTask: (task: any) => Promise<boolean>
    toggleTask: (id: string, done: boolean) => Promise<boolean>
    removeTask: (id: string) => Promise<boolean>

    // Excel
    saveExcel: (buffer: number[], defaultName: string) => Promise<{ success: boolean; error?: string }>

    // Session close / tray behavior
    setSessionActive: (active: boolean) => Promise<void>
    confirmWindowClose: () => void
    hideToTray: () => void
    onCloseRequested: (callback: () => void) => () => void
    onCheckpointBeforeQuit: (callback: () => void) => () => void
  }

  interface Window {
    electronAPI?: ElectronAPI
  }
}
