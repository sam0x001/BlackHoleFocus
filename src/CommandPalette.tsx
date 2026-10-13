import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, View } from './store/useStore'
import { localDateString } from './lib/date'

interface Cmd {
  id: string
  label: string
  hint?: string
  run: () => void
}

/** Ctrl+K quick navigation + actions overlay. */
export default function CommandPalette() {
  const {
    paletteOpen, togglePalette, setView, categories, startFocus,
    currentCategory, restDays, toggleRestDay
  } = useStore()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (paletteOpen) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [paletteOpen])

  const commands: Cmd[] = useMemo(() => {
    const today = localDateString()
    const isRestToday = restDays.includes(today)
    const nav: Cmd[] = (['dashboard', 'focus', 'analytics', 'settings'] as View[]).map(v => ({
      id: `nav-${v}`,
      label: `Go to ${v === 'focus' ? 'Focus Mode' : v[0].toUpperCase() + v.slice(1)}`,
      hint: 'Navigation',
      run: () => setView(v)
    }))
    const starts: Cmd[] = currentCategory ? [] : categories.map(c => ({
      id: `start-${c.id}`,
      label: `Start focus — ${c.name}`,
      hint: 'Session',
      run: () => startFocus(c.name)
    }))
    const actions: Cmd[] = [
      {
        id: 'break-toggle',
        label: isRestToday ? 'Remove today from Break Time' : 'Mark today as Break Time',
        hint: 'Break Time',
        run: () => toggleRestDay(today)
      },
      ...(currentCategory
        ? [{
            id: 'session-stop',
            label: 'End current session',
            hint: 'Session',
            run: () => useStore.getState().stopFocus()
          }]
        : [])
    ]
    return [...nav, ...starts, ...actions]
  }, [paletteOpen, categories, currentCategory, restDays, setView, startFocus, toggleRestDay])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(c => c.label.toLowerCase().includes(q))
  }, [commands, query])

  useEffect(() => { setSelected(0) }, [query])

  // Keep the selected row visible while arrowing
  useEffect(() => {
    const el = listRef.current?.children[selected] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  if (!paletteOpen) return null

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected(s => Math.min(filtered.length - 1, s + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected(s => Math.max(0, s - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = filtered[selected]
      if (cmd) {
        cmd.run()
        togglePalette()
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-[400] flex items-start justify-center pt-[18vh] bg-black/50 backdrop-blur-sm"
      onClick={togglePalette}
    >
      <div className="glass-strong rounded-2xl w-[480px] max-w-[92vw] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a command or search…"
          className="w-full bg-transparent px-4 py-3.5 text-sm outline-none border-b border-white/10 placeholder:text-white/25"
        />
        <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-1.5">
          {filtered.length === 0 && (
            <p className="text-white/30 text-sm text-center py-6">No matching commands</p>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onMouseEnter={() => setSelected(i)}
              onClick={() => { cmd.run(); togglePalette() }}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center justify-between gap-3 transition-colors ${
                i === selected ? 'bg-white/10 text-white' : 'text-white/70'
              }`}
            >
              <span className="truncate">{cmd.label}</span>
              {cmd.hint && <span className="text-[10px] text-white/30 shrink-0">{cmd.hint}</span>}
            </button>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-white/10 text-[10px] text-white/30 flex gap-4">
          <span>↑↓ navigate</span>
          <span>↵ run</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}
