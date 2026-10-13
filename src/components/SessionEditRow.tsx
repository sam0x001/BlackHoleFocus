import { useState } from 'react'

interface Props {
  initialMinutes: string
  initialCategory: string
  initialNote: string
  categories: string[]
  onCancel: () => void
  onSave: (patch: { duration?: number; category?: string; note?: string }) => void
}

/** Inline editor for a history session: duration (min), category, note. */
export default function SessionEditRow({ initialMinutes, initialCategory, initialNote, categories, onCancel, onSave }: Props) {
  const [minutes, setMinutes] = useState(initialMinutes)
  const [category, setCategory] = useState(initialCategory)
  const [note, setNote] = useState(initialNote)

  const handleSave = () => {
    const mins = parseFloat(minutes)
    const patch: { duration?: number; category?: string; note?: string } = {}
    if (!isNaN(mins) && mins > 0) patch.duration = Math.round(mins * 60)
    if (category.trim()) patch.category = category.trim()
    patch.note = note.trim() || undefined
    onSave(patch)
  }

  return (
    <div className="bg-white/8 border border-white/15 rounded-xl p-3 space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] text-white/35">
          Duration (min)
          <input
            type="number"
            min={1}
            value={minutes}
            onChange={e => setMinutes(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none focus:border-white/25 tabular-nums"
          />
        </label>
        <label className="text-[10px] text-white/35">
          Category
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="mt-1 w-full bg-[#14141c] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-white/25"
          >
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
            {!categories.includes(category) && <option value={category}>{category}</option>}
          </select>
        </label>
      </div>
      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSave()}
        placeholder="Note (optional)…"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none focus:border-white/25 placeholder:text-white/25"
      />
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="glass-button text-xs px-3 py-1.5">Cancel</button>
        <button onClick={handleSave} className="glass-button text-xs px-3 py-1.5">Save</button>
      </div>
    </div>
  )
}