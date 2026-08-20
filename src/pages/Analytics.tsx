import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { localDateString } from '../lib/date'
import { variance, stdDev, mean, currentMonthDates } from '../lib/stats'
import Toast from '../components/Toast'
import DatePicker from '../components/DatePicker'
import ExportModal from '../components/ExportModal'

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatHours(seconds: number) {
  return (seconds / 3600).toFixed(1)
}

export default function Analytics() {
  const { sessions, theme, todayTotal, todayByCategory } = useStore()
  const [toast, setToast] = useState<string | null>(null)
  const [rangeFrom, setRangeFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return localDateString(d)
  })
  const [rangeTo, setRangeTo] = useState(() => localDateString())
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [historyFilterDate, setHistoryFilterDate] = useState<string | null>(null)
  const [showAllHistory, setShowAllHistory] = useState(true)
  const [historyRangeFrom, setHistoryRangeFrom] = useState<string | null>(null)
  const [historyRangeTo, setHistoryRangeTo] = useState<string | null>(null)

  const today = localDateString()
  // Month chart: from day 1 through today only (incomplete month still shows data)
  const monthDays = useMemo(() => {
    return currentMonthDates().filter(d => d <= today)
  }, [today])

  const monthData = useMemo(() => {
    const map: Record<string, number> = {}
    sessions.forEach(s => {
      map[s.date] = (map[s.date] || 0) + s.duration
    })
    return monthDays.map(date => ({ date, seconds: map[date] || 0 }))
  }, [sessions, monthDays])

  const maxMonth = Math.max(...monthData.map(d => d.seconds), 1)
  const todayCatTotal = Object.values(todayByCategory).reduce((a, b) => a + b, 0) || 1

  const rangeDurations = useMemo(() => {
    const map: Record<string, number> = {}
    sessions.forEach(s => {
      if (s.date >= rangeFrom && s.date <= rangeTo) {
        map[s.date] = (map[s.date] || 0) + s.duration
      }
    })
    return Object.values(map)
  }, [sessions, rangeFrom, rangeTo])

  const stats = useMemo(() => ({
    mean: mean(rangeDurations),
    variance: variance(rangeDurations),
    stdDev: stdDev(rangeDurations),
    days: rangeDurations.length,
    total: rangeDurations.reduce((a, b) => a + b, 0)
  }), [rangeDurations])

  const byDate: Record<string, typeof sessions> = {}
  sessions.forEach(s => {
    if (!byDate[s.date]) byDate[s.date] = []
    byDate[s.date].push(s)
  })
  const sortedDates = Object.keys(byDate).sort().reverse()
  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const barGradient =
    theme === 'void'
      ? 'linear-gradient(180deg, #7dd3fc, #38bdf8aa)'
      : theme === 'pulse'
      ? 'linear-gradient(180deg, #c084fc, #a855f7aa)'
      : 'linear-gradient(180deg, #60a5fa, #3b82f6aa)'

  const progressGradient =
    theme === 'void'
      ? 'linear-gradient(90deg, #38bdf8, #7dd3fc)'
      : theme === 'pulse'
      ? 'linear-gradient(90deg, #a855f7, #c084fc)'
      : 'linear-gradient(90deg, #3b82f6, #60a5fa)'

  const exportExcel = async (mode: 'summary' | 'detailed') => {
    const ExcelJS = (await import('exceljs')).default
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Focus Sessions')

    if (mode === 'summary') {
      // Daily Summary Mode: One row per day, aggregated by category
      sheet.columns = [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Details', key: 'details', width: 50 },
        { header: 'Duration (secs)', key: 'seconds', width: 18 },
        { header: 'Duration', key: 'readable', width: 18 },
        { header: 'Notes', key: 'notes', width: 40 },
      ]

      // Group sessions by date, then by category
      const byDate: Record<string, Record<string, { duration: number; notes: string[] }>> = {}
      sessions.forEach(s => {
        if (!byDate[s.date]) byDate[s.date] = {}
        if (!byDate[s.date][s.category]) {
          byDate[s.date][s.category] = { duration: 0, notes: [] }
        }
        byDate[s.date][s.category].duration += s.duration
        if (s.note) byDate[s.date][s.category].notes.push(s.note)
      })

      const sortedDates = Object.keys(byDate).sort()

      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }

      sortedDates.forEach(date => {
        const categories = byDate[date]
        const catEntries = Object.entries(categories)
        const details = catEntries
          .map(([cat, data]) => `${cat}: ${formatDuration(data.duration)}`)
          .join(' | ')
        const totalSeconds = catEntries.reduce((sum, [, data]) => sum + data.duration, 0)
        const allNotes = catEntries.flatMap(([cat, data]) =>
          data.notes.map(n => `${cat}: ${n}`)
        ).join(' | ')

        sheet.addRow({
          date,
          details,
          seconds: totalSeconds,
          readable: formatDuration(totalSeconds),
          notes: allNotes
        })
      })
    } else {
      // Detailed Mode: One row per session, ordered by creation time, empty row between dates
      sheet.columns = [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Category', key: 'category', width: 22 },
        { header: 'Duration (seconds)', key: 'seconds', width: 18 },
        { header: 'Duration', key: 'readable', width: 14 },
        { header: 'Note', key: 'note', width: 30 },
      ]

      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }

      const byDate: Record<string, typeof sessions> = {}
      sessions.forEach(s => {
        if (!byDate[s.date]) byDate[s.date] = []
        byDate[s.date].push(s)
      })
      const sortedDates = Object.keys(byDate).sort()

      sortedDates.forEach((date, dateIndex) => {
        // Sort by creation time within each date for chronological order
        byDate[date]
          .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
          .forEach(s => {
            sheet.addRow({
              date: s.date,
              category: s.category,
              seconds: s.duration,
              readable: formatDuration(s.duration),
              note: s.note || ''
            })
          })
        // Add empty row between dates (except after last date)
        if (dateIndex < sortedDates.length - 1) {
          sheet.addRow({ date: '', category: '', seconds: '', readable: '', note: '' })
        }
      })
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `focus-report-${localDateString()}.xlsx`
    if (window.electronAPI?.saveExcel) {
      const result = await window.electronAPI.saveExcel(
        Array.from(new Uint8Array(buffer as ArrayBuffer)),
        filename
      )
      if (result.success) setToast('Excel report saved successfully')
      else setToast(`Export failed: ${result.error}`)
    } else {
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      setToast('Excel report downloaded')
    }
  }

  return (
    <div className="h-full p-8 overflow-y-auto">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-wide">Analytics</h2>
          <p className="text-white/40 text-sm mt-1">{sessions.length} sessions recorded</p>
        </div>
        <button onClick={() => setExportModalOpen(true)} className="glass-button text-sm shrink-0">Export Excel</button>
      </div>

      {/* Today — top */}
      <div className="glass-strong rounded-2xl p-5 mb-5 transition-all duration-300">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <p className="text-xs text-white/40 tracking-wide uppercase mb-1">Today</p>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">
              {formatDuration(todayTotal)}
            </p>
          </div>
          <p className="text-xs text-white/30">
            {Object.keys(todayByCategory).length} categor{Object.keys(todayByCategory).length === 1 ? 'y' : 'ies'}
          </p>
        </div>
        {Object.keys(todayByCategory).length === 0 ? (
          <p className="text-white/30 text-sm text-center py-2">No focus time today yet</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(todayByCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, secs]) => {
                const percent = Math.round((secs / todayCatTotal) * 100)
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-sm mb-1.5 gap-2">
                      <span className="text-white/80 truncate">{cat}</span>
                      <span className="text-white/40 shrink-0 text-xs tabular-nums">
                        {formatDuration(secs)} · {percent}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${percent}%`, background: progressGradient }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {/* Monthly chart — days 1..today */}
      <div className="glass-strong rounded-2xl p-5 mb-5 transition-all duration-300">
        <h3 className="text-sm text-white/50 mb-1 tracking-wide">{monthLabel} — Focus</h3>
        <p className="text-[10px] text-white/25 mb-4">
          Day 1 – {monthDays.length} (so far this month)
        </p>
        <div className="flex items-end gap-[3px] h-32">
          {monthData.map(d => (
            <div
              key={d.date}
              className="flex-1 flex flex-col justify-end min-w-0 h-full"
              title={`${d.date}: ${formatDuration(d.seconds)}`}
            >
              <div
                className="w-full rounded-t-sm transition-all duration-500"
                style={{
                  height: `${Math.max(d.seconds > 0 ? 4 : 2, (d.seconds / maxMonth) * 100)}%`,
                  background: d.seconds > 0 ? barGradient : 'rgba(255,255,255,0.05)'
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-white/30">
          <span>1</span>
          <span>{Math.ceil(monthDays.length / 2) || ''}</span>
          <span>{monthDays.length}</span>
        </div>
      </div>

      {/* Range stats */}
      <div className="glass-strong rounded-2xl p-5 mb-5 transition-all duration-300">
        <h3 className="text-sm text-white/50 mb-3 tracking-wide">Range statistics</h3>
        <div className="flex gap-4 items-end mb-4">
          <DatePicker
            label="From"
            value={rangeFrom}
            onChange={setRangeFrom}
            max={rangeTo}
            className="flex-1"
          />
          <DatePicker
            label="To"
            value={rangeTo}
            onChange={setRangeTo}
            min={rangeFrom}
            max={localDateString()}
            className="flex-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Days with data', value: String(stats.days) },
            { label: 'Total', value: formatDuration(stats.total) },
            { label: 'Mean / day', value: formatDuration(Math.round(stats.mean)) },
            { label: 'Std deviation', value: formatDuration(Math.round(stats.stdDev)) },
            { label: 'Variance', value: `${formatHours(stats.variance)} h²` },
            { label: 'Variance (sec²)', value: Math.round(stats.variance).toLocaleString() },
          ].map(item => (
            <div key={item.label} className="bg-white/5 rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-white/35 mb-0.5">{item.label}</p>
              <p className="text-sm text-white/85 tabular-nums">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      {sortedDates.length === 0 ? (
        <div className="glass-strong rounded-2xl p-14 text-center">
          <p className="text-white/35">No sessions recorded yet</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* History filter controls */}
          <div className="glass-strong rounded-2xl p-4 transition-all duration-300">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 className="text-sm text-white/50 tracking-wide">History</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAllHistory(!showAllHistory)}
                  className={`glass-button text-xs px-3 py-1.5 transition-all ${
                    showAllHistory
                      ? 'bg-white/15 text-white border border-white/20'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {showAllHistory ? 'Showing All' : 'Filter Active'}
                </button>
                {!showAllHistory && (
                  <button
                    onClick={() => {
                      setHistoryFilterDate(null)
                      setHistoryRangeFrom(null)
                      setHistoryRangeTo(null)
                      setShowAllHistory(true)
                    }}
                    className="text-white/40 hover:text-white/70 text-xs px-2"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            {!showAllHistory && (
              <div className="space-y-3">
                {/* Single date jump */}
                <div className="flex gap-3 items-end">
                  <DatePicker
                    label="Jump to date"
                    value={historyFilterDate || ''}
                    onChange={(val) => {
                      setHistoryFilterDate(val)
                      setHistoryRangeFrom(null)
                      setHistoryRangeTo(null)
                    }}
                    max={localDateString()}
                    className="flex-1 max-w-xs"
                  />
                  {historyFilterDate && (
                    <p className="text-white/30 text-sm self-end mb-1">
                      Showing sessions for {historyFilterDate}
                    </p>
                  )}
                </div>
                {/* Range filter */}
                <div className="flex gap-3 items-end">
                  <DatePicker
                    label="From"
                    value={historyRangeFrom || ''}
                    onChange={(val) => {
                      setHistoryRangeFrom(val)
                      setHistoryFilterDate(null)
                    }}
                    max={historyRangeTo || localDateString()}
                    className="flex-1"
                  />
                  <DatePicker
                    label="To"
                    value={historyRangeTo || ''}
                    onChange={(val) => {
                      setHistoryRangeTo(val)
                      setHistoryFilterDate(null)
                    }}
                    min={historyRangeFrom || undefined}
                    max={localDateString()}
                    className="flex-1"
                  />
                  {historyRangeFrom && historyRangeTo && (
                    <p className="text-white/30 text-sm self-end mb-1 shrink-0">
                      {historyRangeFrom} → {historyRangeTo}
                    </p>
                  )}
                </div>
                {!historyFilterDate && !historyRangeFrom && !historyRangeTo && (
                  <p className="text-[10px] text-white/25">Pick a date or range to filter history</p>
                )}
              </div>
            )}
            {showAllHistory && sortedDates.length > 30 && (
              <p className="text-[10px] text-white/25">
                {sortedDates.length} days of history — use filters to narrow down
              </p>
            )}
          </div>

          {/* History list */}
          <div className="space-y-5">
            {(
              showAllHistory
                ? sortedDates
                : historyFilterDate
                ? sortedDates.filter(d => d === historyFilterDate)
                : historyRangeFrom && historyRangeTo
                ? sortedDates.filter(d => d >= historyRangeFrom && d <= historyRangeTo)
                : sortedDates
            ).map(date => {
              const daySessions = byDate[date]
              const total = daySessions.reduce((sum, s) => sum + s.duration, 0)
              const [yy, mm, dd] = date.split('-').map(Number)
              const label = new Date(yy, mm - 1, dd).toLocaleDateString('en-US', {
                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
              })
              return (
                <div key={date} className="glass-strong rounded-2xl p-5 transition-all duration-300">
                  <div className="flex justify-between items-center mb-4 gap-3">
                    <h3 className="font-medium text-white/85 truncate">{label}</h3>
                    <span className="text-sm text-white/45 shrink-0">{formatDuration(total)}</span>
                  </div>
                  <div className="space-y-1.5">
                    {daySessions.map(s => (
                      <div key={s.id} className="flex justify-between items-center gap-3 py-2 px-3 rounded-xl bg-white/5">
                        <span className="text-sm text-white/75 truncate min-w-0">{s.category}</span>
                        <span className="text-xs text-white/40 shrink-0">{formatDuration(s.duration)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {!showAllHistory && historyFilterDate && !sortedDates.includes(historyFilterDate) && (
              <div className="glass-strong rounded-2xl p-8 text-center">
                <p className="text-white/40">No sessions recorded for {historyFilterDate}</p>
              </div>
            )}
            {!showAllHistory && historyRangeFrom && historyRangeTo && !historyFilterDate && (
              <div className="glass-strong rounded-2xl p-8 text-center">
                {sortedDates.filter(d => d >= historyRangeFrom && d <= historyRangeTo).length === 0 ? (
                  <p className="text-white/40">No sessions recorded from {historyRangeFrom} to {historyRangeTo}</p>
                ) : (
                  <p className="text-white/30 text-sm">
                    Showing sessions from {historyRangeFrom} to {historyRangeTo}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={exportExcel}
      />
    </div>
  )
}
