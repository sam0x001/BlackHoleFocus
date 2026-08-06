import { useEffect, useState } from 'react'
import { useStore } from './store/useStore'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import FocusMode from './pages/FocusMode'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import Background from './components/Background'
import TitleBar from './components/TitleBar'

function App() {
  const { currentView, tick, isFocusing, initApp, ready, sidebarOpen, toggleSidebar } = useStore()
  const [error, setError] = useState<string | null>(null)

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
          {!sidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="absolute top-3 left-4 z-30 glass-button text-xs px-3 py-1.5 no-drag"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              Menu
            </button>
          )}
          {currentView === 'dashboard' && <Dashboard />}
          {currentView === 'focus' && <FocusMode />}
          {currentView === 'analytics' && <Analytics />}
          {currentView === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  )
}

export default App
