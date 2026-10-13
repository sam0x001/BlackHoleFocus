import { useEffect, useState, lazy, Suspense } from 'react'
import { useStore } from './store/useStore'
import { applyThemeVariables, effectivePalette } from './lib/theme'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import FocusMode from './pages/FocusMode'
import Settings from './pages/Settings'
import Background from './components/Background'
import TitleBar from './components/TitleBar'
import CloseSessionModal from './components/CloseSessionModal'
import CommandPalette from './CommandPalette'

const Analytics = lazy(() => import('./pages/Analytics'))

function App() {
  const {
    currentView, tick, isFocusing, isPaused, currentCategory, elapsedSeconds,
    initApp, ready, theme, accentOverride
  } = useStore()
  const [error, setError] = useState<string | null>(null)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      if (!cancelled && !useStore.getState().ready) {
        setError('Startup is taking longer than expected...')
        useStore.setState({ ready: true })
      }
    }, 10000)

    initApp()
      .catch((err) => {
        console.error(err)
        if (!cancelled) {
          setError(String(err))
          useStore.setState({ ready: true })
        }
      })
      .finally(() => clearTimeout(timer))

    return () => { cancelled = true; clearTimeout(timer) }
  }, [initApp])

  useEffect(() => {
    if (!isFocusing) return
    const interval = setInterval(() => tick(), 1000)
    return () => clearInterval(interval)
  }, [isFocusing, tick])

  // Publish the active palette as CSS variables so glass/button styles follow
  // the theme (honouring a per-theme accent override).
  useEffect(() => {
    applyThemeVariables(effectivePalette(theme, accentOverride[theme]))
  }, [theme, accentOverride])

  // Tell the main process whether a session is active so closing the window
  // can warn (active) or silently move to the tray (inactive).
  const sessionActive = Boolean(currentCategory && (isFocusing || isPaused) && elapsedSeconds > 0)
  useEffect(() => {
    window.electronAPI?.setSessionActive(sessionActive)
  }, [sessionActive])

  // Main-process events: window close requested while a session runs, a final
  // checkpoint request before quitting from the tray, and tray menu pause/resume.
  useEffect(() => {
    if (!window.electronAPI) return
    const offClose = window.electronAPI.onCloseRequested(() => setCloseDialogOpen(true))
    const offCheckpoint = window.electronAPI.onCheckpointBeforeQuit(() => {
      useStore.getState().checkpointNow()
    })
    const offTrayToggle = window.electronAPI.onTrayTogglePause(() => {
      const s = useStore.getState()
      if (!s.currentCategory) return
      if (s.isFocusing) s.pauseFocus()
      else if (s.isPaused) s.resumeFocus()
    })
    return () => { offClose(); offCheckpoint(); offTrayToggle() }
  }, [])

  // Keyboard shortcuts: Space = pause/resume, Esc = close modal / collapse sidebar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      const onControl =
        !!target && (target.tagName === 'BUTTON' || target.tagName === 'A' || target.tagName === 'SELECT')

      if (e.code === 'Space' && !typing && !onControl && (isFocusing || isPaused)) {
        e.preventDefault()
        const s = useStore.getState()
        if (!s.currentCategory) return
        if (s.isFocusing) s.pauseFocus()
        else if (s.isPaused) s.resumeFocus()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useStore.getState().togglePalette()
      } else if (e.key === 'Escape') {
        if (useStore.getState().paletteOpen) useStore.getState().togglePalette()
        else if (closeDialogOpen) setCloseDialogOpen(false)
        else if (useStore.getState().sidebarOpen) useStore.getState().toggleSidebar()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFocusing, isPaused, closeDialogOpen])

  // Flush checkpoint if window is closing mid-session
  useEffect(() => {
    const onBeforeUnload = () => {
      const s = useStore.getState()
      if (s.currentCategory && (s.isFocusing || s.isPaused) && s.elapsedSeconds > 0) {
        s.checkpointActiveSession()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const handleExitAnyway = async () => {
    setCloseDialogOpen(false)
    await useStore.getState().checkpointNow()
    window.electronAPI?.confirmWindowClose()
  }

  const handleKeepInBackground = () => {
    setCloseDialogOpen(false)
    window.electronAPI?.hideToTray()
  }

  if (!ready) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#050508] gap-3">
        <p className="text-white/50 text-sm tracking-wide">Loading...</p>
        {error && <p className="text-red-400/80 text-xs max-w-md text-center px-4">{error}</p>}
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex flex-col relative overflow-hidden">
      <TitleBar />
      <Background />
      <div className="flex flex-1 min-h-0 pt-10 relative z-10">
        <Sidebar />
        <main className="flex-1 relative overflow-hidden">
          <div className="h-full relative z-20">
            {currentView === 'dashboard' && <Dashboard />}
            {currentView === 'focus' && <FocusMode />}
            {currentView === 'analytics' && (
              <Suspense fallback={<div className="p-8 text-white/40 text-sm">Loading analytics...</div>}>
                <Analytics />
              </Suspense>
            )}
            {currentView === 'settings' && <Settings />}
          </div>
        </main>
      </div>

      <CommandPalette />
      <CloseSessionModal
        isOpen={closeDialogOpen}
        onCancel={() => setCloseDialogOpen(false)}
        onExit={handleExitAnyway}
        onBackground={handleKeepInBackground}
      />
    </div>
  )
}

export default App
