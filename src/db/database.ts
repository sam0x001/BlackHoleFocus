// Talks to Electron main process — data saved in project/data/*.json

function api() {
  const a = (window as any).electronAPI
  if (!a) throw new Error('Not running inside Electron. Use: npm run dev')
  return a
}

export async function initDatabase() {
  await api().getDbPath()
}

export async function dbGetSessions() {
  return api().getSessions()
}

export async function dbAddSession(session: {
  id: string; date: string; category: string; duration: number; note?: string; createdAt: number
}) {
  return api().addSession(session)
}

export async function dbGetTodayTotal(): Promise<number> {
  return api().getTodayTotal()
}

export async function dbGetTodayByCategory(): Promise<Record<string, number>> {
  return api().getTodayByCategory()
}

export async function dbGetCategories() {
  return api().getCategories()
}

export async function dbAddCategory(cat: { id: string; name: string; color: string }) {
  return api().addCategory(cat)
}

export async function dbRemoveCategory(id: string) {
  return api().removeCategory(id)
}

export async function dbGetTasks() {
  return api().getTasks()
}

export async function dbAddTask(task: { id: string; text: string; done: boolean }) {
  return api().addTask(task)
}

export async function dbToggleTask(id: string, done: boolean) {
  return api().toggleTask(id, done)
}

export async function dbRemoveTask(id: string) {
  return api().removeTask(id)
}

export async function loadSettings() {
  return api().getSettings()
}

export async function saveSettings(data: any) {
  return api().setSettings(data)
}
