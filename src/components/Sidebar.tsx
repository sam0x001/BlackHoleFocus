import { useStore, View, Theme } from '../store/useStore'
import { usePalette } from '../lib/theme'
import bhLogo from '../assets/bh-logo.png'

const navItems: { id: View; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'focus', label: 'Focus Mode' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'settings', label: 'Settings' },
]

const themeLabels: Record<Theme, string> = {
  void: 'Void',
  pulse: 'Pulse',
  neon: 'Neon',
}

export default function Sidebar() {
  const { currentView, setView, theme, setTheme, sidebarOpen, toggleSidebar } = useStore()
  const palette = usePalette()

  return (
    <aside
      className={`sidebar-rail shrink-0 flex flex-col glass border border-white/10 rounded-2xl z-20 relative overflow-hidden shadow-[0_12px_36px_-12px_rgba(0,0,0,0.7)] my-2 ml-2 mr-2 ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}
      aria-hidden={!sidebarOpen}
    >
      <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between gap-2 min-w-[13rem]">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <img
            src={bhLogo}
            alt=""
            draggable={false}
            className="w-7 h-7 shrink-0 select-none"
            style={{
              filter: `drop-shadow(0 0 6px ${palette.logoGlow}) drop-shadow(0 0 1px rgba(255,255,255,0.45))`,
            }}
          />
          <div className="min-w-0 overflow-hidden">
            <h1 className="font-display font-semibold text-[12px] tracking-[0.08em] truncate">BLACKHOLE</h1>
            <p className="text-[9px] text-white/35 tracking-[0.22em] mt-0.5 truncate">FOCUS</p>
          </div>
        </div>
        <button
          onClick={toggleSidebar}
          className="no-drag shrink-0 text-white/30 hover:text-white/70 p-1 rounded-lg hover:bg-white/5 flex items-center justify-center"
          title="Hide menu" aria-label="Hide menu"
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 3.5 5 8l4.5 4.5" /></svg>
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 min-w-[13rem] overflow-y-auto">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-300 ease-in-out no-drag
              ${currentView === item.id
                ? 'bh-nav-active border'
                : 'text-white/55 hover:bg-white/5 hover:text-white/90'
              }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-white/10 min-w-[13rem]">
        <p className="text-[10px] text-white/30 mb-2 px-1 tracking-wide">THEME</p>
        <div className="flex gap-1.5">
          {(['void', 'pulse', 'neon'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`flex-1 h-8 rounded-lg text-[10px] font-medium tracking-wide transition-all duration-300 ease-in-out no-drag
                ${theme === t
                  ? 'bg-white/15 text-white border border-white/20'
                  : 'bg-white/5 text-white/40 hover:bg-white/10'
                }`}
            >
              {themeLabels[t]}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
