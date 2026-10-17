import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { localDateString, shiftDateString, daysBetween } from '../lib/date'
import { variance, stdDev, mean, median, trendPerDay, currentMonthDates } from '../lib/stats'
import { formatDuration, formatDurationShort, monthLabel } from '../lib/format'
import Toast from '../components/Toast'
import DatePicker from '../components/DatePicker'
import ExportModal from '../components/ExportModal'
import MonthPicker from '../components/MonthPicker'
import MonthChart, { ChartMode, DayPoint } from '../components/MonthChart'
import SessionEditRow from '../components/SessionEditRow'

function formatHours(seconds: number) {
  return (seconds / 3600).toFixed(1)
}

/** Day-groups rendered per page in the History list (feature #10). */
const HISTORY_PAGE_SIZE = 30

const CHART_MODES: { id: ChartMode; label: string }[] = [
  { id: 'bar', label: 'Bar' },
  { id: 'line', label: 'Line' },
  { id: 'sin', label: 'Sin' },
]

export default function Analytics() {
  const {
    sessions, theme, todayTotal, todayByCategory,
    restDays, removeRestDay, toggleRestDay, deleteSession, updateSession, categories
  } = useStore()
  const [toast, setToast] = useState<string | null>(null)
  const [restPick, setRestPick] = useState(() => localDateString())
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  // Inline session editing (duration / category / note)
  const [editingId, setEditingId] = useState<string | null>(null)
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
  const [historyPage, setHistoryPage] = useState(1)
  const [restHintDismissed, setRestHintDismissed] = useState(false)

  // Any change to the history filters jumps back to the first page
  useEffect(() => { setHistoryPage(1) }, [historyFilterDate, historyRangeFrom, historyRangeTo, showAllHistory])

  // Right-click menu on a chart day (bar mode) — mark / unmark Break Time
  const [chartMenu, setChartMenu] = useState<{ x: number; y: number; date: string } | null>(null)
  const [chartMenuClosing, setChartMenuClosing] = useState(false)
  const menuCloseTimer = useRef<number | null>(null)

  // Fade the menu out first, then unmount — used by scroll / outside click / Escape
  const closeChartMenu = useCallback(() => {
    if (menuCloseTimer.current !== null) return
    setChartMenuClosing(true)
    menuCloseTimer.current = window.setTimeout(() => {
      menuCloseTimer.current = null
      setChartMenu(null)
      setChartMenuClosing(false)
    }, 160)
  }, [])

  // Never leave a pending fade timer behind on unmount
  useEffect(() => () => {
    if (menuCloseTimer.current !== null) window.clearTimeout(menuCloseTimer.current)
  }, [])

  // Rest days ("Break Time") — excluded from every stat / chart / export row
  const restSet = useMemo(() => new Set(restDays), [restDays])

  // Months that contain recorded sessions or rest days ('YYYY-MM'), oldest first
  const monthKeys = useMemo(() => {
    const set = new Set<string>()
    sessions.forEach(s => set.add(s.date.slice(0, 7)))
    restDays.forEach(d => set.add(d.slice(0, 7)))
    return [...set].sort()
  }, [sessions, restDays])

  const currentMonthKey = localDateString().slice(0, 7)

  // Month chart: default to the current month when it has data, otherwise the
  // most recent month that does. Months without data cannot be selected.
  const [chartMonth, setChartMonth] = useState(() => {
    const fallback = monthKeys[monthKeys.length - 1] || currentMonthKey
    return monthKeys.includes(currentMonthKey) ? currentMonthKey : fallback
  })
  const [chartMode, setChartMode] = useState<ChartMode>('bar')

  // All days of the selected month (future days simply have no value)
  const chartPoints = useMemo(() => {
    const [yy, mm] = chartMonth.split('-').map(Number)
    const ref = new Date(yy, (mm || 1) - 1, 1)
    const map: Record<string, number> = {}
    sessions.forEach(s => {
      if (s.date.startsWith(chartMonth + '-')) {
        map[s.date] = (map[s.date] || 0) + s.duration
      }
    })
    return currentMonthDates(ref).map(date => ({
      date,
      day: Number(date.slice(8)),
      // Rest days are zeroed so they never contribute to the chart
      seconds: restSet.has(date) ? 0 : map[date] || 0,
      rest: restSet.has(date)
    }))
  }, [sessions, chartMonth, restSet])

  const chartDaysInMonth = chartPoints.length
  const chartDataDays = chartPoints.filter(p => p.seconds > 0)
  const chartTotalSeconds = chartDataDays.reduce((sum, p) => sum + p.seconds, 0)
  const chartMonthLabel = new Date(
    Number(chartMonth.slice(0, 4)),
    Number(chartMonth.slice(5, 7)) - 1,
    1
  ).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Open the chart context menu (Break Time toggle) at a viewport position
  const openChartMenu = (date: string, x: number, y: number) => {
    if (date > localDateString()) return
    const MENU_W = 210
    const MENU_H = 100
    // Cancel a pending fade-out if the user re-opens during the close animation
    if (menuCloseTimer.current !== null) {
      window.clearTimeout(menuCloseTimer.current)
      menuCloseTimer.current = null
    }
    setChartMenuClosing(false)
    setChartMenu({
      date,
      x: Math.max(8, Math.min(x, window.innerWidth - MENU_W)),
      y: Math.max(8, Math.min(y, window.innerHeight - MENU_H))
    })
  }

  const handleChartDayRightClick = (point: DayPoint, x: number, y: number) =>
    openChartMenu(point.date, x, y)

  // Drag-to-select on the bar chart feeds the Range statistics above
  const handleChartRangeSelect = (from: string, to: string) => {
    setRangeFrom(from)
    setRangeTo(to)
    setToast(`Range statistics set — ${from} → ${to}`)
  }

  // Close the chart context menu on scroll (smooth fade), outside click /
  // right-click / Escape. The opening event is stopped in the chart handler,
  // and the guards below (menu / chart hit-area targets) keep it from closing
  // immediately. capture: true catches scrolls from any inner scroll container.
  useEffect(() => {
    if (!chartMenu) return
    const isInside = (e: Event) => {
      const t = e.target as Element | null
      return !!t?.closest?.('[data-bh-chart-menu]') || !!t?.closest?.('.bh-chart-day-hit')
    }
    const onClick = (e: MouseEvent) => { if (!isInside(e)) closeChartMenu() }
    const onCtx = (e: MouseEvent) => { if (!isInside(e)) closeChartMenu() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeChartMenu() }
    const onScroll = () => closeChartMenu()
    window.addEventListener('click', onClick)
    window.addEventListener('contextmenu', onCtx)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => {
      window.removeEventListener('click', onClick)
      window.removeEventListener('contextmenu', onCtx)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, { capture: true })
    }
  }, [chartMenu, closeChartMenu])

  const todayCatTotal = Object.values(todayByCategory).reduce((a, b) => a + b, 0) || 1

  // Sessions grouped by date (newest first), plus a per-day seconds total used
  // by the heatmap and the trend series. Declared *before* the memos below that
  // close over them — dependency arrays are evaluated during render, so a
  // later const would be a temporal-dead-zone crash.
  const byDate: Record<string, typeof sessions> = {}
  const secondsByDate: Record<string, number> = {}
  sessions.forEach(s => {
    if (!byDate[s.date]) byDate[s.date] = []
    byDate[s.date].push(s)
    secondsByDate[s.date] = (secondsByDate[s.date] || 0) + s.duration
  })
  const sortedDates = Object.keys(byDate).sort().reverse()

  // History paging (#10) — the list is windowed to HISTORY_PAGE_SIZE day-groups
  const filteredHistoryDates = useMemo(() => {
    if (showAllHistory) return sortedDates
    if (historyFilterDate) return sortedDates.filter(d => d === historyFilterDate)
    if (historyRangeFrom && historyRangeTo) {
      return sortedDates.filter(d => d >= historyRangeFrom && d <= historyRangeTo)
    }
    return sortedDates
  }, [sortedDates, showAllHistory, historyFilterDate, historyRangeFrom, historyRangeTo])

  const totalHistoryDays = filteredHistoryDates.length
  const historyPageCount = Math.max(1, Math.ceil(totalHistoryDays / HISTORY_PAGE_SIZE))
  const currentPage = Math.min(historyPage, historyPageCount)
  const pageDates = filteredHistoryDates.slice(
    (currentPage - 1) * HISTORY_PAGE_SIZE,
    currentPage * HISTORY_PAGE_SIZE
  )

  // Hour-of-day histogram: sessions grouped by local start hour (break days excluded)
  const hourlyTotals = useMemo(() => {
    const buckets = new Array(24).fill(0)
    sessions.forEach(s => {
      if (restSet.has(s.date) || !Number.isFinite(s.createdAt)) return
      const h = new Date(s.createdAt).getHours()
      buckets[h] += s.duration || 0
    })
    return buckets as number[]
  }, [sessions, restSet])

  // Year heatmap data: daily totals + rest flags for the chart month's year
  const heatmapWeeks = useMemo(() => {
    const year = Number(chartMonth.slice(0, 4))
    const jan1 = new Date(year, 0, 1)
    const lead = jan1.getDay() // 0 = Sunday
    const cells: { date: string; seconds: number; rest: boolean; inYear: boolean }[] = []
    const cursor = new Date(year, 0, 1 - lead)
    while (cursor.getFullYear() < year || (cursor.getFullYear() === year)) {
      const key = localDateString(cursor)
      const inYear = cursor.getFullYear() === year
      const rest = inYear && restSet.has(key)
      cells.push({
        date: key,
        seconds: inYear && !rest ? (secondsByDate[key] || 0) : 0,
        rest,
        inYear
      })
      cursor.setDate(cursor.getDate() + 1)
      if (cursor.getFullYear() > year) break
      // Cap at 53 full weeks
      if (cells.length >= 53 * 7) break
    }
    // Pad the trailing week
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1]
      cells.push({ date: last.date, seconds: 0, rest: false, inYear: false })
    }
    const weeks: typeof cells[] = []
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
    return weeks
  }, [chartMonth, secondsByDate, restSet])

  const rangeDurations = useMemo(() => {
    const map: Record<string, number> = {}
    sessions.forEach(s => {
      // Rest days are excluded from range statistics
      if (s.date >= rangeFrom && s.date <= rangeTo && !restSet.has(s.date)) {
        map[s.date] = (map[s.date] || 0) + s.duration
      }
    })
    return Object.values(map)
  }, [sessions, rangeFrom, rangeTo, restSet])

  const stats = useMemo(() => {
    const total = rangeDurations.reduce((a, b) => a + b, 0)
    // Previous period of identical length, ending the day before rangeFrom
    const spanDays = daysBetween(rangeFrom, rangeTo) + 1
    const prevTo = shiftDateString(rangeFrom, -1)
    const prevFrom = shiftDateString(prevTo, -(spanDays - 1))
    const prevDurMap: Record<string, number> = {}
    sessions.forEach(s => {
      if (s.date >= prevFrom && s.date <= prevTo && !restSet.has(s.date)) {
        prevDurMap[s.date] = (prevDurMap[s.date] || 0) + s.duration
      }
    })
    const prevTotal = Object.values(prevDurMap).reduce((a, b) => a + b, 0)
    // Trend slope: one value per calendar day in the range (0 for empty days)
    const dailySeries: number[] = []
    for (let d = rangeFrom; d <= rangeTo; d = shiftDateString(d, 1)) {
      // Break days contribute nothing to the trend
      dailySeries.push(restSet.has(d) ? 0 : secondsByDate[d] || 0)
    }
    return {
      mean: mean(rangeDurations),
      median: median(rangeDurations),
      variance: variance(rangeDurations),
      stdDev: stdDev(rangeDurations),
      days: rangeDurations.length,
      total,
      trend: trendPerDay(dailySeries),
      prevTotal,
      prevFrom,
      prevTo
    }
  }, [rangeDurations, sessions, rangeFrom, rangeTo, restSet, secondsByDate])

  // Rest days inside the selected range (shown as an extra stat)
  const breakDaysInRange = useMemo(
    () => restDays.filter(d => d >= rangeFrom && d <= rangeTo).length,
    [restDays, rangeFrom, rangeTo]
  )

  /** Break-day nudge (#4): when no Break Time is marked in the last 10+ days,
   *  pick the weekday with the lightest focus load over the past 4 weeks and
   *  offer its most recent occurrence as the next break day. */
  const restSuggestion = useMemo(() => {
    const today = localDateString()
    const lastRest = restDays.length ? [...restDays].sort().slice(-1)[0] : null
    const gap = lastRest ? daysBetween(lastRest, today) : null
    if (gap !== null && gap <= 10) return null

    const sums = [0, 0, 0, 0, 0, 0, 0]
    let trackedSeconds = 0
    let focusDays = 0
    for (let i = 27; i >= 0; i--) {
      const date = shiftDateString(today, -i)
      if (restDays.includes(date)) continue
      const secs = secondsByDate[date] || 0
      if (secs > 0) focusDays++
      trackedSeconds += secs
      sums[new Date(`${date}T00:00:00`).getDay()] += secs
    }
    // Not enough signal yet to call any weekday "light"
    if (trackedSeconds <= 0 || focusDays < 5) return null

    let best = -1
    for (let wd = 0; wd < 7; wd++) {
      if (sums[wd] <= 0) continue
      if (best === -1 || sums[wd] < sums[best]) best = wd
    }
    if (best === -1) return null

    // Most recent occurrence of that weekday that isn't a break day already
    for (let i = 0; i <= 7; i++) {
      const date = shiftDateString(today, -i)
      if (new Date(`${date}T00:00:00`).getDay() === best && !restDays.includes(date)) return { date, gap }
    }
    return null
  }, [restDays, secondsByDate])

  const progressGradient =
    theme === 'void'
      ? 'linear-gradient(90deg, #38bdf8, #7dd3fc)'
      : theme === 'pulse'
      ? 'linear-gradient(90deg, #a855f7, #c084fc)'
      : 'linear-gradient(90deg, #3b82f6, #60a5fa)'

  const exportExcel = async (mode: 'summary' | 'detailed') => {
    const ExcelJS = (await import('exceljs')).default
    const workbook = new ExcelJS.Workbook()

    // One worksheet per month ("March 2026"), containing that month's sessions
    // plus a "Break Time" row for every marked rest day (excluded from stats).
    const months = new Set<string>()
    sessions.forEach(s => months.add(s.date.slice(0, 7)))
    restDays.forEach(d => months.add(d.slice(0, 7)))
    const sortedMonths = [...months].sort()

    for (const month of sortedMonths) {
      const sheet = workbook.addWorksheet(monthLabel(month))
      const monthSessions = sessions.filter(s => s.date.startsWith(`${month}-`))
      const monthRestDays = new Set(restDays.filter(d => d.startsWith(`${month}-`)))
      const allDates = Array.from(new Set([
        ...monthSessions.map(s => s.date),
        ...monthRestDays
      ])).sort()

      if (mode === 'summary') {
        // Daily Summary Mode: One row per day, aggregated by category
        sheet.columns = [
          { header: 'Date', key: 'date', width: 14 },
          { header: 'Details', key: 'details', width: 50 },
          { header: 'Duration (secs)', key: 'seconds', width: 18 },
          { header: 'Duration', key: 'readable', width: 18 },
          { header: 'Notes', key: 'notes', width: 40 },
        ]

        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }

        allDates.forEach(date => {
          if (monthRestDays.has(date)) {
            // Rest day — zeroed row; any sessions it holds are excluded from stats
            const excluded = monthSessions.filter(s => s.date === date)
            const details = excluded
              .map(s => `${s.category}: ${formatDuration(s.duration)}`)
              .join(' | ')
            sheet.addRow({
              date,
              details: 'Break Time',
              seconds: 0,
              readable: 'Break Time',
              notes: details ? `Excluded from stats: ${details}` : ''
            })
            return
          }
          const catEntries = Object.entries(
            monthSessions
              .filter(s => s.date === date)
              .reduce<Record<string, { duration: number; notes: string[] }>>((acc, s) => {
                if (!acc[s.category]) acc[s.category] = { duration: 0, notes: [] }
                acc[s.category].duration += s.duration
                if (s.note) acc[s.category].notes.push(s.note)
                return acc
              }, {})
          )
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

        allDates.forEach((date, dateIndex) => {
          if (monthRestDays.has(date)) {
            // Rest day — its sessions are excluded from stats; show a single Break Time row
            const excluded = monthSessions.filter(s => s.date === date)
            sheet.addRow({
              date,
              category: 'Break Time',
              seconds: 0,
              readable: 'Break Time',
              note: excluded.length
                ? `Excluded from stats (${excluded.length} session${excluded.length === 1 ? '' : 's'})`
                : 'Excluded from stats'
            })
          } else {
            // Sort by creation time within each date for chronological order
            monthSessions
              .filter(s => s.date === date)
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
          }
          // Add empty row between dates (except after last date)
          if (dateIndex < allDates.length - 1) {
            sheet.addRow({ date: '', category: '', seconds: '', readable: '', note: '' })
          }
        })
      }
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
            <p className="text-xs text-white/40 tracking-wide uppercase mb-1 flex items-center gap-2">
              Today
              {restSet.has(localDateString()) && <span className="bh-rest-badge">Break Time</span>}
            </p>
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

      {/* Monthly chart — selectable month, all days of the month */}
      <div className="glass-strong rounded-2xl p-5 mb-5 transition-all duration-300">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm text-white/50 mb-1 tracking-wide">{chartMonthLabel} — Focus</h3>
            <p className="text-[10px] text-white/25">
              {chartDataDays.length === 0
                ? 'No focus time recorded this month yet'
                : `${chartDataDays.length} of ${chartDaysInMonth} days with data · ${formatDuration(chartTotalSeconds)} total`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <MonthPicker value={chartMonth} onChange={setChartMonth} availableMonths={monthKeys} />
            <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
              {CHART_MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => setChartMode(m.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs capitalize transition-all no-drag
                    ${chartMode === m.id
                      ? 'bg-white/15 text-white border border-white/20'
                      : 'text-white/45 hover:text-white/80 hover:bg-white/5'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <MonthChart
          points={chartPoints}
          daysInMonth={chartDaysInMonth}
          theme={theme}
          mode={chartMode}
          onDayRightClick={handleChartDayRightClick}
          onRangeSelect={handleChartRangeSelect}
        />
        <p className="text-[10px] text-white/25 mt-2">
          Drag across the chart to set the Range statistics below · right-click a day to toggle Break Time
        </p>
      </div>

      {/* Range stats */}
      <div className="glass-strong rounded-2xl p-5 mb-5 transition-all duration-300">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-sm text-white/50 tracking-wide">Range statistics</h3>
          {(() => {
            const delta = stats.prevTotal > 0 ? ((stats.total - stats.prevTotal) / stats.prevTotal) * 100 : null
            if (delta === null) return null
            const up = delta >= 0
            return (
              <span className={`text-xs px-2.5 py-1 rounded-full tabular-nums ${up ? 'bg-emerald-400/10 text-emerald-300' : 'bg-red-400/10 text-red-300'}`}>
                {up ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}% vs previous period
              </span>
            )
          })()}
        </div>
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
            { label: 'Break days (excluded)', value: String(breakDaysInRange) },
            { label: 'Total', value: formatDuration(stats.total) },
            { label: 'Mean / day', value: formatDuration(Math.round(stats.mean)) },
            { label: 'Median / day', value: formatDuration(Math.round(stats.median)) },
            {
              label: 'Trend',
              value: stats.trend === 0
                ? 'steady'
                : `${stats.trend > 0 ? '+' : '−'}${formatDurationShort(Math.abs(Math.round(stats.trend)))}/day`
            },
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

      {/* Break Time — manage rest days (excluded from stats) */}
      <div className="glass-strong rounded-2xl p-5 mb-5 transition-all duration-300">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm text-white/50 tracking-wide">Break Time</h3>
            <span className="bh-rest-badge">{restDays.length} marked</span>
          </div>
          <div className="flex items-center gap-2">
            <DatePicker
              value={restPick}
              onChange={setRestPick}
              max={localDateString()}
              className="w-44"
            />
            <button
              onClick={() => {
                toggleRestDay(restPick)
                setToast(restDays.includes(restPick) ? 'Break day removed' : 'Day marked as Break Time')
              }}
              className={`glass-button text-sm shrink-0 ${restDays.includes(restPick) ? 'text-red-300/70 hover:text-red-300' : 'text-white/85'}`}
            >
              {restDays.includes(restPick) ? 'Unmark break' : 'Mark as break'}
            </button>
          </div>
        </div>
        <p className="text-xs text-white/30 mb-4">
          Rest days are excluded from statistics, charts and reports — or right-click a day in the bar chart to toggle it
        </p>
        {restSuggestion && !restHintDismissed && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.07] px-4 py-3">
            <p className="text-xs text-emerald-100/70">
              {restSuggestion.gap === null
                ? "You've never marked a break day."
                : `It's been ${restSuggestion.gap} day${restSuggestion.gap === 1 ? '' : 's'} since your last break.`}{" "}
              {new Date(`${restSuggestion.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' })} has been your
              lightest focus day lately — take it as one?
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => {
                  toggleRestDay(restSuggestion.date)
                  setToast('Suggested day marked as Break Time')
                }}
                className="glass-button text-xs text-emerald-200"
              >
                Mark {new Date(`${restSuggestion.date}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} as break
              </button>
              <button
                onClick={() => setRestHintDismissed(true)}
                className="px-2 text-xs text-white/35 hover:text-white/70 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {restDays.length === 0 ? (
          <p className="text-white/30 text-sm">No rest days marked yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {[...restDays].sort().reverse().map(d => (
              <button
                key={d}
                onClick={() => {
                  removeRestDay(d)
                  setToast('Break day removed')
                }}
                title="Click to remove this break day"
                className="bh-rest-chip"
              >
                {new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                <span className="ml-1 opacity-50">×</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Year heatmap + focus rhythm */}
      <div className="glass-strong rounded-2xl p-5 mb-5 transition-all duration-300">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm text-white/50 tracking-wide">Year in focus — {chartMonth.slice(0, 4)}</h3>
          <div className="flex items-center gap-3 text-[10px] text-white/30">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-white/10 inline-block" /> idle</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400/70 inline-block" /> break</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'var(--bh-accent, #9fd4ff)' }} /> focus</span>
          </div>
        </div>
        <div className="flex gap-[3px] overflow-x-auto pb-1">
          {heatmapWeeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px] shrink-0">
              {week.map((cell, di) => (
                <div
                  key={`${wi}-${di}`}
                  title={cell.inYear ? (cell.rest ? `${cell.date} — Break Time` : `${cell.date} — ${formatDurationShort(cell.seconds)}`) : ''}
                  onContextMenu={e => {
                    if (!cell.inYear || cell.date > localDateString()) return
                    e.preventDefault()
                    e.stopPropagation()
                    const x = Math.min(window.innerWidth - 200, e.clientX)
                    const y = Math.min(window.innerHeight - 120, e.clientY)
                    openChartMenu(cell.date, x, y)
                  }}
                  className="w-3 h-3 rounded-[3px] transition-transform hover:scale-125"
                  style={{
                    background: !cell.inYear
                      ? 'transparent'
                      : cell.rest
                        ? 'rgba(52,211,153,0.7)'
                        : cell.seconds <= 0
                          ? 'rgba(255,255,255,0.08)'
                          : `rgba(var(--bh-accent, 159,212,255), ${Math.min(1, 0.25 + (cell.seconds / 7200) * 0.75)})`
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-white/25 mt-3">Right-click any day to toggle Break Time</p>
      </div>

      {/* Focus rhythm — when during the day */}
      <div className="glass-strong rounded-2xl p-5 mb-5 transition-all duration-300">
        <h3 className="text-sm text-white/50 mb-1 tracking-wide">Focus rhythm</h3>
        <p className="text-[10px] text-white/25 mb-4">Sessions grouped by start hour — break days excluded</p>
        {(() => {
          const max = Math.max(1, ...hourlyTotals)
          return (
            <div className="flex items-end gap-1 h-28">
              {hourlyTotals.map((secs, h) => (
                <div key={h} className="flex-1 flex flex-col items-center justify-end h-full gap-1 group relative">
                  <span className="absolute -top-1 hidden group-hover:block text-[10px] text-white/70 bg-black/70 rounded px-1.5 py-0.5 tabular-nums whitespace-nowrap z-10">
                    {String(h).padStart(2, '0')}:00 · {formatDurationShort(secs)}
                  </span>
                  <div
                    className="w-full rounded-sm transition-all"
                    style={{
                      height: `${Math.max(secs > 0 ? 4 : 2, (secs / max) * 100)}%`,
                      background: secs > 0 ? 'var(--bh-accent, #9fd4ff)' : 'rgba(255,255,255,0.08)',
                      opacity: secs > 0 ? 0.85 : 1
                    }}
                  />
                  <span className={`text-[9px] tabular-nums ${h % 3 === 0 ? 'text-white/30' : 'text-transparent'}`}>{h}</span>
                </div>
              ))}
            </div>
          )
        })()}
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
            {showAllHistory && sortedDates.length > HISTORY_PAGE_SIZE && (
              <p className="text-[10px] text-white/25">
                {sortedDates.length} days of history — {HISTORY_PAGE_SIZE} per page, use filters to narrow down
              </p>
            )}
          </div>

          {/* History list */}
          <div className="space-y-5">
            {pageDates.map(date => {
              const daySessions = byDate[date]
              const total = daySessions.reduce((sum, s) => sum + s.duration, 0)
              const [yy, mm, dd] = date.split('-').map(Number)
              const label = new Date(yy, mm - 1, dd).toLocaleDateString('en-US', {
                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
              })
              return (
                <div key={date} className="glass-strong rounded-2xl p-5 transition-all duration-300">
                  <div className="flex justify-between items-center mb-4 gap-3">
                    <h3 className="font-medium text-white/85 truncate flex items-center gap-2">
                      {label}
                      {restSet.has(date) && <span className="bh-rest-badge">Break Time</span>}
                    </h3>
                    <span className={`text-sm shrink-0 ${restSet.has(date) ? 'text-emerald-300/70' : 'text-white/45'}`}>
                      {restSet.has(date) ? 'Excluded from stats' : formatDuration(total)}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {daySessions.map(s => editingId === s.id ? (
                      <SessionEditRow
                        key={s.id}
                        initialMinutes={String(Math.round(s.duration / 60 * 10) / 10)}
                        initialCategory={s.category}
                        initialNote={s.note || ''}
                        categories={categories.map(c => c.name)}
                        onCancel={() => setEditingId(null)}
                        onSave={async (patch) => {
                          await updateSession(s.id, patch)
                          setEditingId(null)
                          setToast('Session updated')
                        }}
                      />
                    ) : (
                      <div
                        key={s.id}
                        className={`flex justify-between items-center gap-3 py-2 px-3 rounded-xl ${restSet.has(date) ? 'bg-emerald-500/[0.06] border border-emerald-400/15' : 'bg-white/5'}`}
                      >
                        <div className="min-w-0 flex-1">
                          <span className={`block text-sm truncate ${restSet.has(date) ? 'text-emerald-100/75' : 'text-white/75'}`}>{s.category}</span>
                          {s.note && <span className="block text-[11px] text-white/35 truncate">{s.note}</span>}
                        </div>
                        <span className={`text-xs shrink-0 ${restSet.has(date) ? 'text-emerald-300/60' : 'text-white/40'}`}>
                          {formatDuration(s.duration)}
                          {restSet.has(date) ? ' · excluded' : ''}
                        </span>
                        <button
                          onClick={() => { setEditingId(s.id); setConfirmDeleteId(null) }}
                          title="Edit this session"
                          className="shrink-0 text-xs px-2 py-1 rounded-lg text-white/25 hover:text-white/80 hover:bg-white/5 transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (confirmDeleteId === s.id) {
                              deleteSession(s.id)
                              setConfirmDeleteId(null)
                            } else {
                              setConfirmDeleteId(s.id)
                            }
                          }}
                          onBlur={() => setConfirmDeleteId(prev => (prev === s.id ? null : prev))}
                          title="Delete this session"
                          className={`shrink-0 text-xs px-2 py-1 rounded-lg transition-all ${confirmDeleteId === s.id ? 'bg-red-500/25 text-red-200' : 'text-white/25 hover:text-red-400 hover:bg-white/5'}`}
                        >
                          {confirmDeleteId === s.id ? 'Delete?' : '✕'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {totalHistoryDays > HISTORY_PAGE_SIZE && (
              <div className="glass-strong flex items-center justify-between gap-3 rounded-2xl px-5 py-3 transition-all duration-300">
                <button
                  onClick={() => setHistoryPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="glass-button text-xs px-3 py-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ‹ Newer days
                </button>
                <p className="text-xs text-white/40 tabular-nums">
                  Page {currentPage} of {historyPageCount} · {totalHistoryDays} days
                </p>
                <button
                  onClick={() => setHistoryPage(currentPage + 1)}
                  disabled={currentPage >= historyPageCount}
                  className="glass-button text-xs px-3 py-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Older days ›
                </button>
              </div>
            )}
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

      {/* Chart day context menu — mark / unmark a day as Break Time */}
      {chartMenu && (
        <div
          data-bh-chart-menu
          className={`fixed z-[300] glass-strong rounded-xl p-1.5 w-48 shadow-2xl transition-all duration-150 ease-out ${
            chartMenuClosing
              ? 'opacity-0 -translate-y-1 scale-[0.98] pointer-events-none'
              : 'opacity-100 translate-y-0 scale-100'
          }`}
          style={{ left: chartMenu.x, top: chartMenu.y }}
          onClick={e => e.stopPropagation()}
          onContextMenu={e => { e.preventDefault(); e.stopPropagation() }}
        >
          <p className="px-2.5 pt-1.5 pb-2 mb-1 text-[10px] uppercase tracking-wider text-white/40 border-b border-white/10">
            {new Date(`${chartMenu.date}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <button
            onClick={() => {
              toggleRestDay(chartMenu.date)
              setToast(restSet.has(chartMenu.date) ? 'Break day removed' : 'Day marked as Break Time')
              closeChartMenu()
            }}
            className="w-full text-left px-2.5 py-2 rounded-lg text-sm text-white/85 hover:bg-white/10 transition-colors flex items-center gap-2.5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            {restSet.has(chartMenu.date) ? 'Remove Break Time' : 'Mark as Break Time'}
          </button>
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
