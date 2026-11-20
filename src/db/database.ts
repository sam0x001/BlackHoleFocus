// Data access layer.
//
// Every call goes through here: Electron's IPC when the app runs in the desktop
// shell, otherwise the localStorage-backed browser backend (Vite dev server and
// `npm run preview`). Components and the store never talk to a platform
// directly, so both share one code path.

import * as web from './webStorage'

function native(): any {
  return typeof window !== 'undefined' ? (window as any).electronAPI : null
}

export async function initDatabase() {
  const api = native()
  if (api?.getDbPath) await api.getDbPath()
}

export async function dbGetSessions(): Promise<any[]> {
  const api = native()
  return api ? api.getSessions() : web.getSessions()
}

export async function dbAddSession(session: {
  id: string; date: string; category: string; duration: number; note?: string; createdAt: number
}): Promise<boolean> {
  const api = native()
  return api ? api.addSession(session) : web.addSession(session as web.WebSession)
}

export async function dbGetTodayTotal(): Promise<number> {
  const api = native()
  return api ? api.getTodayTotal() : web.getTodayTotal()
}

export async function dbGetTodayByCategory(): Promise<Record<string, number>> {
  const api = native()
  return api ? api.getTodayByCategory() : web.getTodayByCategory()
}

export async function dbGetCategories(): Promise<any[]> {
  const api = native()
  return api ? api.getCategories() : web.getCategories()
}

export async function dbAddCategory(cat: { id: string; name: string; color: string }): Promise<boolean> {
  const api = native()
  return api ? api.addCategory(cat) : web.addCategory(cat)
}

export async function dbRemoveCategory(id: string): Promise<boolean> {
  const api = native()
  return api ? api.removeCategory(id) : web.removeCategory(id)
}

export async function dbGetTasks(): Promise<any[]> {
  const api = native()
  return api ? api.getTasks() : web.getTasks()
}

export async function dbAddTask(task: { id: string; text: string; done: boolean }): Promise<boolean> {
  const api = native()
  return api ? api.addTask(task) : web.addTask(task)
}

export async function dbToggleTask(id: string, done: boolean): Promise<boolean> {
  const api = native()
  return api ? api.toggleTask(id, done) : web.toggleTask(id, done)
}

export async function dbRemoveTask(id: string): Promise<boolean> {
  const api = native()
  return api ? api.removeTask(id) : web.removeTask(id)
}

export async function loadSettings(): Promise<any> {
  const api = native()
  return api ? api.getSettings() : web.getSettings()
}

export async function saveSettings(data: any): Promise<boolean> {
  const api = native()
  return api ? api.setSettings(data) : web.setSettings(data)
}

// ---------- Rest days (excluded from stats, labeled "Break Time") ----------
export async function dbGetRestDays(): Promise<string[]> {
  const api = native()
  return api ? api.getRestDays() : web.getRestDays()
}

export async function dbAddRestDay(date: string): Promise<string[]> {
  const api = native()
  return api ? api.addRestDay(date) : web.addRestDay(date)
}

export async function dbRemoveRestDay(date: string): Promise<string[]> {
  const api = native()
  return api ? api.removeRestDay(date) : web.removeRestDay(date)
}

// ---------- Sessions ----------
export async function dbDeleteSession(id: string): Promise<boolean> {
  const api = native()
  return api ? api.deleteSession(id) : web.deleteSession(id)
}

export async function dbUpdateSession(id: string, patch: any): Promise<boolean> {
  const api = native()
  return api ? api.updateSession(id, patch) : web.updateSession(id, patch)
}

// ---------- Crash-recovery journal ----------
export async function getSessionJournal(): Promise<any | null> {
  const api = native()
  return api ? api.getJournal() : web.getJournal()
}

export function writeSessionJournal(data: any) {
  const api = native()
  if (api) api.writeJournal(data)
  else web.writeJournal(data)
}

export function clearSessionJournal() {
  const api = native()
  if (api) api.clearJournal()
  else web.clearJournal()
}

// ---------- Data management (backup / import / custom folder) ----------
export async function dbBackupData(): Promise<{ success: boolean; canceled?: boolean; error?: string }> {
  const api = native()
  return api ? api.backupData() : web.backupData()
}

export async function dbImportSessions(): Promise<{ success: boolean; canceled?: boolean; imported?: number; error?: string }> {
  const api = native()
  return api ? api.importSessions() : web.importSessions()
}

export async function dbPickDataFolder(): Promise<{ success: boolean; canceled?: boolean; path?: string; error?: string }> {
  const api = native()
  return api ? api.pickDataFolder() : web.pickDataFolder()
}

export async function dbResetDataFolder(): Promise<boolean> {
  const api = native()
  return api ? api.resetDataFolder() : web.resetDataFolder()
}

export async function dbOpenDataFolder(): Promise<boolean> {
  const api = native()
  return api ? api.openDataFolder() : web.openDataFolder()
}

// ---------- App ----------
export async function getAutostart(): Promise<boolean> {
  const api = native()
  return api ? api.getAutostart() : web.getAutostart()
}

export async function setAutostart(on: boolean): Promise<boolean> {
  const api = native()
  return api ? api.setAutostart(on) : web.setAutostart(on)
}
