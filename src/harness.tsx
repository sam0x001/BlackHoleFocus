// TEMPORARY visual harness (not part of the app). Mounts the real Background,
// Sidebar and FocusMode with a fake active session so the layout can be
// screenshotted outside Electron. `?theme=pulse` selects a non-Void theme.
// Delete when done.
import ReactDOM from 'react-dom/client'
import { useStore, type Theme } from './store/useStore'
import Sidebar from './components/Sidebar'
import FocusMode from './pages/FocusMode'
import Background from './components/Background'
import TitleBar from './components/TitleBar'
import './index.css'

const params = new URLSearchParams(window.location.search)
const theme = (params.get('theme') as Theme) || 'void'
const hasSession = params.get('session') !== '0'
const customBg = params.get('bg') === '1'
const demoImage =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#12101c"/><circle cx="4" cy="4" r="2.5" fill="#7c3aed"/></svg>'
  )

useStore.setState({
  ready: true,
  theme,
  backgrounds: { void: null, pulse: customBg ? demoImage : null, neon: customBg ? demoImage : null },
  currentView: 'focus',
  currentCategory: hasSession ? 'Deep Work' : null,
  isFocusing: hasSession,
  isPaused: false,
  elapsedSeconds: 1234,
  remainingSeconds: 25 * 60 - 1234,
  timerMode: 'countdown',
  countdownTarget: 25 * 60,
  sidebarOpen: true,
  categories: [
    { id: 'a', name: 'Deep Work', color: '#9fd4ff' },
    { id: 'b', name: 'Reading', color: '#b8b0e0' },
  ],
  tasks: [
    { id: '1', text: 'Draft the threat model', done: false },
    { id: '2', text: 'Review pull request #42', done: true },
    { id: '3', text: 'Write the weekly report', done: false },
  ],
})

function Harness() {
  return (
    <div className="h-screen w-screen flex flex-col relative overflow-hidden">
      <TitleBar />
      <Background />
      <div className="flex flex-1 min-h-0 pt-10 relative z-10">
        <Sidebar />
        <main className="flex-1 relative overflow-hidden">
          <div className="h-full relative z-20">
            <FocusMode />
          </div>
        </main>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Harness />)