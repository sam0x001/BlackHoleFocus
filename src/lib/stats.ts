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

/** Median value (robust to outliers). */
export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Least-squares slope of a daily series — seconds gained (+) or lost (−)
 * per day. Callers pass one value per calendar day (0 for empty days).
 */
export function trendPerDay(daily: number[]): number {
  const n = daily.length
  if (n < 2) return 0
  const mx = (n - 1) / 2
  const my = daily.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  daily.forEach((y, x) => {
    num += (x - mx) * (y - my)
    den += (x - mx) ** 2
  })
  return den === 0 ? 0 : num / den
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

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Consecutive days with focus time, ending today (or yesterday when today has
 * no sessions yet). Marked rest days are skipped: they neither count toward
 * the streak nor break it.
 */
export function currentStreak(
  sessions: { date: string; duration: number }[],
  restDays: string[] = []
): number {
  const active = new Set(sessions.filter(s => s.duration > 0).map(s => s.date))
  const rest = new Set(restDays)
  const cursor = new Date()
  let streak = 0
  for (let i = 0; i < 3660; i++) {
    const key = ymd(cursor)
    if (rest.has(key)) {
      cursor.setDate(cursor.getDate() - 1)
      continue
    }
    if (active.has(key)) {
      streak++
    } else if (i === 0) {
      // Today simply hasn't happened yet — the streak survives it.
    } else {
      break
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}
