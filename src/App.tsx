import { useEffect, useState, lazy, Suspense } from 'react'
import { useStore } from './store/useStore'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import FocusMode from './pages/FocusMode'
import Settings from './pages/Settings'
import Background from './components/Background'
import TitleBar from './components/TitleBar'
import CloseSessionModal from './components/CloseSessionModal'

const Analytics = lazy(() => import('./pages/Analytics'))

function App() {
  const {
    currentView, tick, isFocusing, isPaused, currentCategory, elapsedSeconds,
    initApp, ready, sidebarOpen, toggleSidebar
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

  // Tell the main process whether a session is active so closing the window
  // can warn (active) or silently move to the tray (inactive).
  const sessionActive = Boolean(currentCategory && (isFocusing || isPaused) && elapsedSeconds > 0)
  useEffect(() => {
    window.electronAPI?.setSessionActive(sessionActive)
  }, [sessionActive])

  // Main-process events: window close requested while a session runs, and a
  // final checkpoint request before quitting from the tray.
  useEffect(() => {
    if (!window.electronAPI) return
    const offClose = window.electronAPI.onCloseRequested(() => setCloseDialogOpen(true))
    const offCheckpoint = window.electronAPI.onCheckpointBeforeQuit(() => {
      useStore.getState().checkpointNow()
    })
    return () => { offClose(); offCheckpoint() }
  }, [])

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
            {!sidebarOpen && (
              <button
                onClick={toggleSidebar}
                className="bh-menu-reveal absolute top-3 left-3 z-40 glass-button text-xs px-3 py-1.5 no-drag"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              >
                <span className="inline-flex flex-col gap-[3px] mr-2 -translate-y-px">
                  <span className="block w-3 h-px bg-current" />
                  <span className="block w-2 h-px bg-current" />
                </span>
                Menu
              </button>
            )}
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
