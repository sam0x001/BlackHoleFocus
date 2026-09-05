import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/useStore'

interface Props {
  /** Selected month as 'YYYY-MM' */
  value: string
  onChange: (value: string) => void
  /** Months (sorted, 'YYYY-MM') that contain recorded sessions and may be picked */
  availableMonths: string[]
  className?: string
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function localMonthKey(d: Date = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function MonthPicker({ value, onChange, availableMonths, className = '' }: Props) {
  const { theme } = useStore()
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => Number(value.slice(0, 4)) || new Date().getFullYear())
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  const todayKey = localMonthKey()

  const selectable = (key: string) => {
    // Months in the future never make sense; otherwise pickable only when the
    // month has data — except the current month, which is always allowed.
    if (key > todayKey) return false
    if (key === todayKey) return true
    return availableMonths.includes(key)
  }

  const yearsWithData = availableMonths.map(k => Number(k.slice(0, 4)))
  const minYear = Math.min(new Date().getFullYear(), ...yearsWithData)
  const maxYear = new Date().getFullYear()

  const updatePosition = useCallback(() => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setDropdownPos({ top: rect.bottom + 4, left: rect.left })
    }
  }, [])

  useEffect(() => {
    if (!open) return
    updatePosition()
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        ref.current && !ref.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }
    const onScroll = () => updatePosition()
    document.addEventListener('mousedown', handler)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (open && value) setViewYear(Number(value.slice(0, 4)))
  }, [open, value])

  const pad = (n: number) => String(n).padStart(2, '0')

  const displayLabel = () => {
    if (!value) return 'Select month'
    const [y, m] = value.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const accentColor = { void: '#38bdf8', pulse: '#a855f7', neon: '#3b82f6' }[theme]

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Visible button */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm text-left transition-all duration-200 whitespace-nowrap
          bg-white/5 border hover:bg-white/8 hover:border-white/20 focus:outline-none
          ${theme === 'void' ? 'border-sky-400/20 hover:border-sky-400/40' : ''}
          ${theme === 'pulse' ? 'border-purple-400/20 hover:border-purple-400/40' : ''}
          ${theme === 'neon' ? 'border-blue-400/20 hover:border-blue-400/40' : ''}`}
      >
        <span className="text-white/85">{displayLabel()}</span>
        <svg className="w-4 h-4 text-white/30 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {/* Dropdown calendar — fixed positioned via portal to escape overflow containers */}
      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] w-72 p-3 rounded-xl border border-white/10 shadow-2xl"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            background: 'rgba(10, 10, 20, 0.97)',
            backdropFilter: 'blur(40px)',
          }}
        >
          {/* Year navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setViewYear(y => Math.max(minYear, y - 1))}
              disabled={viewYear <= minYear}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all text-xs disabled:opacity-25 disabled:cursor-default"
            >
              ←
            </button>
            <span className="text-xs font-medium text-white/80">{viewYear}</span>
            <button
              type="button"
              onClick={() => setViewYear(y => Math.min(maxYear, y + 1))}
              disabled={viewYear >= maxYear}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all text-xs disabled:opacity-25 disabled:cursor-default"
            >
              →
            </button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-3 gap-1">
            {MONTH_NAMES.map((name, i) => {
              const key = `${viewYear}-${pad(i + 1)}`
              const disabled = !selectable(key)
              const selected = value === key
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange(key)
                    setOpen(false)
                  }}
                  className={`h-9 rounded-lg text-xs transition-all
                    ${disabled
                      ? 'opacity-25 cursor-default'
                      : selected
                      ? 'text-white font-semibold'
                      : 'text-white/75 hover:bg-white/10'}`}
                  style={selected ? { background: `${accentColor}40` } : undefined}
                >
                  {name}
                </button>
              )
            })}
          </div>

          <p className="text-[10px] text-white/25 text-center mt-3">
            Months without focus data can't be selected
          </p>
        </div>,
        document.body
      )}
    </div>
  )
}
