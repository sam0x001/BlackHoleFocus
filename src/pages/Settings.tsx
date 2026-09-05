import { useState, useRef, useEffect } from 'react'
import { useStore, Theme } from '../store/useStore'
import ColorPicker from '../components/ColorPicker'

export default function Settings() {
  const {
    theme, setTheme, categories, addCategory, removeCategory,
    backgrounds, setBackground
  } = useStore()

  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#3b82f6')
  const [uploadTarget, setUploadTarget] = useState<Theme>('void')
  const [dataPath, setDataPath] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if ((window as any).electronAPI?.getDbPath) {
      (window as any).electronAPI.getDbPath().then(setDataPath)
    }
  }, [])

  const themes: { id: Theme; name: string; desc: string }[] = [
    { id: 'void', name: 'Void', desc: 'Deep space, soft blue accent' },
    { id: 'pulse', name: 'Pulse', desc: 'Cold purple, electric energy' },
    { id: 'neon', name: 'Neon', desc: 'Electric blue + cyber red' },
  ]

  const handleAddCategory = () => {
    if (!newCatName.trim()) return
    addCategory(newCatName.trim(), newCatColor)
    setNewCatName('')
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setBackground(uploadTarget, reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="h-full p-8 overflow-y-auto">
      <h2 className="text-2xl font-semibold tracking-wide mb-8">Settings</h2>

      <section className="mb-10">
        <h3 className="text-sm text-white/45 mb-3 tracking-wide">Storage</h3>
        <div className="glass-strong rounded-2xl p-5 space-y-2">
          <p className="text-sm text-white/70">Data folder</p>
          <p className="text-xs text-white/35 break-all">{dataPath || '…'}</p>
          <p className="text-xs text-white/25">
            sessions.ndjson · categories.json · tasks.json · settings.json
          </p>
        </div>
      </section>

      <section className="mb-10">
        <h3 className="text-sm text-white/45 mb-3 tracking-wide">Background Images</h3>
        <div className="glass-strong rounded-2xl p-5 space-y-4">
          {themes.map(t => (
            <div key={t.id} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-white/80">{t.name}</p>
                <p className="text-xs text-white/35">
                  {backgrounds[t.id] ? 'Image set' : 'No image'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setUploadTarget(t.id)
                    fileRef.current?.click()
                  }}
                  className="glass-button text-xs py-1.5 px-3"
                >
                  {backgrounds[t.id] ? 'Change' : 'Set Image'}
                </button>
                {backgrounds[t.id] && (
                  <button
                    onClick={() => setBackground(t.id, null)}
                    className="text-xs text-white/35 hover:text-red-300 px-2"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </div>
      </section>

      <section className="mb-10">
        <h3 className="text-sm text-white/45 mb-3 tracking-wide">Active Theme</h3>
        <div className="grid grid-cols-3 gap-3">
          {themes.map(t => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`glass-strong rounded-2xl p-5 text-left transition-all
                ${theme === t.id ? 'ring-2 ring-white/25 scale-[1.02]' : 'hover:bg-white/8'}`}
            >
              <h4 className="font-medium mb-1 text-white/90">{t.name}</h4>
              <p className="text-xs text-white/40 leading-relaxed">{t.desc}</p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm text-white/45 mb-3 tracking-wide">Categories</h3>
        <div className="glass-strong rounded-2xl p-5">
          <div className="flex gap-2 mb-4 items-center">
            <ColorPicker value={newCatColor} onChange={setNewCatColor} />
            <input
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
              placeholder="New category name..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-white/25 placeholder:text-white/25"
            />
            <button onClick={handleAddCategory} className="glass-button text-sm">Add</button>
          </div>
          {categories.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-4">No categories — add your first one above</p>
          ) : (
            <div className="space-y-1.5">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="flex-1 text-sm text-white/80 truncate">{cat.name}</span>
                  <button
                    onClick={() => removeCategory(cat.id)}
                    className="text-white/30 hover:text-red-400 text-xs px-2 shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="mt-12 text-center space-y-2">
        <p className="text-white/20 text-xs tracking-wide">BlackHole Focus v1.2</p>
        <p className="text-white/15 text-[11px]">Developer: <span className="text-white/30">Sam</span></p>
        <a
          href="https://github.com/sam0x001/BlackHoleFoucs"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-white/25 text-[11px] hover:text-white/50 transition-colors no-drag"
        >
          github.com/sam0x001/BlackHoleFoucs
        </a>
      </div>
    </div>
  )
}
