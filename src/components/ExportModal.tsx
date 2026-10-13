import { useState } from 'react'
import { useStore } from '../store/useStore'

type ExportMode = 'summary' | 'detailed'

interface Props {
  isOpen: boolean
  onClose: () => void
  onExport: (mode: ExportMode) => void
}

export default function ExportModal({ isOpen, onClose, onExport }: Props) {
  const { theme } = useStore()
  const [selectedMode, setSelectedMode] = useState<ExportMode>('summary')

  if (!isOpen) return null

  // Pre-defined theme class strings (avoids broken dynamic Tailwind classes)
  const ringClasses = {
    void: 'ring-sky-400/25',
    pulse: 'ring-purple-400/25',
    neon: 'ring-blue-400/25',
  }[theme]

  const accentBg = {
    void: 'bg-sky-400/15',
    pulse: 'bg-purple-400/15',
    neon: 'bg-blue-400/15',
  }[theme]

  const accentFill = {
    void: 'bg-sky-400',
    pulse: 'bg-purple-400',
    neon: 'bg-blue-400',
  }[theme]

  const accentFillStyle = {
    void: '#38bdf8',
    pulse: '#a855f7',
    neon: '#3b82f6',
  }[theme]

  const modes: { id: ExportMode; title: string; desc: string; example: string }[] = [
    {
      id: 'summary',
      title: 'Daily Summary',
      desc: 'All sessions for each day are aggregated into a single row. Categories with the same name are combined (total time is summed). The workbook contains one worksheet per month; rest days appear as zero-length "Break Time" rows excluded from stats. Best for high-level reports and quick time tracking overviews.',
      example: `Date       | Details                                       | Duration (secs) | Duration       | Notes
-----------+-----------------------------------------------+-----------------+----------------+--------
2026-08-19 | OWASP review: 2h | Hunt: 1h | Challenge: 54m  | 10480           | 2h-54m-40s     |
2026-08-18 | Code review: 1h-30m | Bug fix: 45m            | 6300            | 2h-15m         |`
    },
    {
      id: 'detailed',
      title: 'Detailed Sessions',
      desc: 'One row per session. Each focus session appears separately, ordered chronologically. Empty rows separate different dates for readability. The workbook contains one worksheet per month; rest days appear as "Break Time" rows excluded from stats.',
      example: `Date       | Category       | Duration (seconds) | Duration | Note
-----------+----------------+--------------------+----------+----------------
2026-08-19 | OWASP review   | 3600               | 1h       | Deep dive
2026-08-19 | Hunt           | 3600               | 1h       |
2026-08-19 | Challenge      | 3280               | 54m-40s  |
           |                |                    |          |  ← Empty row
2026-08-18 | Code review    | 5400               | 1h-30m   |`
    },
  ]

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative rounded-2xl border border-white/10 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(32px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 id="export-modal-title" className="text-lg font-semibold tracking-wide">Export Excel Report</h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 text-xl leading-none p-1 rounded-lg hover:bg-white/5 transition-colors no-drag"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          <p className="text-white/60 text-sm leading-relaxed">
            Choose how you'd like your focus data exported. Each mode structures the data differently for different use cases.
          </p>

          {/* Mode Options */}
          <div className="space-y-3" role="radiogroup" aria-label="Export mode">
            {modes.map((mode) => (
              <label
                key={mode.id}
                className={`flex cursor-pointer group rounded-xl transition-all duration-200
                  ${selectedMode === mode.id
                    ? `ring-2 ${ringClasses} ${accentBg}`
                    : 'hover:bg-white/5'}`}
              >
                <input
                  type="radio"
                  name="exportMode"
                  value={mode.id}
                  checked={selectedMode === mode.id}
                  onChange={() => setSelectedMode(mode.id)}
                  className="sr-only"
                />
                <div className="p-4 relative">
                  <div className="flex items-start gap-4">
                    {/* Radio circle */}
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors
                        ${selectedMode === mode.id
                          ? `${accentFill} border-transparent`
                          : 'border-white/20 hover:border-white/30'}`}
                    >
                      {selectedMode === mode.id && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-white/90 group-hover:text-white">{mode.title}</h3>
                        {selectedMode === mode.id && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full text-white font-medium"
                            style={{ background: `${accentFillStyle}cc` }}
                          >
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="text-white/50 text-sm leading-relaxed">{mode.desc}</p>
                    </div>
                  </div>

                  {/* Example code block */}
                  <div className="mt-3 rounded-lg bg-black/40 border border-white/5 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border-b border-white/5 text-[10px] text-white/40">
                      <span className="flex gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                      </span>
                      <span className="ml-2 font-mono">example.xlsx</span>
                    </div>
                    <pre className="p-3 overflow-x-auto text-[11px] font-mono text-white/70 leading-relaxed whitespace-pre"><code>{mode.example}</code></pre>
                  </div>
                </div>
              </label>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
            <button
              onClick={onClose}
              className="glass-button text-sm px-5 py-2 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onExport(selectedMode)
                onClose()
              }}
              className="px-5 py-2 rounded-xl text-sm font-medium text-white transition-all duration-200 no-drag hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#050508]"
              style={{
                background: accentFillStyle,
                // @ts-ignore
                '--tw-ring-color': accentFillStyle,
              }}
            >
              Export {selectedMode === 'summary' ? 'Summary' : 'Detailed'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
