import { useStore } from '../store/useStore'
import { formatDuration } from '../lib/format'

interface Props {
  isOpen: boolean
  onCancel: () => void
  onExit: () => void
  onBackground: () => void
}

export default function CloseSessionModal({ isOpen, onCancel, onExit, onBackground }: Props) {
  const { theme, currentCategory, elapsedSeconds } = useStore()

  if (!isOpen) return null

  const accentFillStyle = {
    void: '#38bdf8',
    pulse: '#a855f7',
    neon: '#3b82f6',
  }[theme]

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel()
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="close-session-modal-title"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative rounded-2xl border border-white/10 shadow-2xl w-full max-w-lg overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(32px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span
              className="w-2.5 h-2.5 rounded-full animate-pulse shrink-0"
              style={{ background: accentFillStyle, boxShadow: `0 0 12px ${accentFillStyle}` }}
            />
            <h2 id="close-session-modal-title" className="text-lg font-semibold tracking-wide">
              Active focus session
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="text-white/40 hover:text-white/80 text-xl leading-none p-1 rounded-lg hover:bg-white/5 transition-colors no-drag"
            aria-label="Keep the app open and do nothing"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          <div className="text-sm text-white/75 leading-relaxed space-y-2">
            <p>
              You have an active <span className="text-white/95 font-medium">{currentCategory || 'focus'}</span>{' '}
              session running
              {elapsedSeconds > 0 && (
                <> (<span className="text-white/95 tabular-nums">{formatDuration(elapsedSeconds)}</span> elapsed)</>
              )}.
            </p>
            <p className="text-white/50 text-xs">
              Do you want to exit anyway, or keep BlackHole Focus running in the background?
            </p>
          </div>

          {/* Choice cards */}
          <div className="space-y-2.5">
            <button
              onClick={onBackground}
              className="w-full text-left rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-3.5 transition-all group"
            >
              <p className="text-sm font-medium text-white/90 group-hover:text-white">
                Keep running in the background
              </p>
              <p className="text-xs text-white/45 mt-1 leading-relaxed">
                The app moves to the system tray and the session keeps running.
              </p>
            </button>

            <button
              onClick={onExit}
              className="w-full text-left rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-3.5 transition-all group"
            >
              <p className="text-sm font-medium text-red-300/80 group-hover:text-red-300">
                Exit anyway
              </p>
              <p className="text-xs text-white/45 mt-1 leading-relaxed">
                The session is saved (paused) and restored automatically the next time you open the app.
              </p>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end pt-2 border-t border-white/10">
            <button onClick={onCancel} className="glass-button text-sm px-5 py-2 hover:bg-white/10">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
