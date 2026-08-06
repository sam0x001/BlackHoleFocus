import { useStore } from '../store/useStore'
import ExcelJS from 'exceljs'

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export default function Analytics() {
  const { sessions } = useStore()

  const byDate: Record<string, typeof sessions> = {}
  sessions.forEach(s => {
    if (!byDate[s.date]) byDate[s.date] = []
    byDate[s.date].push(s)
  })
  const sortedDates = Object.keys(byDate).sort().reverse()

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Focus Sessions')

    sheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Category', key: 'category', width: 22 },
      { header: 'Duration (seconds)', key: 'seconds', width: 18 },
      { header: 'Duration', key: 'readable', width: 14 },
      { header: 'Note', key: 'note', width: 30 },
    ]

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }
    }

    sessions.forEach(s => {
      sheet.addRow({
        date: s.date,
        category: s.category,
        seconds: s.duration,
        readable: formatDuration(s.duration),
        note: s.note || ''
      })
    })

    const buffer = await workbook.xlsx.writeBuffer()

    if (window.electronAPI?.saveExcel) {
      const result = await window.electronAPI.saveExcel(
        Array.from(new Uint8Array(buffer as ArrayBuffer)),
        `focus-report-${new Date().toISOString().slice(0, 10)}.xlsx`
      )
      if (result.success) alert('Excel file saved successfully')
    } else {
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `focus-report-${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="h-full p-8 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-display font-semibold tracking-wide">Analytics</h2>
          <p className="text-white/40 text-sm mt-1">{sessions.length} sessions recorded</p>
        </div>
        <button onClick={exportExcel} className="glass-button text-sm">
          Export Excel
        </button>
      </div>

      {sortedDates.length === 0 ? (
        <div className="glass-strong rounded-2xl p-14 text-center">
          <p className="text-white/35">No sessions recorded yet</p>
        </div>
      ) : (
        <div className="space-y-5">
          {sortedDates.map(date => {
            const daySessions = byDate[date]
            const total = daySessions.reduce((sum, s) => sum + s.duration, 0)
            const label = new Date(date).toLocaleDateString('en-US', {
              weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
            })

            return (
              <div key={date} className="glass-strong rounded-2xl p-5">
                <div className="flex justify-between items-center mb-4 gap-3">
                  <h3 className="font-medium text-white/85 truncate">{label}</h3>
                  <span className="text-sm text-white/45 shrink-0">{formatDuration(total)}</span>
                </div>
                <div className="space-y-1.5">
                  {daySessions.map(s => (
                    <div
                      key={s.id}
                      className="flex justify-between items-center gap-3 py-2 px-3 rounded-xl bg-white/5"
                    >
                      <span className="text-sm text-white/75 truncate min-w-0">{s.category}</span>
                      <span className="text-xs text-white/40 shrink-0">{formatDuration(s.duration)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
