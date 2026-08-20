import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/useStore'

interface Props {
  value: string
  onChange: (value: string) => void
  label?: string
  min?: string
  max?: string
  className?: string
}

export default function DatePicker({ value, onChange, label, min, max, className = '' }: Props) {
  const { theme } = useStore()
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => {
    const [y, m] = value.split('-').map(Number)
    return { year: y || new Date().getFullYear(), month: (m || new Date().getMonth() + 1) - 1 }
  })
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

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
    if (open && value) {
      const [y, m] = value.split('-').map(Number)
      if (y && m) setViewMonth({ year: y, month: m - 1 })
    }
  }, [open, value])

  const toD = (s?: string) => s ? new Date(+s.slice(0,4), +s.slice(5,7)-1, +s.slice(8,10)) : undefined
  const minDate = toD(min)
  const maxDate = toD(max)

  const isDisabled = (y: number, m: number, d: number) => {
    const dt = new Date(y, m, d)
    dt.setHours(0,0,0,0)
    if (minDate && dt < minDate) return true
    if (maxDate && dt > maxDate) return true
    return false
  }

  const pad = (n: number) => String(n).padStart(2, '0')

  const displayLabel = () => {
    if (!value) return 'Select date'
    const [y, m, d] = value.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    return dt.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const calDays = () => {
    const { year, month } = viewMonth
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }

  const selectDay = (d: number) => {
    const { year, month } = viewMonth
    if (isDisabled(year, month, d)) return
    onChange(`${year}-${pad(month + 1)}-${pad(d)}`)
    setOpen(false)
  }

  const goMonth = (delta: number) => {
    setViewMonth(prev => {
      let nm = prev.month + delta
      let ny = prev.year
      if (nm < 0) { nm = 11; ny-- }
      if (nm > 11) { nm = 0; ny++ }
      return { year: ny, month: nm }
    })
  }

  const goToday = () => {
    const now = new Date()
    setViewMonth({ year: now.getFullYear(), month: now.getMonth() })
    const today = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`
    if (!isDisabled(now.getFullYear(), now.getMonth(), now.getDate())) {
      onChange(today)
    }
    setOpen(false)
  }

  const monthName = new Date(viewMonth.year, viewMonth.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const accentColor = { void: '#38bdf8', pulse: '#a855f7', neon: '#3b82f6' }[theme]

  return (
    <div ref={ref} className={`relative ${className}`}>
      {label && (
        <label className="text-[10px] text-white/35 tracking-wide uppercase mb-1.5 block">{label}</label>
      )}

      {/* Visible button */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm text-left transition-all duration-200
          bg-white/5 border hover:bg-white/8 hover:border-white/20 focus:outline-none
          ${theme === 'void' ? 'border-sky-400/20 hover:border-sky-400/40' : ''}
          ${theme === 'pulse' ? 'border-purple-400/20 hover:border-purple-400/40' : ''}
          ${theme === 'neon' ? 'border-blue-400/20 hover:border-blue-400/40' : ''}`}
      >
        <span className={value ? 'text-white/85' : 'text-white/25'}>{displayLabel()}</span>
        <svg className="w-4 h-4 text-white/30 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {/* Hidden native input for form compatibility */}
      <input type="hidden" value={value} />

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
          {/* Navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => goMonth(-1)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all text-xs"
            >
              ←
            </button>
            <span className="text-xs font-medium text-white/80">{monthName}</span>
            <button
              type="button"
              onClick={() => goMonth(1)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all text-xs"
            >
              →
            </button>
          </div>

          {/* Today button */}
          <div className="flex justify-center mb-2">
            <button
              type="button"
              onClick={goToday}
              className="text-[10px] px-2.5 py-1 rounded-lg hover:bg-white/10 transition-all"
              style={{ color: accentColor }}
            >
              Today
            </button>
          </div>

          {/* Weekday headers */}
          <div className="flex mb-1">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d} className="calendar-weekday">{d}</div>
            ))}
          </div>

          {/* Calendar grid — explicit width so flex-wrap makes 7 columns */}
          <div className="flex flex-wrap" style={{ width: '14rem' }}>
            {calDays().map((d, i) => (
              d !== null ? (
                <button
                  key={`${viewMonth.year}-${viewMonth.month}-${d}`}
                  type="button"
                  onClick={() => selectDay(d)}
                  disabled={isDisabled(viewMonth.year, viewMonth.month, d)}
                  className={`calendar-day
                    ${isDisabled(viewMonth.year, viewMonth.month, d) ? 'disabled' : ''}
                    ${value === `${viewMonth.year}-${pad(viewMonth.month+1)}-${pad(d)}` ? 'selected' : ''}
                    ${new Date().getFullYear() === viewMonth.year && new Date().getMonth() === viewMonth.month && new Date().getDate() === d ? 'today' : ''}`}
                  style={value === `${viewMonth.year}-${pad(viewMonth.month+1)}-${pad(d)}` ? { background: `${accentColor}40` } : undefined}
                >
                  {d}
                </button>
              ) : <div key={`empty-${i}`} className="w-8 h-8" />
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
