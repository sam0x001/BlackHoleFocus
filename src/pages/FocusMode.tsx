import { useState } from 'react'
import { useStore } from '../store/useStore'

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function FocusMode() {
  const {
    isFocusing,
    currentCategory,
    elapsedSeconds,
    remainingSeconds,
    timerMode,
    pauseFocus,
    resumeFocus,
    stopFocus,
    startFocus,
    categories,
    tasks,
    addTask,
    toggleTask,
    removeTask,
    theme
  } = useStore()

  const [newTask, setNewTask] = useState('')

  const handleAddTask = () => {
    if (newTask.trim()) {
      addTask(newTask.trim())
      setNewTask('')
    }
  }

  const displayTime = timerMode === 'countdown' ? remainingSeconds : elapsedSeconds

  if (!currentCategory) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <h2 className="text-xl font-display text-white/70 tracking-wide">
            Select a category
          </h2>
          <div className="flex flex-wrap justify-center gap-3 max-w-lg">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => startFocus(cat.name)}
                className="glass-strong rounded-2xl px-8 py-4 text-sm hover:bg-white/10 transition-all"
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col items-center justify-center">
        <p className="text-white/40 text-sm mb-1 tracking-[0.2em] uppercase text-center">
          {currentCategory}
        </p>
        <p className="text-white/25 text-xs mb-4 tracking-wide text-center">
          {timerMode === 'countdown' ? 'COUNTDOWN' : 'STOPWATCH'}
        </p>

        <div
          className="text-7xl font-display font-bold tracking-tighter tabular-nums mb-10"
          style={{
            textShadow: theme === 'void'
              ? '0 0 50px rgba(56,189,248,0.35)'
              : theme === 'pulse'
              ? '0 0 50px rgba(168,85,247,0.35)'
              : '0 0 50px rgba(59,130,246,0.35)'
          }}
        >
          {formatTime(displayTime)}
        </div>

        <div className="flex gap-3">
          {isFocusing ? (
            <button onClick={pauseFocus} className="glass-button text-sm min-w-[110px]">
              Pause
            </button>
          ) : (
            <button onClick={resumeFocus} className="glass-button text-sm min-w-[110px]">
              Resume
            </button>
          )}
          <button onClick={stopFocus} className="glass-button text-sm text-red-300/70 hover:text-red-300 min-w-[110px]">
            End Session
          </button>
        </div>
      </div>

      <div className="w-80 p-6 flex flex-col">
        <div className="glass-strong rounded-2xl flex-1 flex flex-col p-5 min-h-0">
          <h3 className="text-sm text-white/50 mb-4 tracking-wide">Tasks</h3>

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
              className="shrink-0 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 flex items-center justify-center text-lg leading-none"
            >
              +
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {tasks.map(task => (
              <div
                key={task.id}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all
                  ${task.done
                    ? 'bg-white/[0.03] border-white/5 opacity-50'
                    : 'bg-white/5 border-white/10 hover:bg-white/[0.07] hover:border-white/15'
                  }`}
              >
                <button
                  onClick={() => toggleTask(task.id)}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center text-[11px] shrink-0
                    ${task.done
                      ? 'bg-emerald-500/25 border-emerald-400/40 text-emerald-300'
                      : 'border-white/25 hover:border-white/40'
                    }`}
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
                <button
                  onClick={() => removeTask(task.id)}
                  className="text-white/25 hover:text-red-400 text-xs px-1.5 py-1 shrink-0 transition-colors"
                >
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
    </div>
  )
}
