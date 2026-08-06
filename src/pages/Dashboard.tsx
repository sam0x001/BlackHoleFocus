import { useState } from 'react'
import { useStore } from '../store/useStore'

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function Dashboard() {
  const {
    theme,
    categories,
    todayTotal,
    todayByCategory,
    startFocus,
    sessions,
    timerMode,
    setTimerMode,
    countdownTarget,
    setCountdownTarget
  } = useStore()

  const [customMinutes, setCustomMinutes] = useState(String(Math.floor(countdownTarget / 60)))

  const totalAll = Object.values(todayByCategory).reduce((a, b) => a + b, 0) || 1

  const todayLabel = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  const presetTimes = [
    { label: '15m', sec: 15 * 60 },
    { label: '25m', sec: 25 * 60 },
    { label: '45m', sec: 45 * 60 },
    { label: '60m', sec: 60 * 60 },
  ]

  const applyCustomMinutes = () => {
    const mins = parseInt(customMinutes, 10)
    if (!isNaN(mins) && mins > 0 && mins <= 600) {
      setCountdownTarget(mins * 60)
    }
  }

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col items-center justify-center relative px-8">
        <div className="absolute top-8 left-8">
          <p className="text-white/40 text-sm mb-1">Today</p>
          <h2 className="text-3xl font-display font-bold tracking-tight">{todayLabel}</h2>
        </div>

        <div className="text-center">
          <p className="text-white/45 text-sm mb-2 tracking-wide">Focused today</p>
          <p className="text-5xl font-display font-semibold tracking-tight">
            {formatDuration(todayTotal)}
          </p>
        </div>
      </div>

      <div className="w-[380px] p-6 flex flex-col gap-4 overflow-y-auto">
        <div className="glass-strong rounded-2xl p-5">
          <h3 className="text-sm text-white/50 mb-3 tracking-wide">Timer Mode</h3>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setTimerMode('stopwatch')}
              className={`flex-1 py-2 rounded-xl text-sm transition-all ${
                timerMode === 'stopwatch'
                  ? 'bg-white/15 text-white border border-white/20'
                  : 'bg-white/5 text-white/45 hover:bg-white/10'
              }`}
            >
              Stopwatch
            </button>
            <button
              onClick={() => setTimerMode('countdown')}
              className={`flex-1 py-2 rounded-xl text-sm transition-all ${
                timerMode === 'countdown'
                  ? 'bg-white/15 text-white border border-white/20'
                  : 'bg-white/5 text-white/45 hover:bg-white/10'
              }`}
            >
              Countdown
            </button>
          </div>

          {timerMode === 'countdown' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {presetTimes.map(p => (
                  <button
                    key={p.sec}
                    onClick={() => {
                      setCountdownTarget(p.sec)
                      setCustomMinutes(String(p.sec / 60))
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs transition-all ${
                      countdownTarget === p.sec
                        ? 'bg-white/15 text-white border border-white/20'
                        : 'bg-white/5 text-white/40 hover:bg-white/10'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={customMinutes}
                  onChange={e => setCustomMinutes(e.target.value)}
                  onBlur={applyCustomMinutes}
                  onKeyDown={e => e.key === 'Enter' && applyCustomMinutes()}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-white/25 text-center"
                  placeholder="Minutes"
                />
                <span className="text-xs text-white/40 shrink-0">min</span>
                <button onClick={applyCustomMinutes} className="glass-button text-xs py-2 px-3">
                  Set
                </button>
              </div>
              <p className="text-[11px] text-white/30 text-center">
                Current: {Math.floor(countdownTarget / 60)}m
              </p>
            </div>
          )}
        </div>

        <div className="glass-strong rounded-2xl p-5">
          <h3 className="text-sm text-white/50 mb-3 tracking-wide">Start Focus Session</h3>
          <div className="space-y-2">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => startFocus(cat.name)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 transition-all text-left"
              >
                <span className="text-sm text-white/85 truncate">{cat.name}</span>
                <span className="text-xs text-white/30 shrink-0 ml-2">
                  {timerMode === 'countdown' ? `${Math.floor(countdownTarget / 60)}m` : 'Start'}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="glass-strong rounded-2xl p-5">
          <h3 className="text-sm text-white/50 mb-4 tracking-wide">Today Breakdown</h3>
          {Object.keys(todayByCategory).length === 0 ? (
            <p className="text-white/30 text-sm text-center py-4">No sessions yet</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(todayByCategory).map(([cat, secs]) => {
                const percent = Math.round((secs / totalAll) * 100)
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-sm mb-1.5 gap-2">
                      <span className="text-white/75 truncate">{cat}</span>
                      <span className="text-white/40 shrink-0">{formatDuration(secs)} · {percent}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percent}%`,
                          background: theme === 'void'
                            ? 'linear-gradient(90deg, #38bdf8, #7dd3fc)'
                            : theme === 'pulse'
                            ? 'linear-gradient(90deg, #a855f7, #c084fc)'
                            : 'linear-gradient(90deg, #3b82f6, #60a5fa)'
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="glass-strong rounded-2xl p-5">
          <h3 className="text-sm text-white/50 mb-3 tracking-wide">Recent Sessions</h3>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {sessions.slice(0, 8).map(s => (
              <div key={s.id} className="flex justify-between items-center gap-3 text-sm py-2 border-b border-white/5 last:border-0">
                <span className="text-white/70 truncate min-w-0">{s.category}</span>
                <span className="text-white/35 text-xs shrink-0">{formatDuration(s.duration)}</span>
              </div>
            ))}
            {sessions.length === 0 && (
              <p className="text-white/30 text-sm text-center py-4">Empty</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
