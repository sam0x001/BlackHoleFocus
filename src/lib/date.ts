/** Local calendar date as YYYY-MM-DD (not UTC). */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Shift a YYYY-MM-DD string by N days (negative = past). */
export function shiftDateString(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const ref = new Date(y, (m || 1) - 1, d || 1)
  ref.setDate(ref.getDate() + days)
  return localDateString(ref)
}

/** Whole days from a → b (b - a; positive when b is later). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const da = new Date(ay, (am || 1) - 1, ad || 1).getTime()
  const db = new Date(by, (bm || 1) - 1, bd || 1).getTime()
  return Math.round((db - da) / 86400000)
}
