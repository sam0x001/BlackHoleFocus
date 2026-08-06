import { useStore } from '../store/useStore'

export default function CharacterDisplay() {
  const { theme } = useStore()

  const labels = {
    blackhole: 'BLACK HOLE',
    killua: 'KILLUA',
    spiderman: 'SPIDER-MAN 2099',
  }

  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      <div className="w-40 h-40 rounded-full border border-white/10 bg-white/5 backdrop-blur-xl flex items-center justify-center">
        <span className="text-white/20 text-xs tracking-[0.25em] font-medium">
          {labels[theme]}
        </span>
      </div>
    </div>
  )
}
