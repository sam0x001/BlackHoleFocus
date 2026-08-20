/** Population variance of numbers */
export function variance(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
}

export function stdDev(values: number[]): number {
  return Math.sqrt(variance(values))
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** Group session durations by local date (seconds per day) */
export function dailyTotals(
  sessions: { date: string; duration: number }[],
  fromDate: string,
  toDate: string
): { date: string; seconds: number }[] {
  const map: Record<string, number> = {}
  sessions.forEach(s => {
    if (s.date >= fromDate && s.date <= toDate) {
      map[s.date] = (map[s.date] || 0) + s.duration
    }
  })
  return Object.keys(map)
    .sort()
    .map(date => ({ date, seconds: map[date] }))
}

/** Last N days including today as YYYY-MM-DD local */
export function lastNDates(n: number, end: Date = new Date()): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(d.getDate() - i)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    out.push(`${y}-${m}-${day}`)
  }
  return out
}

/** Days of current calendar month */
export function currentMonthDates(ref: Date = new Date()): string[] {
  const y = ref.getFullYear()
  const m = ref.getMonth()
  const days = new Date(y, m + 1, 0).getDate()
  const out: string[] = []
  for (let d = 1; d <= days; d++) {
    out.push(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return out
}
