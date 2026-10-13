import { useState, useRef, useEffect } from 'react'
import { useStore, Theme } from '../store/useStore'
import ColorPicker from '../components/ColorPicker'
import { dbBackupData, dbImportSessions, dbPickDataFolder, dbResetDataFolder, dbOpenDataFolder } from '../db/database'

const ACCENT_PRESETS = ['#9fd4ff', '#c084fc', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#f472b6', '#22d3ee']

export default function Settings() {
  const {
    theme, setTheme, categories, addCategory, removeCategory,
    backgrounds, setBackground, liveWallpaper, setLiveWallpaper,
    dailyGoalMinutes, setDailyGoalMinutes,
    pomodoro, setPomodoro, sessionAlerts, setSessionAlerts,
    accentOverride, setAccentOverride,
    restDays, sessions
  } = useStore()

  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#3b82f6')
  const [uploadTarget, setUploadTarget] = useState<Theme>('void')
  const [dataPath, setDataPath] = useState('')
  const [autostart, setAutostartState] = useState<boolean | null>(null)
  const [dataBusy, setDataBusy] = useState<string | null>(null)
  const [dataMsg, setDataMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const accentRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if ((window as any).electronAPI?.getDbPath) {
      (window as any).electronAPI.getDbPath().then(setDataPath)
    }
    if ((window as any).electronAPI?.getAutostart) {
      (window as any).electronAPI.getAutostart().then(setAutostartState).catch(() => {})
    }
  }, [])

  const handleAutostart = (on: boolean) => {
    setAutostartState(on)
    ;(window as any).electronAPI?.setAutostart?.(on)
  }

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
        <div className="glass-strong rounded-2xl p-5 space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-white/70">Data folder</p>
            <p className="text-xs text-white/35 break-all">{dataPath || '…'}</p>
            <p className="text-xs text-white/25">
              sessions.ndjson · categories.json · tasks.json · settings.json · restDays.json
            </p>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => dbOpenDataFolder().catch(() => {})}
              className="glass-button text-xs"
            >
              Open folder
            </button>
            <button
              disabled={dataBusy !== null}
              onClick={async () => {
                setDataBusy('folder'); setDataMsg(null)
                try {
                  const res = await dbPickDataFolder()
                  if (res?.success) {
                    setDataPath(res.path || '')
                    setDataMsg('Data folder moved — restart the app to reload from it.')
                  } else if (res && !res.canceled) {
                    setDataMsg(res.error || 'Could not change folder.')
                  }
                } catch (e: any) {
                  setDataMsg(String(e?.message || e))
                }
                setDataBusy(null)
              }}
              className="glass-button text-xs disabled:opacity-50"
            >
              {dataBusy === 'folder' ? 'Moving…' : 'Move data folder…'}
            </button>
            <button
              disabled={dataBusy !== null}
              onClick={async () => {
                setDataBusy('backup'); setDataMsg(null)
                try {
                  const res = await dbBackupData()
                  setDataMsg(res?.success ? 'Backup saved.' : res?.canceled ? null : (res?.error || 'Backup failed.'))
                } catch (e: any) {
                  setDataMsg(String(e?.message || e))
                }
                setDataBusy(null)
              }}
              className="glass-button text-xs disabled:opacity-50"
            >
              {dataBusy === 'backup' ? 'Saving…' : 'Backup all data…'}
            </button>
            <button
              disabled={dataBusy !== null}
              onClick={async () => {
                setDataBusy('import'); setDataMsg(null)
                try {
                  const res = await dbImportSessions()
                  if (res?.success && (res.imported || 0) > 0) {
                    await useStore.getState().initApp()
                    setDataMsg(`Imported ${res.imported} session${res.imported === 1 ? '' : 's'}.`)
                  } else if (res?.success) {
                    setDataMsg(res?.canceled ? null : 'Nothing new to import.')
                  } else {
                    setDataMsg(res?.error || 'Import failed.')
                  }
                } catch (e: any) {
                  setDataMsg(String(e?.message || e))
                }
                setDataBusy(null)
              }}
              className="glass-button text-xs disabled:opacity-50"
            >
              {dataBusy === 'import' ? 'Importing…' : 'Import sessions…'}
            </button>
          </div>
          {dataMsg && <p className="text-xs text-white/50">{dataMsg}</p>}
          <button
            onClick={async () => {
              await dbResetDataFolder()
              setDataMsg('Custom folder cleared — default location will be used on restart.')
            }}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            Reset to default location
          </button>
        </div>
      </section>

      <section className="mb-10">
        <h3 className="text-sm text-white/45 mb-3 tracking-wide">App</h3>
        <div className="glass-strong rounded-2xl p-5 space-y-4">
          {/* Autostart */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white/80">Launch at system startup</p>
              <p className="text-xs text-white/35">Start BlackHole Focus automatically when you sign in</p>
            </div>
            <button
              role="switch"
              aria-checked={autostart === true}
              onClick={() => handleAutostart(!(autostart === true))}
              className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${autostart === true ? 'bg-white/25' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${autostart === true ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
          {/* Live wallpaper */}
          <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/5">
            <div>
              <p className="text-sm text-white/80">Live black-hole wallpaper</p>
              <p className="text-xs text-white/35">Animate the background with the built-in video (pauses when hidden)</p>
            </div>
            <button
              role="switch"
              aria-checked={liveWallpaper}
              onClick={() => setLiveWallpaper(!liveWallpaper)}
              className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${liveWallpaper ? 'bg-white/25' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${liveWallpaper ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
          {/* Session-end alerts */}
          <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/5">
            <div>
              <p className="text-sm text-white/80">Session-end sound &amp; notification</p>
              <p className="text-xs text-white/35">Bip-bip chime, plus a notification when the app is in the tray</p>
            </div>
            <button
              role="switch"
              aria-checked={sessionAlerts}
              onClick={() => setSessionAlerts(!sessionAlerts)}
              className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${sessionAlerts ? 'bg-white/25' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${sessionAlerts ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
          {/* Global hotkey */}
          <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/5">
            <div>
              <p className="text-sm text-white/80">Global hotkey</p>
              <p className="text-xs text-white/35">Pause or resume the session from any app</p>
            </div>
            <span className="text-xs text-white/40 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 shrink-0 font-mono">Ctrl+Alt+F</span>
          </div>
          {/* Command palette */}
          <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/5">
            <div>
              <p className="text-sm text-white/80">Command palette</p>
              <p className="text-xs text-white/35">Jump to views and run actions</p>
            </div>
            <span className="text-xs text-white/40 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 shrink-0 font-mono">Ctrl+K</span>
          </div>
          {/* Daily goal */}
          <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/5">
            <div>
              <p className="text-sm text-white/80">Daily focus goal</p>
              <p className="text-xs text-white/35">Shown as a progress ring on the Dashboard (0 = disabled)</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="number"
                min={0}
                max={1440}
                value={dailyGoalMinutes}
                onChange={e => {
                  const v = parseInt(e.target.value, 10)
                  setDailyGoalMinutes(isNaN(v) ? 0 : Math.max(0, Math.min(1440, v)))
                }}
                className="w-20 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-right tabular-nums outline-none focus:border-white/25"
              />
              <span className="text-xs text-white/40">min</span>
              <button
                onClick={() => {
                  // Suggest the median of the trailing 7 non-rest days
                  const rest = new Set(restDays)
                  const byDay: Record<string, number> = {}
                  sessions.forEach(s => {
                    if (!rest.has(s.date)) byDay[s.date] = (byDay[s.date] || 0) + s.duration
                  })
                  const vals = Object.values(byDay).sort((a, b) => a - b)
                  if (vals.length > 0) {
                    const mid = Math.floor(vals.length / 2)
                    const medSec = vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2
                    setDailyGoalMinutes(Math.max(5, Math.round(medSec / 60)))
                  }
                }}
                title="Set goal to your recent median"
                className="glass-button text-xs py-2 px-3"
              >
                Suggest
              </button>
            </div>
          </div>
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
        {/* Per-theme accent colour */}
        <div className="glass-strong rounded-2xl p-5 mt-3">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <p className="text-sm text-white/80">Accent colour — {themes.find(t => t.id === theme)?.name}</p>
              <p className="text-xs text-white/35">Recolours progress bars, rings and glows for this theme</p>
            </div>
            {accentOverride[theme] && (
              <button onClick={() => setAccentOverride(theme, null)} className="text-xs text-white/35 hover:text-white/70 px-2 shrink-0">
                Reset
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {ACCENT_PRESETS.map(hex => (
              <button
                key={hex}
                onClick={() => setAccentOverride(theme, hex)}
                title={hex}
                className={`w-8 h-8 rounded-full border-2 transition-all ${accentOverride[theme] === hex ? 'border-white scale-110' : 'border-white/15 hover:scale-105'}`}
                style={{ backgroundColor: hex }}
              />
            ))}
            <button
              onClick={() => accentRef.current?.click()}
              title="Custom colour"
              className="w-8 h-8 rounded-full border-2 border-dashed border-white/25 text-white/50 text-sm hover:border-white/50 transition-all"
            >
              +
            </button>
            <input
              ref={accentRef}
              type="color"
              value={accentOverride[theme] || '#9fd4ff'}
              onChange={e => setAccentOverride(theme, e.target.value)}
              className="sr-only"
            />
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h3 className="text-sm text-white/45 mb-3 tracking-wide">Pomodoro cycles</h3>
        <div className="glass-strong rounded-2xl p-5 grid grid-cols-2 gap-2.5">
          {([
            { key: 'focusMin', label: 'Focus length', suffix: 'min', max: 120 },
            { key: 'breakMin', label: 'Short break', suffix: 'min', max: 60 },
            { key: 'longBreakMin', label: 'Long break', suffix: 'min', max: 120 },
            { key: 'longEvery', label: 'Long break every', suffix: 'cycles', max: 12 },
          ] as const).map(f => (
            <label key={f.key} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
              <span className="text-xs text-white/45">{f.label}</span>
              <span className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={f.max}
                  value={pomodoro[f.key]}
                  onChange={e => setPomodoro({ [f.key]: parseInt(e.target.value, 10) } as any)}
                  className="w-14 bg-transparent text-sm text-right outline-none tabular-nums"
                />
                <span className="text-[10px] text-white/30">{f.suffix}</span>
              </span>
            </label>
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
        <p className="text-white/20 text-xs tracking-wide">BlackHole Focus v1.3</p>
        <p className="text-white/15 text-[11px]">Developer: <span className="text-white/30">Sam</span></p>
        <a
          href="https://github.com/sam0x001/BlackHoleFocus"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-white/25 text-[11px] hover:text-white/50 transition-colors no-drag"
        >
          github.com/sam0x001/BlackHoleFocus
        </a>
      </div>
    </div>
  )
}
