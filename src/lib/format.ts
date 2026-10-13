/**
 * Canonical duration / date formatting shared across the app.
 * (Previously duplicated — slightly differently — in five components.)
 */

/** Full duration: "1h 2m 3s", "2m 3s", "3s". */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/** Compact duration (no seconds once a minute is reached): "1h 2m", "2m", "45s". */
export function formatDurationShort(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${Math.max(0, Math.round(seconds))}s`
}

/** Clock display: "HH:MM:SS". */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** 'YYYY-MM' → 'March 2026' (used to name the per-month Excel sheets). */
export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  if (!y || !m) return monthKey
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
