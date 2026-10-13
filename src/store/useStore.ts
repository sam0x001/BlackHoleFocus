import { create } from 'zustand'
import { localDateString } from '../lib/date'
import { formatClock } from '../lib/format'
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
  dbGetRestDays,
  dbAddRestDay,
  dbRemoveRestDay,
  dbDeleteSession,
  dbUpdateSession,
  getSessionJournal,
  writeSessionJournal,
  clearSessionJournal,
  loadSettings,
  saveSettings
} from '../db/database'

export type Theme = 'void' | 'pulse' | 'neon'
export type View = 'dashboard' | 'focus' | 'analytics' | 'settings'
export type TimerMode = 'stopwatch' | 'countdown' | 'pomodoro'
export type Phase = 'focus' | 'break'

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
  /** Pomodoro cycle phase + counter. */
  phase?: Phase
  cycleCount?: number
}

export interface PomodoroSettings {
  focusMin: number
  breakMin: number
  longBreakMin: number
  longEvery: number
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

  // Rest days ("Break Time") — excluded from stats/reports
  restDays: string[]
  addRestDay: (date: string) => Promise<void>
  removeRestDay: (date: string) => Promise<void>
  toggleRestDay: (date: string) => Promise<void>

  // Session deletion (from Analytics history)
  deleteSession: (id: string) => Promise<void>

  // Note attached to the currently running session (saved with it)
  sessionNote: string
  setSessionNote: (note: string) => void

  // Dashboard daily goal (minutes) + live wallpaper (vid/blackhole.mp4)
  dailyGoalMinutes: number
  setDailyGoalMinutes: (min: number) => void
  liveWallpaper: boolean
  setLiveWallpaper: (on: boolean) => void

  // Pomodoro cycle settings
  pomodoro: PomodoroSettings
  setPomodoro: (patch: Partial<PomodoroSettings>) => void
  phase: Phase
  cycleCount: number
  skipBreak: () => void

  // Session-end sound + notification toggle
  sessionAlerts: boolean
  setSessionAlerts: (on: boolean) => void

  // Per-theme accent colour override (null = use theme default)
  accentOverride: Record<Theme, string | null>
  setAccentOverride: (theme: Theme, hex: string | null) => void

  // Crash-recovery notice (shown as a Dashboard banner)
  recoveryNotice: string | null
  clearRecoveryNotice: () => void

  // Command palette (Ctrl+K)
  paletteOpen: boolean
  togglePalette: () => void

  // Session editing (Analytics history)
  updateSession: (id: string, patch: Partial<Session>) => Promise<void>

  /** Save the running focus block as a session (used by stop + Pomodoro cycles). */
  commitSession: (duration: number) => Promise<void>
}

const fallbackCategories: Category[] = []

const COLOR_PALETTE = [
  '#3b82f6', '#a855f7', '#22c55e', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#8b5cf6',
]

let persistTimer: ReturnType<typeof setTimeout> | null = null

/** Everything persisted to settings.json — one snapshot, one writer.
 *  The old code had two independent debounced writers (persistSettings &
 *  checkpointActiveSession) that each read-modify-wrote settings.json and
 *  could clobber each other's fields. */
function settingsSnapshot(s: AppState) {
  const activeSession: ActiveSession | null =
    s.currentCategory && (s.isFocusing || s.isPaused) && s.elapsedSeconds > 0
      ? {
          category: s.currentCategory,
          timerMode: s.timerMode,
          countdownTarget: s.countdownTarget,
          focusStartTime: s.focusStartTime || Date.now(),
          elapsedSeconds: s.elapsedSeconds,
          remainingSeconds: s.remainingSeconds,
          isPaused: s.isPaused,
          isFocusing: s.isFocusing,
          phase: s.phase,
          cycleCount: s.cycleCount
        }
      : null
  return {
    theme: s.theme,
    backgrounds: s.backgrounds,
    timerMode: s.timerMode,
    countdownTarget: s.countdownTarget,
    sidebarOpen: s.sidebarOpen,
    dailyGoalMinutes: s.dailyGoalMinutes,
    liveWallpaper: s.liveWallpaper,
    pomodoro: s.pomodoro,
    sessionAlerts: s.sessionAlerts,
    accentOverride: s.accentOverride,
    activeSession
  }
}

async function writeSettings() {
  try {
    const base = await loadSettings().catch(() => ({} as any))
    await saveSettings({ ...base, ...settingsSnapshot(useStore.getState()) })
  } catch (e) {
    console.warn('Could not save settings:', e)
  }
}

