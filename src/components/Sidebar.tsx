import { useStore, View, Theme } from '../store/useStore'

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

  const activeStyle = {
    void: 'bg-sky-400/15 text-sky-200 border-sky-400/25',
    pulse: 'bg-purple-400/15 text-purple-200 border-purple-400/25',
    neon: 'bg-blue-400/15 text-blue-200 border-blue-400/25',
  }[theme]

  if (!sidebarOpen) return null

  return (
    <aside className="h-full w-52 shrink-0 flex flex-col glass border-r border-white/10 z-20 relative overflow-hidden">
      <div className="p-5 border-b border-white/10 flex items-center justify-between min-w-[208px]">
        <div>
          <h1 className="font-display font-semibold text-sm tracking-wider">BLACKHOLE</h1>
          <p className="text-[10px] text-white/35 tracking-[0.2em] mt-0.5">FOCUS</p>
        </div>
        <button
          onClick={toggleSidebar}
          className="no-drag text-white/30 hover:text-white/70 text-xs px-2 py-1 rounded-lg hover:bg-white/5"
        >
          Hide
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 min-w-[208px] overflow-y-auto">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-300 ease-in-out no-drag
              ${currentView === item.id
                ? `${activeStyle} border`
                : 'text-white/55 hover:bg-white/5 hover:text-white/90'
              }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-white/10 min-w-[208px]">
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
