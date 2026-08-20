import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/useStore'

const COLOR_PALETTE = [
  '#3b82f6', '#a855f7', '#22c55e', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#8b5cf6',
]

interface Props {
  value: string
  onChange: (color: string) => void
  className?: string
}

export default function ColorPicker({ value, onChange, className = '' }: Props) {
  const { theme } = useStore()
  const [isOpen, setIsOpen] = useState(false)
  const [customColor, setCustomColor] = useState(value)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  const themeBorder = {
    void: 'border-sky-400/20 hover:border-sky-400/40 focus:border-sky-400/50',
    pulse: 'border-purple-400/20 hover:border-purple-400/40 focus:border-purple-400/50',
    neon: 'border-blue-400/20 hover:border-blue-400/40 focus:border-blue-400/50',
  }[theme]

  const themeRing = {
    void: 'focus:ring-sky-400/20',
    pulse: 'focus:ring-purple-400/20',
    neon: 'focus:ring-blue-400/20',
  }[theme]

  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      // Open upward: position dropdown above the button
      setDropdownPos({ top: rect.top - 8, left: rect.left })
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return
    updatePosition()
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    const onScroll = () => updatePosition()
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [isOpen, updatePosition])

  const handleColorSelect = (color: string) => {
    onChange(color)
    setCustomColor(color)
    setIsOpen(false)
  }

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value
    setCustomColor(color)
    onChange(color)
  }

  const handleCustomBlur = () => {
    // Validate hex color
    if (/^#[0-9A-Fa-f]{6}$/.test(customColor)) {
      onChange(customColor)
    } else {
      setCustomColor(value)
    }
    setIsOpen(false)
  }

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-10 h-10 rounded-lg border glass-strong transition-all duration-200 flex items-center justify-center ${themeBorder} ${themeRing} focus:outline-none focus:ring-2`}
        style={{ backgroundColor: value }}
        aria-label="Pick a color"
        aria-expanded={isOpen}
      >
        {/* Checkerboard background for transparency preview */}
        <div className="absolute inset-0 rounded-lg" style={{
          backgroundImage: `linear-gradient(45deg, #1a1a2e 25%, transparent 25%),
            linear-gradient(-45deg, #1a1a2e 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #1a1a2e 75%),
            linear-gradient(-45deg, transparent 75%, #1a1a2e 75%)`,
          backgroundSize: '8px 8px',
          backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px'
        }} />
        {value && (
          <div className="relative w-full h-full rounded-lg" style={{ backgroundColor: value }} />
        )}
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] rounded-xl p-3 border border-white/15 shadow-2xl min-w-[200px]"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            transform: 'translateY(-100%)',
            background: 'rgba(12, 12, 24, 0.97)',
            backdropFilter: 'blur(48px)',
          }}
          role="menu"
        >
          <div className="mb-3">
            <p className="text-[10px] text-white/35 tracking-wide uppercase mb-2">Preset Colors</p>
            <div className="grid grid-cols-5 gap-2">
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleColorSelect(color)}
                  className={`w-10 h-10 rounded-lg border-2 transition-all duration-200 flex items-center justify-center
                    ${value === color ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:border-white/30'}
                    ${theme === 'void' ? 'hover:shadow-[0_0_12px_rgba(56,189,248,0.4)]' : ''}
                    ${theme === 'pulse' ? 'hover:shadow-[0_0_12px_rgba(168,85,247,0.4)]' : ''}
                    ${theme === 'neon' ? 'hover:shadow-[0_0_12px_rgba(59,130,246,0.4)]' : ''}`}
                  style={{ backgroundColor: color }}
                  role="menuitemradio"
                  aria-checked={value === color}
                  aria-label={color}
                >
                  {value === color && (
                    <svg className="w-5 h-5 text-white drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10 pt-3">
            <p className="text-[10px] text-white/35 tracking-wide uppercase mb-2">Custom Color</p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={customColor}
                onChange={handleCustomChange}
                onBlur={handleCustomBlur}
                className="w-10 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer shrink-0"
                aria-label="Custom color picker"
              />
              <input
                type="text"
                value={customColor}
                onChange={handleCustomChange}
                onBlur={handleCustomBlur}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomBlur()}
                placeholder="#RRGGBB"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-white/25 placeholder:text-white/20 text-center font-mono uppercase"
                maxLength={7}
                aria-label="Hex color code"
              />
            </div>
            <p className="text-[10px] text-white/25 mt-2 text-center">Enter hex code (e.g., #3b82f6)</p>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
