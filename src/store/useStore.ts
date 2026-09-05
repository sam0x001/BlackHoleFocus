import { create } from 'zustand'
import { localDateString } from '../lib/date'
import {
  initDatabase,
  dbGetSessions,
  dbAddSession,
  dbGetTodayTotal,
  dbGetTodayByCategory,
  dbGetCategories,
  dbAddCategory,
  dbRemoveCategory,
  dbGetTasks,
  dbAddTask,
  dbToggleTask,
  dbRemoveTask,
  loadSettings,
  saveSettings
} from '../db/database'

export type Theme = 'void' | 'pulse' | 'neon'
export type View = 'dashboard' | 'focus' | 'analytics' | 'settings'
export type TimerMode = 'stopwatch' | 'countdown'

export interface Session {
  id: string
  date: string
  category: string
  duration: number
  note?: string
  createdAt: number
}

export interface Category {
  id: string
  name: string
  color: string
}

export interface ActiveSession {
  category: string
  timerMode: TimerMode
  countdownTarget: number
  focusStartTime: number
  elapsedSeconds: number
  remainingSeconds: number
  isPaused: boolean
  isFocusing: boolean
}

interface AppState {
  ready: boolean
  initApp: () => Promise<void>
  persistSettings: () => Promise<void>
  checkpointActiveSession: () => void
  checkpointNow: () => Promise<void>

  theme: Theme
  setTheme: (theme: Theme) => void
  currentView: View
  setView: (view: View) => void
  sidebarOpen: boolean
  toggleSidebar: () => void

  backgrounds: Record<Theme, string | null>
  setBackground: (theme: Theme, url: string | null) => void

  timerMode: TimerMode
  setTimerMode: (mode: TimerMode) => void
  countdownTarget: number
  setCountdownTarget: (sec: number) => void

  isFocusing: boolean
  isPaused: boolean
  currentCategory: string | null
  focusStartTime: number | null
  elapsedSeconds: number
  remainingSeconds: number
  startFocus: (category: string) => void
  pauseFocus: () => void
  resumeFocus: () => void
  stopFocus: () => Promise<void>
  tick: () => void

  categories: Category[]
  addCategory: (name: string, color?: string) => Promise<void>
  removeCategory: (id: string) => Promise<void>

  sessions: Session[]
  todayTotal: number
  todayByCategory: Record<string, number>
  refreshStats: () => Promise<void>

  tasks: { id: string; text: string; done: boolean }[]
  addTask: (text: string) => Promise<void>
  toggleTask: (id: string) => Promise<void>
  removeTask: (id: string) => Promise<void>
}

const fallbackCategories: Category[] = []

const COLOR_PALETTE = [
  '#3b82f6', '#a855f7', '#22c55e', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#8b5cf6',
]

let persistTimer: ReturnType<typeof setTimeout> | null = null
let checkpointTimer: ReturnType<typeof setTimeout> | null = null

