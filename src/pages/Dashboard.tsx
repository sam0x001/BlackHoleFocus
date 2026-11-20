import { useState } from 'react'
import { useStore } from '../store/useStore'
import { formatDurationShort } from '../lib/format'
import { localDateString } from '../lib/date'
import { usePalette } from '../lib/theme'

export default function Dashboard() {
  const {
    todayTotal,
    todayByCategory,
    sessions,
    setView,
    restDays,
    dailyGoalMinutes,
    recoveryNotice,
    clearRecoveryNotice
  } = useStore()

  const palette = usePalette()
  const isRestToday = restDays.includes(localDateString())
  const totalAll = Object.values(todayByCategory).reduce((a, b) => a + b, 0) || 1
  const todayLabel = new Date().toLocaleDateString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
  const todayDate = localDateString()
  const todaySessions = sessions.filter(s => s.date === todayDate)
  const categoryCount = Object.keys(todayByCategory).length
  const goalSeconds = dailyGoalMinutes * 60
  const goalPct = goalSeconds > 0 ? Math.min(100, Math.floor((todayTotal / goalSeconds) * 100)) : 0
  const goalLeft = Math.max(0, goalSeconds - todayTotal)

  // Right panel (breakdown + history) can be hidden to give the hero full width
  const [panelOpen, setPanelOpen] = useState(() => localStorage.getItem('bh:rightPanel') !== '0')
  const togglePanel = () => {
    const next = !panelOpen
    setPanelOpen(next)
    localStorage.setItem('bh:rightPanel', next ? '1' : '0')
  }

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col px-8 min-w-0 overflow-hidden">
        <header className="pt-7 shrink-0">
          <p className="text-[11px] tracking-[0.34em] uppercase text-white/35">Today</p>
          <h2 className="text-[28px] leading-tight font-display font-semibold tracking-tight mt-1">{todayLabel}</h2>
        </header>

        {/* Hero */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 pb-6">
          {recoveryNotice && (
            <div className="bh-rise bh-rise-1 mb-4 flex items-center gap-3 glass rounded-2xl px-5 py-3 border-amber-300/20 max-w-md">
              <p className="text-xs text-amber-200/80 flex-1">{recoveryNotice}</p>
              <button onClick={clearRecoveryNotice} className="text-amber-200/50 hover:text-amber-200 text-xs shrink-0" title="Dismiss">
                Dismiss
              </button>
            </div>
          )}
          <p className="bh-rise bh-rise-1 text-[11px] tracking-[0.35em] uppercase text-white/40 mb-4">
            Focused today
          </p>

          <div className="bh-rise bh-rise-2">
            <p className="text-[64px] leading-none font-semibold tracking-tight tabular-nums text-white">
              {formatDurationShort(todayTotal)}
            </p>
          </div>

          {isRestToday && (
            <p className="bh-rise bh-rise-3 mt-4">
              <span className="bh-rest-badge">Break Time — today excluded from stats</span>
            </p>
          )}

          <div className="bh-rise bh-rise-3 mt-7 flex items-stretch gap-3">
            <div className="glass rounded-2xl px-6 py-3.5 text-center">
              <p className="text-[10px] tracking-[0.2em] uppercase text-white/40 mb-1">Sessions</p>
              <p className="text-xl font-semibold tabular-nums">{todaySessions.length}</p>
            </div>
            <div className="glass rounded-2xl px-6 py-3.5 text-center">
              <p className="text-[10px] tracking-[0.2em] uppercase text-white/40 mb-1">Categories</p>
              <p className="text-xl font-semibold tabular-nums">{categoryCount}</p>
            </div>
          </div>

          <div className="bh-rise bh-rise-4 mt-9 flex flex-col items-center gap-3">
            <button
              onClick={() => setView('focus')}
              className="glass-button text-sm font-medium text-white/90 px-7 py-3 inline-flex items-center gap-2.5"
            >
              Start Focusing
              <svg
                viewBox="0 0 16 16"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
              </svg>
            </button>
            <p className="text-white/25 text-xs tracking-wide">Pick a category inside Focus Mode</p>
          </div>
        </div>
      </div>

      {/* Right panel — animated slide in/out */}
      <div
        className={`bh-right-panel ${panelOpen ? '' : 'is-closed'}`}
        style={{ '--bh-panel-w': '336px' } as React.CSSProperties}
      >
        <div className="bh-right-panel-body flex flex-col gap-3">
          <div className="flex justify-end -mb-1">
            <button
              onClick={togglePanel}
              title="Hide panel"
              aria-label="Hide right panel"
              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white/80 text-sm transition-all flex items-center justify-center"
            >
              ›
            </button>
          </div>

          <div className="glass-strong rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3 gap-2">
              <h3 className="text-xs uppercase tracking-[0.14em] text-white/40">Daily Goal</h3>
              {goalSeconds > 0 && (
                <span className="text-xs text-white/40 tabular-nums shrink-0">
                  {formatDurationShort(Math.min(todayTotal, goalSeconds))} / {dailyGoalMinutes}m
                </span>
              )}
            </div>
            {goalSeconds === 0 ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-white/30 text-sm">No goal set</p>
                <button onClick={() => setView('settings')} className="glass-button text-xs">Set goal</button>
              </div>
            ) : (
              <>
                <div className="flex items-baseline justify-between mb-2 gap-2">
                  <span className="text-xl font-semibold tabular-nums">{goalPct}%</span>
                  <span className="text-[11px] text-white/35 shrink-0">
                    {goalLeft > 0 ? `${formatDurationShort(goalLeft)} left` : 'Goal reached'}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${goalPct}%`, background: palette.gradient }}
                  />
                </div>
              </>
            )}
          </div>

          <div className="glass-strong rounded-2xl p-4">
            <h3 className="text-xs uppercase tracking-[0.14em] text-white/40 mb-3">Today Breakdown</h3>
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
                        <span className="text-white/40 shrink-0">{formatDurationShort(secs)} · {percent}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${percent}%`, background: palette.gradient }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="glass-strong rounded-2xl p-4">
            <h3 className="text-xs uppercase tracking-[0.14em] text-white/40 mb-2.5">Recent Sessions</h3>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {sessions.slice(0, 8).map(s => (
                <div key={s.id} className="flex justify-between items-center gap-3 text-sm py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-white/70 truncate min-w-0">{s.category}</span>
                  <span className="text-white/35 text-xs shrink-0">{formatDurationShort(s.duration)}</span>
                </div>
              ))}
              {sessions.length === 0 && (
                <p className="text-white/30 text-sm text-center py-4">Empty</p>
              )}
            </div>
          </div>
        </div>

        <div className="bh-right-panel-rail">
          <button
            onClick={togglePanel}
            title="Show panel"
            aria-label="Show right panel"
            className="w-7 h-16 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white/80 text-sm transition-all flex items-center justify-center"
          >
            ‹
          </button>
        </div>
      </div>
    </div>
  )
}

