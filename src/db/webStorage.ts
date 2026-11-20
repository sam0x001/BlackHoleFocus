/**
 * Browser storage backend.
 *
 * The desktop build stores everything through Electron's main process
 * (NDJSON + JSON files). A plain browser (Vite dev server / `npm run preview`)
 * has no `window.electronAPI`, so the exact same API surface is implemented
 * here on top of `localStorage`. The packaged Windows app always uses Electron.
 */
import { localDateString } from '../lib/date'

export interface WebSession {
  id: string
  date: string
  category: string
  duration: number
  note?: string
  createdAt: number
}

export interface WebCategory {
  id: string
  name: string
  color: string
}

export interface WebTask {
  id: string
  text: string
  done: boolean
}

const KEYS = {
  sessions: 'bh:sessions',
  categories: 'bh:categories',
  tasks: 'bh:tasks',
  restDays: 'bh:restDays',
  settings: 'bh:settings',
  journal: 'bh:journal'
} as const

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return (parsed ?? fallback) as T
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

function readSessions(): WebSession[] {
  const list = read<WebSession[]>(KEYS.sessions, [])
  return Array.isArray(list) ? list.filter(s => s && typeof s.id === 'string') : []
}

function sortNewestFirst(list: WebSession[]): WebSession[] {
  return [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

// ---------- Sessions ----------
export async function getSessions(): Promise<WebSession[]> {
  return sortNewestFirst(readSessions())
}

export async function addSession(session: WebSession): Promise<boolean> {
  const list = readSessions()
  if (!list.some(s => s.id === session.id)) list.push(session)
  write(KEYS.sessions, list)
  return true
}

export async function updateSession(id: string, patch: Partial<WebSession>): Promise<boolean> {
  const list = readSessions()
  const index = list.findIndex(s => s.id === id)
  if (index === -1) return false
  list[index] = { ...list[index], ...patch, id }
  write(KEYS.sessions, list)
  return true
}

export async function deleteSession(id: string): Promise<boolean> {
  const list = readSessions()
  const next = list.filter(s => s.id !== id)
  write(KEYS.sessions, next)
  return next.length !== list.length
}

export async function getTodayTotal(): Promise<number> {
  const today = localDateString()
  return readSessions().filter(s => s.date === today).reduce((sum, s) => sum + (s.duration || 0), 0)
}

export async function getTodayByCategory(): Promise<Record<string, number>> {
  const today = localDateString()
  const map: Record<string, number> = {}
  readSessions()
    .filter(s => s.date === today)
    .forEach(s => { map[s.category] = (map[s.category] || 0) + (s.duration || 0) })
  return map
}

// ---------- Categories ----------
export async function getCategories(): Promise<WebCategory[]> {
  return read<WebCategory[]>(KEYS.categories, [])
}

export async function addCategory(cat: WebCategory): Promise<boolean> {
  const list = read<WebCategory[]>(KEYS.categories, [])
  if (!list.some(c => c.id === cat.id)) list.push(cat)
  write(KEYS.categories, list)
  return true
}

export async function removeCategory(id: string): Promise<boolean> {
  write(KEYS.categories, read<WebCategory[]>(KEYS.categories, []).filter(c => c.id !== id))
  return true
}

// ---------- Tasks ----------
export async function getTasks(): Promise<WebTask[]> {
  return read<WebTask[]>(KEYS.tasks, [])
}

export async function addTask(task: WebTask): Promise<boolean> {
  const list = read<WebTask[]>(KEYS.tasks, [])
  if (!list.some(t => t.id === task.id)) list.push(task)
  write(KEYS.tasks, list)
  return true
}

export async function toggleTask(id: string, done: boolean): Promise<boolean> {
  write(KEYS.tasks, read<WebTask[]>(KEYS.tasks, []).map(t => (t.id === id ? { ...t, done } : t)))
  return true
}

export async function removeTask(id: string): Promise<boolean> {
  write(KEYS.tasks, read<WebTask[]>(KEYS.tasks, []).filter(t => t.id !== id))
  return true
}

// ---------- Rest days ----------
export async function getRestDays(): Promise<string[]> {
  const list = read<string[]>(KEYS.restDays, [])
  return Array.isArray(list) ? list : []
}

export async function addRestDay(date: string): Promise<string[]> {
  const list = getRestDaysSync()
  if (!list.includes(date)) list.push(date)
  list.sort()
  write(KEYS.restDays, list)
  return list
}

export async function removeRestDay(date: string): Promise<string[]> {
  const list = getRestDaysSync().filter(d => d !== date)
  write(KEYS.restDays, list)
  return list
}

function getRestDaysSync(): string[] {
  const list = read<string[]>(KEYS.restDays, [])
  return Array.isArray(list) ? list : []
}

// ---------- Settings ----------
export async function getSettings(): Promise<any> {
  return read<Record<string, unknown>>(KEYS.settings, {})
}

export async function setSettings(data: any): Promise<boolean> {
  try {
    write(KEYS.settings, data)
    return true
  } catch (e) {
    // Background images are stored inline as data URLs and can blow the
    // localStorage quota — keep the actual settings rather than losing them.
    console.warn('Settings too large for web storage, dropping theme backgrounds:', e)
    try {
      write(KEYS.settings, { ...data, backgrounds: { void: null, pulse: null, neon: null } })
      return true
    } catch {
      return false
    }
  }
}

// ---------- Crash-recovery journal ----------
export async function getJournal(): Promise<any | null> {
  return read<any | null>(KEYS.journal, null)
}

export function writeJournal(data: any): void {
  try {
    write(KEYS.journal, data)
  } catch {}
}

export function clearJournal(): void {
  try {
    localStorage.removeItem(KEYS.journal)
  } catch {}
}

// ---------- Backup / import / folders ----------
/**
 * Backup bundle. Same idea as the desktop one: one JSON file holding every
 * store, so it can be imported on any platform.
 */
export async function backupData(): Promise<{ success: boolean; canceled?: boolean; error?: string }> {
  try {
    const bundle = {
      app: 'BlackHoleFocus',
      exportedAt: new Date().toISOString(),
      sessions: readSessions(),
      categories: read<WebCategory[]>(KEYS.categories, []),
      tasks: read<WebTask[]>(KEYS.tasks, []),
      restDays: getRestDaysSync(),
      settings: read<Record<string, unknown>>(KEYS.settings, {})
    }
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `blackhole-focus-backup-${localDateString()}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return { success: true }
  } catch (e: any) {
    return { success: false, error: String(e?.message || e) }
  }
}

function parseImport(text: string): WebSession[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  // Bundle or plain array
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      const list = Array.isArray(parsed) ? parsed : parsed?.sessions
      if (Array.isArray(list)) return list.filter((s: any) => s && s.id && Number.isFinite(s.duration))
    } catch {
      // Fall through to NDJSON parsing
    }
  }
  // NDJSON (one session per line)
  const out: WebSession[] = []
  for (const line of trimmed.split('\n')) {
    const t = line.trim()
    if (!t.startsWith('{')) continue
    try {
      const s = JSON.parse(t)
      if (s && s.id && Number.isFinite(s.duration)) out.push(s)
    } catch {}
  }
  return out
}

export async function importSessions(): Promise<{ success: boolean; canceled?: boolean; imported?: number; error?: string }> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.ndjson,application/json'
    input.style.display = 'none'
    document.body.appendChild(input)

    const cleanup = () => input.remove()

    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        cleanup()
        resolve({ success: false, canceled: true })
        return
      }
      try {
        const incoming = parseImport(await file.text())
        const existing = readSessions()
        const seen = new Set(existing.map(s => s.id))
        let imported = 0
        for (const s of incoming) {
          if (seen.has(s.id)) continue
          existing.push(s)
          seen.add(s.id)
          imported++
        }
        if (imported > 0) write(KEYS.sessions, existing)
        cleanup()
        resolve({ success: true, imported })
      } catch (e: any) {
        cleanup()
        resolve({ success: false, error: String(e?.message || e) })
      }
    }

    input.click()
  })
}

// A WebView has no notion of a data folder — these stay inert but keep the
// Settings screen's contract intact.
export async function pickDataFolder() {
  return { success: false, canceled: true }
}

export async function resetDataFolder(): Promise<boolean> {
  return false
}

export async function openDataFolder(): Promise<boolean> {
  return false
}

export async function getAutostart(): Promise<boolean> {
  return false
}

export async function setAutostart(_on: boolean): Promise<boolean> {
  return false
}