export const useStore = create<AppState>()((set, get) => ({
  ready: false,

  persistSettings: async () => {
    if (persistTimer) clearTimeout(persistTimer)
    return new Promise((resolve) => {
      persistTimer = setTimeout(async () => {
        const s = get()
        try {
          const prev = await loadSettings().catch(() => ({} as any))
          await saveSettings({
            theme: s.theme,
            backgrounds: s.backgrounds,
            timerMode: s.timerMode,
            countdownTarget: s.countdownTarget,
            sidebarOpen: s.sidebarOpen,
            // preserve activeSession if checkpoint wrote it
            activeSession: (prev as any).activeSession ?? null
          })
        } catch (e) {
          console.warn('Could not save settings:', e)
        }
        resolve()
      }, 1500)
    })
  },

  checkpointActiveSession: () => {
    if (checkpointTimer) clearTimeout(checkpointTimer)
    checkpointTimer = setTimeout(async () => {
      const s = get()
      try {
        const base = await loadSettings().catch(() => ({} as any))
        let activeSession: ActiveSession | null = null
        if (s.currentCategory && (s.isFocusing || s.isPaused) && s.elapsedSeconds > 0) {
          activeSession = {
            category: s.currentCategory,
            timerMode: s.timerMode,
            countdownTarget: s.countdownTarget,
            focusStartTime: s.focusStartTime || Date.now(),
            elapsedSeconds: s.elapsedSeconds,
            remainingSeconds: s.remainingSeconds,
            isPaused: s.isPaused,
            isFocusing: s.isFocusing
          }
        }
        await saveSettings({
          ...base,
          theme: s.theme,
          backgrounds: s.backgrounds,
          timerMode: s.timerMode,
          countdownTarget: s.countdownTarget,
          sidebarOpen: s.sidebarOpen,
          activeSession
        })
      } catch (e) {
        console.warn('Checkpoint failed:', e)
      }
    }, 1500)
  },

  // Immediate (non-debounced) checkpoint — used right before the app quits
  // so an interrupted session is restored paused on the next launch.
  checkpointNow: async () => {
    const s = get()
    try {
      const base = await loadSettings().catch(() => ({} as any))
      let activeSession: ActiveSession | null = null
      if (s.currentCategory && (s.isFocusing || s.isPaused) && s.elapsedSeconds > 0) {
        activeSession = {
          category: s.currentCategory,
          timerMode: s.timerMode,
          countdownTarget: s.countdownTarget,
          focusStartTime: s.focusStartTime || Date.now(),
          elapsedSeconds: s.elapsedSeconds,
          remainingSeconds: s.remainingSeconds,
          isPaused: s.isPaused,
          isFocusing: s.isFocusing
        }
      }
      await saveSettings({
        ...base,
        theme: s.theme,
        backgrounds: s.backgrounds,
        timerMode: s.timerMode,
        countdownTarget: s.countdownTarget,
        sidebarOpen: s.sidebarOpen,
        activeSession
      })
    } catch (e) {
      console.warn('Checkpoint failed:', e)
    }
  },

  initApp: async () => {
    try {
      await initDatabase()

      let settings: any = {}
      try {
        settings = await loadSettings()
      } catch {
        settings = {}
      }

      let sessions: Session[] = []
      let categories: Category[] = fallbackCategories
      let tasks: any[] = []
      let todayTotal = 0
      let todayByCategory: Record<string, number> = {}

      try {
        sessions = await dbGetSessions()
        categories = await dbGetCategories()
        tasks = await dbGetTasks()
        todayTotal = await dbGetTodayTotal()
        todayByCategory = await dbGetTodayByCategory()
      } catch (e) {
        console.warn('DB load partial failure:', e)
      }

      const active: ActiveSession | null = settings.activeSession || null

      set({
        ready: true,
        theme: settings.theme || 'void',
        backgrounds: settings.backgrounds || { void: null, pulse: null, neon: null },
        timerMode: settings.timerMode || 'stopwatch',
        countdownTarget: settings.countdownTarget || 25 * 60,
        sidebarOpen: settings.sidebarOpen !== false,
        sessions,
        categories,
        tasks,
        todayTotal,
        todayByCategory,
        // Restore interrupted session
        ...(active && active.category && active.elapsedSeconds > 0
          ? {
              currentCategory: active.category,
              timerMode: active.timerMode || settings.timerMode || 'stopwatch',
              countdownTarget: active.countdownTarget || settings.countdownTarget || 25 * 60,
              elapsedSeconds: active.elapsedSeconds,
              remainingSeconds: active.remainingSeconds || 0,
              isPaused: true,
              isFocusing: false,
              focusStartTime: null,
              currentView: 'focus' as View
            }
          : {})
      })

      // Clear checkpoint after restore so we don't double-apply
      if (active) {
        try {
          await saveSettings({ ...settings, activeSession: null })
        } catch {}
      }
    } catch (err) {
      console.error('initApp failed:', err)
      set({ ready: true, categories: fallbackCategories })
    }
  },

  theme: 'void',
  setTheme: (theme) => {
    set({ theme })
    get().persistSettings()
  },
  currentView: 'dashboard',
  setView: (view) => set({ currentView: view }),
  sidebarOpen: true,
  toggleSidebar: () => {
    set({ sidebarOpen: !get().sidebarOpen })
    get().persistSettings()
  },

  backgrounds: { void: null, pulse: null, neon: null },
  setBackground: (theme, url) => {
    set({ backgrounds: { ...get().backgrounds, [theme]: url } })
    get().persistSettings()
  },

  timerMode: 'stopwatch',
  setTimerMode: (mode) => {
    set({ timerMode: mode })
    get().persistSettings()
  },
  countdownTarget: 25 * 60,
  setCountdownTarget: (sec) => {
    set({ countdownTarget: sec })
    get().persistSettings()
  },

  isFocusing: false,
  isPaused: false,
  currentCategory: null,
  focusStartTime: null,
  elapsedSeconds: 0,
  remainingSeconds: 0,

  startFocus: (category) => {
    const { timerMode, countdownTarget } = get()
    set({
      isFocusing: true,
      isPaused: false,
      currentCategory: category,
      focusStartTime: Date.now(),
      elapsedSeconds: 0,
      remainingSeconds: timerMode === 'countdown' ? countdownTarget : 0,
      currentView: 'focus'
    })
    get().checkpointActiveSession()
  },

  pauseFocus: () => {
    set({ isFocusing: false, isPaused: true })
    get().checkpointActiveSession()
  },

  resumeFocus: () => {
    const { elapsedSeconds, timerMode, countdownTarget, remainingSeconds } = get()
    set({
      isFocusing: true,
      isPaused: false,
      focusStartTime: timerMode === 'stopwatch'
        ? Date.now() - elapsedSeconds * 1000
        : Date.now() - (countdownTarget - remainingSeconds) * 1000
    })
    get().checkpointActiveSession()
  },

  stopFocus: async () => {
    const { elapsedSeconds, currentCategory, timerMode, countdownTarget, remainingSeconds } = get()
    const duration = timerMode === 'countdown'
      ? countdownTarget - remainingSeconds
      : elapsedSeconds

    if (duration > 5 && currentCategory) {
      const session: Session = {
        id: crypto.randomUUID(),
        date: localDateString(),
        category: currentCategory,
        duration,
        createdAt: Date.now()
      }
      try {
        await dbAddSession(session)
        await get().refreshStats()
        const sessions = await dbGetSessions()
        set({ sessions })
      } catch (e) {
        console.error('Failed to save session:', e)
        set({ sessions: [session, ...get().sessions] })
      }
    }

    set({
      isFocusing: false,
      isPaused: false,
      currentCategory: null,
      focusStartTime: null,
      elapsedSeconds: 0,
      remainingSeconds: 0,
      currentView: 'dashboard'
    })

    // Clear active session checkpoint
    try {
      const base = await loadSettings().catch(() => ({} as any))
      await saveSettings({ ...base, activeSession: null })
    } catch {}
  },

  tick: () => {
    const { isFocusing, focusStartTime, timerMode, countdownTarget } = get()
    if (!isFocusing || !focusStartTime) return

    if (timerMode === 'stopwatch') {
      set({ elapsedSeconds: Math.floor((Date.now() - focusStartTime) / 1000) })
    } else {
      const elapsed = Math.floor((Date.now() - focusStartTime) / 1000)
      const remaining = Math.max(0, countdownTarget - elapsed)
      set({ remainingSeconds: remaining, elapsedSeconds: elapsed })
      if (remaining === 0) {
        try {
          const playBeep = () => {
            const ctx = new AudioContext()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.frequency.value = 880
            gain.gain.value = 0.3
            osc.start()
            setTimeout(() => { osc.stop(); ctx.close() }, 350)
          }
          playBeep()
          setTimeout(playBeep, 450)
        } catch {}
        get().stopFocus()
        return
      }
    }
    // Checkpoint every tick (debounced inside)
    get().checkpointActiveSession()
  },

  categories: fallbackCategories,
  addCategory: async (name, color) => {
    const picked =
      color ||
      COLOR_PALETTE[get().categories.length % COLOR_PALETTE.length]
    const cat = { id: crypto.randomUUID(), name, color: picked }
    try {
      await dbAddCategory(cat)
      set({ categories: await dbGetCategories() })
    } catch {
      set({ categories: [...get().categories, cat] })
    }
  },
  removeCategory: async (id) => {
    try {
      await dbRemoveCategory(id)
      set({ categories: await dbGetCategories() })
    } catch {
      set({ categories: get().categories.filter(c => c.id !== id) })
    }
  },

  sessions: [],
  todayTotal: 0,
  todayByCategory: {},
  refreshStats: async () => {
    try {
      const todayTotal = await dbGetTodayTotal()
      const todayByCategory = await dbGetTodayByCategory()
      set({ todayTotal, todayByCategory })
    } catch {}
  },

  tasks: [],
  addTask: async (text) => {
    const task = { id: crypto.randomUUID(), text, done: false }
    try {
      await dbAddTask(task)
      set({ tasks: await dbGetTasks() })
    } catch {
      set({ tasks: [...get().tasks, task] })
    }
  },
  toggleTask: async (id) => {
    const task = get().tasks.find(t => t.id === id)
    if (!task) return
    try {
      await dbToggleTask(id, !task.done)
      set({ tasks: await dbGetTasks() })
    } catch {
      set({ tasks: get().tasks.map(t => t.id === id ? { ...t, done: !t.done } : t) })
    }
  },
  removeTask: async (id) => {
    try {
      await dbRemoveTask(id)
      set({ tasks: await dbGetTasks() })
    } catch {
      set({ tasks: get().tasks.filter(t => t.id !== id) })
    }
  },
}))
