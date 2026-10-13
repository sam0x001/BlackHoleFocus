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

    // Rest days ("Break Time")
    getRestDays: () => Promise<string[]>
    addRestDay: (date: string) => Promise<string[]>
    removeRestDay: (date: string) => Promise<string[]>

    // Session deletion
    deleteSession: (id: string) => Promise<boolean>
    updateSession: (id: string, patch: any) => Promise<boolean>

    // Crash-recovery journal
    writeJournal: (data: any) => void
    clearJournal: () => void
    getJournal: () => Promise<any | null>

    // Data management
    backupData: () => Promise<{ success: boolean; canceled?: boolean; error?: string }>
    importSessions: () => Promise<{ success: boolean; canceled?: boolean; imported?: number; error?: string }>
    pickDataFolder: () => Promise<{ success: boolean; canceled?: boolean; path?: string; error?: string }>
    resetDataFolder: () => Promise<boolean>
    openDataFolder: () => Promise<boolean>

    // App behaviour
    getAutostart: () => Promise<boolean>
    setAutostart: (on: boolean) => Promise<boolean>

    // Session close / tray behavior
    setSessionActive: (active: boolean) => Promise<void>
    notifySessionEnded: (payload?: { category?: string; seconds?: number; title?: string; body?: string; always?: boolean }) => void
    updateTray: (info: { active: boolean; paused: boolean; label: string }) => void
    confirmWindowClose: () => void
    hideToTray: () => void
    onCloseRequested: (callback: () => void) => () => void
    onCheckpointBeforeQuit: (callback: () => void) => () => void
    onTrayTogglePause: (callback: () => void) => () => void
  }

  interface Window {
    electronAPI?: ElectronAPI
  }
}