function schedulePersist(): Promise<void> {
  if (persistTimer) clearTimeout(persistTimer)
  return new Promise((resolve) => {
    persistTimer = setTimeout(async () => {
      persistTimer = null
      await writeSettings()
      resolve()
    }, 1500)
  })
}

/** Mirror the live session into the system-tray tooltip. */
function syncTray() {
  try {
    const s = useStore.getState()
    const active = Boolean(s.currentCategory && (s.isFocusing || s.isPaused) && s.elapsedSeconds > 0)
    const clock = formatClock(s.timerMode === 'countdown' || s.timerMode === 'pomodoro' ? s.remainingSeconds : s.elapsedSeconds)
    window.electronAPI?.updateTray({
      active,
      paused: s.isPaused,
      label: active
        ? `BlackHole Focus — ${clock}${s.currentCategory ? ` · ${s.currentCategory}` : ''}${
            s.timerMode === 'pomodoro' && s.phase === 'break' ? ' · break' : ''
          }`
        : ''
    })
  } catch {}
}

export const useStore = create<AppState>()((set, get) => ({
  ready: false,

  persistSettings: () => schedulePersist(),

  // Debounced checkpoint — both entry points funnel into the single writer
  // above so settings and the active-session snapshot never race.
  checkpointActiveSession: () => {
    schedulePersist()
  },

  // Immediate (non-debounced) checkpoint — used right before the app quits
  // so an interrupted session is restored paused on the next launch.
  checkpointNow: async () => {
    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    await writeSettings()
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
      let restDays: string[] = []

      try {
        sessions = await dbGetSessions()
        categories = await dbGetCategories()
        tasks = await dbGetTasks()
        todayTotal = await dbGetTodayTotal()
        todayByCategory = await dbGetTodayByCategory()
      } catch (e) {
        console.warn('DB load partial failure:', e)
      }

      try {
        restDays = await dbGetRestDays()
      } catch {}

      // Prefer the fresher of the settings checkpoint vs the crash journal
      let journal: any = null
      try { journal = await getSessionJournal() } catch {}
      const candidates = [settings.activeSession, journal].filter(Boolean)
      const active: ActiveSession | null =
        candidates.sort((a: any, b: any) => (b?.elapsedSeconds || 0) - (a?.elapsedSeconds || 0))[0] || null
      const recoveredFromCrash = Boolean(journal && journal.elapsedSeconds >= (settings.activeSession?.elapsedSeconds || 0) && journal.elapsedSeconds > 0)

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
        restDays,
        dailyGoalMinutes: Number(settings.dailyGoalMinutes) > 0 ? Number(settings.dailyGoalMinutes) : 120,
        liveWallpaper: settings.liveWallpaper !== false,
        pomodoro: {
          focusMin: Number(settings.pomodoro?.focusMin) > 0 ? Number(settings.pomodoro.focusMin) : 25,
          breakMin: Number(settings.pomodoro?.breakMin) > 0 ? Number(settings.pomodoro.breakMin) : 5,
          longBreakMin: Number(settings.pomodoro?.longBreakMin) > 0 ? Number(settings.pomodoro.longBreakMin) : 15,
          longEvery: Number(settings.pomodoro?.longEvery) > 0 ? Number(settings.pomodoro.longEvery) : 4
        },
        sessionAlerts: settings.sessionAlerts !== false,
        accentOverride: {
          void: settings.accentOverride?.void || null,
          pulse: settings.accentOverride?.pulse || null,
          neon: settings.accentOverride?.neon || null
        },
        todayTotal,
        todayByCategory,
        // Restore interrupted session (paused), from the newest source
        ...(active && active.category && active.elapsedSeconds > 0
          ? {
              currentCategory: active.category,
              timerMode: active.timerMode || settings.timerMode || 'stopwatch',
              countdownTarget: active.countdownTarget || settings.countdownTarget || 25 * 60,
              elapsedSeconds: active.elapsedSeconds,
              remainingSeconds: active.remainingSeconds || 0,
              phase: active.phase || 'focus',
              cycleCount: active.cycleCount || 0,
              isPaused: true,
              isFocusing: false,
              focusStartTime: null,
              currentView: 'focus' as View,
              recoveryNotice: recoveredFromCrash
                ? `Recovered an interrupted session — ${Math.floor(active.elapsedSeconds / 60)}m kept, paused.`
                : null
            }
          : {})
      })

      // Clear checkpoint + journal after restore so we don't double-apply
      if (active) {
        try {
          await saveSettings({ ...settings, activeSession: null })
        } catch {}
      }
      try { clearSessionJournal() } catch {}
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
    const { timerMode, countdownTarget, pomodoro } = get()
    const target = timerMode === 'pomodoro' ? pomodoro.focusMin * 60 : countdownTarget
    set({
      isFocusing: true,
      isPaused: false,
      currentCategory: category,
      focusStartTime: Date.now(),
      elapsedSeconds: 0,
      remainingSeconds: timerMode === 'stopwatch' ? 0 : target,
      countdownTarget: target,
      phase: 'focus',
      cycleCount: 0,
      sessionNote: '',
      currentView: 'focus'
    })
    get().checkpointActiveSession()
    syncTray()
  },

  pauseFocus: () => {
    set({ isFocusing: false, isPaused: true })
    get().checkpointActiveSession()
    syncTray()
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
    syncTray()
  },

  commitSession: async (duration) => {
    const { currentCategory } = get()
    if (duration <= 5 || !currentCategory) return
    const note = get().sessionNote.trim()
    const session: Session = {
      id: crypto.randomUUID(),
      date: localDateString(),
      category: currentCategory,
      duration,
      note: note || undefined,
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
  },

  stopFocus: async () => {
    const { timerMode, countdownTarget, remainingSeconds, elapsedSeconds, phase } = get()
    // Break time is never recorded; focus blocks are.
    if (!(timerMode === 'pomodoro' && phase === 'break')) {
      const duration = timerMode === 'stopwatch' ? elapsedSeconds : countdownTarget - remainingSeconds
      await get().commitSession(duration)
    }

    set({
      isFocusing: false,
      isPaused: false,
      currentCategory: null,
      focusStartTime: null,
      elapsedSeconds: 0,
      remainingSeconds: 0,
      phase: 'focus',
      cycleCount: 0,
      sessionNote: '',
      currentView: 'dashboard'
    })
    syncTray()
    try { clearSessionJournal() } catch {}

    // Clear active session checkpoint
    try {
      const base = await loadSettings().catch(() => ({} as any))
      await saveSettings({ ...base, activeSession: null })
    } catch {}
  },

  skipBreak: () => {
    if (get().timerMode !== 'pomodoro' || get().phase !== 'break') return
    const focusSec = get().pomodoro.focusMin * 60
    set({
      phase: 'focus',
      countdownTarget: focusSec,
      remainingSeconds: focusSec,
      elapsedSeconds: 0,
      focusStartTime: Date.now(),
      isFocusing: true,
      isPaused: false
    })
    get().checkpointActiveSession()
    syncTray()
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
        const s = get()
        if (timerMode === 'pomodoro' && s.phase === 'focus') {
          // Focus block done → record it, then roll into the break countdown
          get().commitSession(countdownTarget)
          const cycle = s.cycleCount + 1
          const p = s.pomodoro
          const isLong = cycle % Math.max(1, p.longEvery) === 0
          const breakSec = (isLong ? p.longBreakMin : p.breakMin) * 60
          if (s.sessionAlerts) {
            // "Bip-Bip" through the main process (audible in the tray too)
            window.electronAPI?.notifySessionEnded({
              category: s.currentCategory || undefined,
              seconds: countdownTarget,
              title: isLong ? 'Long break time' : 'Break time',
              body: `Cycle ${cycle} done — ${Math.round(breakSec / 60)}m break`
            })
          }
          set({
            cycleCount: cycle,
            phase: 'break',
            countdownTarget: breakSec,
            remainingSeconds: breakSec,
            elapsedSeconds: 0,
            focusStartTime: Date.now()
          })
          get().checkpointActiveSession()
          syncTray()
          return
        }
        if (timerMode === 'pomodoro' && s.phase === 'break') {
          // Break over → alert + straight into the next focus block
          const focusSec = s.pomodoro.focusMin * 60
          if (s.sessionAlerts) {
            window.electronAPI?.notifySessionEnded({
              seconds: 0,
              title: 'Break finished',
              body: 'Back to focus — starting the next cycle',
              always: true
            })
          }
          set({
            phase: 'focus',
            countdownTarget: focusSec,
            remainingSeconds: focusSec,
            elapsedSeconds: 0,
            focusStartTime: Date.now()
          })
          get().checkpointActiveSession()
          syncTray()
          return
        }
        // Plain countdown finished → alert + save + stop
        if (s.sessionAlerts) {
          window.electronAPI?.notifySessionEnded({
            category: s.currentCategory || undefined,
            seconds: elapsed
          })
        }
        get().stopFocus()
        return
      }
    }
    // Crash-recovery journal (throttled in main), tray mirror, checkpoint
    try {
      writeSessionJournal({
        category: get().currentCategory,
        timerMode: get().timerMode,
        countdownTarget: get().countdownTarget,
        phase: get().phase,
        cycleCount: get().cycleCount,
        focusStartTime: get().focusStartTime,
        elapsedSeconds: get().elapsedSeconds,
        remainingSeconds: get().remainingSeconds,
        isPaused: get().isPaused,
        isFocusing: get().isFocusing
      })
    } catch {}
    syncTray()
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

  // ---------- Rest days ("Break Time") ----------
  restDays: [],
  addRestDay: async (date) => {
    try {
      set({ restDays: await dbAddRestDay(date) })
    } catch {
      if (!get().restDays.includes(date)) {
        set({ restDays: [...get().restDays, date].sort() })
      }
    }
  },
  removeRestDay: async (date) => {
    try {
      set({ restDays: await dbRemoveRestDay(date) })
    } catch {
      set({ restDays: get().restDays.filter(d => d !== date) })
    }
  },
  toggleRestDay: async (date) => {
    if (get().restDays.includes(date)) {
      await get().removeRestDay(date)
    } else {
      await get().addRestDay(date)
    }
  },

  // ---------- Session deletion ----------
  deleteSession: async (id) => {
    const prev = get().sessions
    set({ sessions: prev.filter(s => s.id !== id) })
    try {
      await dbDeleteSession(id)
      await get().refreshStats()
    } catch (e) {
      console.error('Failed to delete session:', e)
      set({ sessions: prev })
    }
  },

  // ---------- Session note ----------
  sessionNote: '',
  setSessionNote: (note) => set({ sessionNote: note }),

  // ---------- Daily goal & live wallpaper ----------
  dailyGoalMinutes: 120,
  setDailyGoalMinutes: (min) => {
    set({ dailyGoalMinutes: Math.max(0, Math.round(min)) })
    get().persistSettings()
  },
  liveWallpaper: true,
  setLiveWallpaper: (on) => {
    set({ liveWallpaper: on })
    get().persistSettings()
  },

  // ---------- Pomodoro cycles ----------
  pomodoro: { focusMin: 25, breakMin: 5, longBreakMin: 15, longEvery: 4 },
  setPomodoro: (patch) => {
    const next = { ...get().pomodoro, ...patch }
    next.focusMin = Math.min(120, Math.max(1, Math.round(next.focusMin) || 25))
    next.breakMin = Math.min(60, Math.max(1, Math.round(next.breakMin) || 5))
    next.longBreakMin = Math.min(120, Math.max(1, Math.round(next.longBreakMin) || 15))
    next.longEvery = Math.min(12, Math.max(1, Math.round(next.longEvery) || 4))
    set({ pomodoro: next })
    get().persistSettings()
  },
  phase: 'focus',
  cycleCount: 0,

  // ---------- Session-end alerts (sound + notification) ----------
  sessionAlerts: true,
  setSessionAlerts: (on) => {
    set({ sessionAlerts: on })
    get().persistSettings()
  },

  // ---------- Per-theme accent override ----------
  accentOverride: { void: null, pulse: null, neon: null },
  setAccentOverride: (theme, hex) => {
    set({ accentOverride: { ...get().accentOverride, [theme]: hex } })
    get().persistSettings()
  },

  // ---------- Recovery notice / command palette ----------
  recoveryNotice: null,
  clearRecoveryNotice: () => set({ recoveryNotice: null }),
  paletteOpen: false,
  togglePalette: () => set({ paletteOpen: !get().paletteOpen }),

  // ---------- Session editing ----------
  updateSession: async (id, patch) => {
    const prev = get().sessions
    const clean = { ...patch, id }
    set({ sessions: prev.map(s => (s.id === id ? { ...s, ...clean } : s)) })
    try {
      await dbUpdateSession(id, patch)
      await get().refreshStats()
      set({ sessions: await dbGetSessions() })
    } catch (e) {
      console.error('Failed to update session:', e)
      set({ sessions: prev })
    }
  }
}))
