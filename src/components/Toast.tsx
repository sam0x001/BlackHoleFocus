import { useEffect } from 'react'

interface Props {
  message: string
  onClose: () => void
  duration?: number
}

export default function Toast({ message, onClose, duration = 2800 }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, duration)
    return () => clearTimeout(t)
  }, [onClose, duration])

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200]">
      <div className="glass-strong rounded-2xl px-6 py-3.5 flex items-center gap-3 shadow-2xl">
        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
        <p className="text-sm text-white/90">{message}</p>
        <button onClick={onClose} className="text-white/40 hover:text-white/80 text-xs ml-2 no-drag">
          Close
        </button>
      </div>
    </div>
  )
}
