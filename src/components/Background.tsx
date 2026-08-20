import { useStore, Theme } from '../store/useStore'

const FALLBACK: Record<Theme, string> = {
  void: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(56,189,248,0.15), transparent 60%), #050508',
  pulse: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(168,85,247,0.18), transparent 60%), #050508',
  neon: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(59,130,246,0.18), transparent 60%), #050508',
}

export default function Background() {
  const { theme, backgrounds } = useStore()

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#050508]">
      {(['void', 'pulse', 'neon'] as Theme[]).map(t => {
        const src = backgrounds[t]
        const active = theme === t
        return (
          <div
            key={t}
            className="absolute inset-0 transition-opacity duration-700 ease-in-out"
            style={{ opacity: active ? 1 : 0 }}
          >
            {src ? (
              <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0" style={{ background: FALLBACK[t] }} />
            )}
          </div>
        )
      })}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
    </div>
  )
}
