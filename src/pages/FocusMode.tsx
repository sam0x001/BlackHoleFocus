import { useState } from 'react'
import { useStore, TimerMode } from '../store/useStore'
import { formatClock } from '../lib/format'

const PRESET_TIMES = [
  { label: '15m', sec: 15 * 60 },
  { label: '25m', sec: 25 * 60 },
  { label: '45m', sec: 45 * 60 },
  { label: '60m', sec: 60 * 60 },
]

const TIMER_MODES: { id: TimerMode; label: string; desc: string }[] = [
  { id: 'stopwatch', label: 'Stopwatch', desc: 'Counts up — no limit' },
  { id: 'countdown', label: 'Countdown', desc: 'Fixed length session' },
  { id: 'pomodoro', label: 'Pomodoro', desc: 'Focus + break cycles' },
]

export default function FocusMode() {
  const {
    isFocusing, currentCategory, elapsedSeconds, remainingSeconds, timerMode,
    setTimerMode, countdownTarget, setCountdownTarget,
    pauseFocus, resumeFocus, stopFocus, startFocus, categories, tasks,
    addTask, toggleTask, removeTask, theme, setView, sessionNote, setSessionNote,
    pomodoro, setPomodoro, phase, cycleCount, skipBreak
  } = useStore()

  const [newTask, setNewTask] = useState('')
  const [customMinutes, setCustomMinutes] = useState(String(Math.max(1, Math.floor(countdownTarget / 60))))
  // Tasks panel can be hidden for a distraction-free timer view
  const [panelOpen, setPanelOpen] = useState(() => localStorage.getItem('bh:focusPanel') !== '0')
  const togglePanel = () => {
    const next = !panelOpen
    setPanelOpen(next)
    localStorage.setItem('bh:focusPanel', next ? '1' : '0')
  }
  const handleAddTask = () => {
    if (newTask.trim()) {
      addTask(newTask.trim())
      setNewTask('')
    }
  }
  const applyCustomMinutes = () => {
    const mins = parseInt(customMinutes, 10)
    if (!isNaN(mins) && mins > 0 && mins <= 600) setCountdownTarget(mins * 60)
  }
  const onBreak = timerMode === 'pomodoro' && phase === 'break'
  const displayTime = timerMode === 'stopwatch' ? elapsedSeconds : remainingSeconds

  // Idle — pick a category and timer settings, then the session starts instantly
  if (!currentCategory) {
    return (
      <div className="h-full w-full overflow-y-auto flex flex-col items-center justify-center gap-7 px-6 py-8">
        <div className="text-center">
          <p className="text-white/30 text-[11px] tracking-[0.35em] uppercase mb-2">Focus Mode</p>
          <h2 className="text-2xl font-semibold text-white/85 tracking-wide">Pick a category to start</h2>
          <p className="text-white/35 text-sm mt-2">The session begins the moment you choose</p>
        </div>

        {/* Timer settings */}
        <div className="glass-strong rounded-2xl p-5 w-full max-w-md">
          <div className="flex items-center justify-between mb-3 gap-3">
            <h3 className="text-sm text-white/50 tracking-wide">Timer</h3>
            <span className="text-[11px] text-white/30">
              {timerMode === 'countdown'
                ? `${Math.floor(countdownTarget / 60)} min session`
                : timerMode === 'pomodoro'
                  ? `${pomodoro.focusMin}m focus · ${pomodoro.breakMin}m break`
                  : 'Counts up — no limit'}
            </span>
          </div>
          <div className="flex gap-2 mb-3">
            {TIMER_MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setTimerMode(m.id)}
                title={m.desc}
                className={`flex-1 py-2 rounded-xl text-sm transition-all ${
                  timerMode === m.id
                    ? 'bg-white/15 text-white border border-white/20'
                    : 'bg-white/5 text-white/45 hover:bg-white/10'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {timerMode === 'countdown' && (
            <div className="space-y-2.5">
              <div className="flex gap-2">
                {PRESET_TIMES.map(p => (
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
                />
                <span className="text-xs text-white/40 shrink-0">min</span>
                <button onClick={applyCustomMinutes} className="glass-button text-xs py-2 px-3">Set</button>
              </div>
            </div>
          )}

          {/* Pomodoro cycle settings (only when idle) */}
          {timerMode === 'pomodoro' && (
            <div className="grid grid-cols-2 gap-2.5">
              {([
                { key: 'focusMin', label: 'Focus', max: 120 },
                { key: 'breakMin', label: 'Break', max: 60 },
                { key: 'longBreakMin', label: 'Long break', max: 120 },
                { key: 'longEvery', label: 'Long every', max: 12, suffix: 'cycles' },
              ] as const).map(f => (
                <label key={f.key} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-white/45">{f.label}</span>
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={f.max}
                      value={pomodoro[f.key]}
                      onChange={e => setPomodoro({ [f.key]: parseInt(e.target.value, 10) } as any)}
                      className="w-12 bg-transparent text-sm text-center outline-none tabular-nums"
                    />
                    <span className="text-[10px] text-white/30">{'suffix' in f ? f.suffix : 'min'}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Category selection — same card size as the Timer section */}
        {categories.length === 0 ? (
          <div className="glass-strong rounded-2xl px-10 py-8 text-center w-full max-w-md">
            <p className="text-white/45 text-sm mb-4">
              No categories yet. Add one from Settings first.
            </p>
            <button onClick={() => setView('settings')} className="glass-button">
              Open Settings
            </button>
          </div>
        ) : (
          <div className="glass-strong rounded-2xl p-5 w-full max-w-md">
            <div className="flex items-center justify-between mb-3 gap-3">
              <h3 className="text-sm text-white/50 tracking-wide">Category</h3>
              <span className="text-[11px] text-white/30">Starts instantly</span>
            </div>
            <div className="space-y-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => startFocus(cat.name)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 transition-all text-left group"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform group-hover:scale-125"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-sm text-white/85 flex-1 truncate">{cat.name}</span>
                  <span className="text-xs text-white/30 shrink-0">
                    {timerMode === 'countdown' ? `${Math.floor(countdownTarget / 60)} min` : 'stopwatch'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const isPomodoro = timerMode === 'pomodoro'
  const pomodoroTarget = countdownTarget > 0 ? countdownTarget : 1
  const pomodoroProgress = timerMode === 'stopwatch' ? 0 : Math.min(1, Math.max(0, 1 - remainingSeconds / pomodoroTarget))
  const RING_R = 128
  const RING_C = 2 * Math.PI * RING_R

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col items-center justify-center">
        <p className="text-white/40 text-sm mb-1 tracking-[0.2em] uppercase text-center">{currentCategory}</p>
        <p className="text-white/25 text-xs mb-1 tracking-wide text-center">
          {isPomodoro
            ? onBreak
              ? `BREAK · CYCLE ${Math.max(1, cycleCount)}`
              : `FOCUS · CYCLE ${cycleCount + 1}`
            : timerMode === 'countdown' ? 'COUNTDOWN' : 'STOPWATCH'}
        </p>
        {onBreak && (
          <p className="text-emerald-300/70 text-xs mb-3 tracking-wide text-center">Rest — not recorded</p>
        )}
        {!onBreak && <div className="mb-3" />}
        <div className="relative flex items-center justify-center mb-8" style={{ width: 300, height: 300 }}>
          {timerMode !== 'stopwatch' && (
            <svg width="300" height="300" className="absolute inset-0 -rotate-90">
              <circle cx="150" cy="150" r={RING_R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
              <circle
                cx="150" cy="150" r={RING_R} fill="none"
                stroke={onBreak ? '#34d399' : 'var(--bh-accent, #9fd4ff)'}
                strokeWidth="5" strokeLinecap="round"
                strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - pomodoroProgress)}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
          )}
          <div
            className="text-7xl font-semibold tracking-tighter tabular-nums"
            style={{
              textShadow: theme === 'void'
                ? '0 0 50px rgba(56,189,248,0.35)'
                : theme === 'pulse'
                ? '0 0 50px rgba(168,85,247,0.35)'
                : '0 0 50px rgba(59,130,246,0.35)'
            }}
          >
            {formatClock(displayTime)}
          </div>
        </div>
        <input
          value={sessionNote}
          onChange={e => setSessionNote(e.target.value)}
          placeholder="Session note (saved with this session)…"
          aria-label="Session note"
          className="w-80 max-w-full mb-6 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-center outline-none focus:border-white/25 placeholder:text-white/25"
        />
        <div className="flex gap-3">
          {isFocusing ? (
            <button onClick={pauseFocus} className="glass-button text-sm min-w-[110px]">Pause</button>
          ) : (
            <button onClick={resumeFocus} className="glass-button text-sm min-w-[110px]">Resume</button>
          )}
          {onBreak && (
            <button onClick={skipBreak} className="glass-button text-sm min-w-[110px]">
              Skip Break
            </button>
          )}
          <button onClick={stopFocus} className="glass-button text-sm text-red-300/70 hover:text-red-300 min-w-[110px]">
            End Session
          </button>
        </div>
        <p className="text-white/25 text-xs mt-6 tracking-wide">Space — pause/resume · Esc — show menu</p>
      </div>

      <div
        className={`bh-right-panel ${panelOpen ? '' : 'is-closed'}`}
        style={{ '--bh-panel-w': '368px' } as React.CSSProperties}
      >
        <div className="bh-right-panel-body flex flex-col">
          <div className="glass-strong rounded-2xl flex-1 flex flex-col p-5 min-h-0">
            <div className="flex items-center justify-between mb-4 gap-2">
              <h3 className="text-sm text-white/50 tracking-wide">Tasks</h3>
              <button
                onClick={togglePanel}
                title="Hide tasks panel"
                aria-label="Hide tasks panel"
                className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white/80 text-xs transition-all flex items-center justify-center shrink-0"
              >
                ›
              </button>
            </div>
          <div className="flex items-center gap-2 mb-4">
            <input
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTask()}
              placeholder="Add a task..."
              className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-white/25 placeholder:text-white/25"
            />
            <button
              onClick={handleAddTask}
              className="shrink-0 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 flex items-center justify-center text-lg"
            >
              +
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {tasks.map(task => (
              <div
                key={task.id}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all
                  ${task.done ? 'bg-white/[0.03] border-white/5 opacity-50' : 'bg-white/5 border-white/10'}`}
              >
                <button
                  onClick={() => toggleTask(task.id)}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center text-[11px] shrink-0
                    ${task.done ? 'bg-emerald-500/25 border-emerald-400/40 text-emerald-300' : 'border-white/25'}`}
                >
                  {task.done && '✓'}
                </button>
                <span
                  onClick={() => toggleTask(task.id)}
                  className={`text-sm flex-1 cursor-pointer min-w-0 break-words ${
                    task.done ? 'line-through text-white/40' : 'text-white/85'
                  }`}
                >
                  {task.text}
                </span>
                <button onClick={() => removeTask(task.id)} className="text-white/25 hover:text-red-400 text-xs px-1.5 shrink-0">
                  x
                </button>
              </div>
            ))}
            {tasks.length === 0 && (
              <p className="text-white/25 text-sm text-center py-8">No tasks</p>
            )}
          </div>
        </div>
        </div>

        <div className="bh-right-panel-rail">
          <button
            onClick={togglePanel}
            title="Show tasks panel"
            aria-label="Show tasks panel"
            className="w-7 h-16 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white/80 text-sm transition-all flex items-center justify-center"
          >
            ‹
          </button>
        </div>
      </div>
    </div>
  )
}
