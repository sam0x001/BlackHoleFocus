import { useStore } from '../store/useStore'

export default function Background() {
  const { backgrounds, theme } = useStore()
  const currentBg = backgrounds[theme]

  const themeOverlay = {
    void: 'bg-[radial-gradient(ellipse_at_center,_rgba(56,189,248,0.05)_0%,_transparent_65%)]',
    pulse: 'bg-[radial-gradient(ellipse_at_30%_40%,_rgba(168,85,247,0.08)_0%,_transparent_55%)]',
    neon: 'bg-[radial-gradient(ellipse_at_60%_30%,_rgba(59,130,246,0.07)_0%,_transparent_55%)]',
  }[theme]

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      {/* Base dark */}
      <div className="absolute inset-0 bg-[#050508]" />

      {/* Per-theme background images with smooth crossfade */}
      {(['void', 'pulse', 'neon'] as const).map(t => (
        <div
          key={t}
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700 ease-in-out"
          style={{
            backgroundImage: backgrounds[t] ? `url(${backgrounds[t]})` : 'none',
            opacity: theme === t && backgrounds[t] ? 1 : 0,
          }}
        />
      ))}

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/45 transition-opacity duration-700" />

      {/* Theme color accent */}
      <div className={`absolute inset-0 transition-opacity duration-700 ${themeOverlay}`} />
    </div>
  )
}
