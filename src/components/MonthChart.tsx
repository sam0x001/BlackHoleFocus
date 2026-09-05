import { Theme } from '../store/useStore'

export type ChartMode = 'bar' | 'line' | 'sin'

export interface DayPoint {
  date: string
  day: number
  seconds: number
}

interface Props {
  /** Every day of the month, in order; days without data carry seconds = 0 */
  points: DayPoint[]
  daysInMonth: number
  theme: Theme
  mode: ChartMode
}

// ---- SVG geometry (viewBox units) ----
const W = 940
const H = 320
const ML = 52
const MR = 14
const MT = 18
const MB = 26
const PW = W - ML - MR
const PH = H - MT - MB
const BASE_Y = MT + PH

const ACCENT: Record<Theme, string> = { void: '#38bdf8', pulse: '#a855f7', neon: '#3b82f6' }
const ACCENT_SOFT: Record<Theme, string> = { void: '#7dd3fc', pulse: '#c084fc', neon: '#60a5fa' }
const TREND_COLOR = '#34d399'

// ---- Helpers ----
function hours(seconds: number) {
  return seconds / 3600
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/** Compact human duration from an hour count, e.g. 1.5 -> "1h 30m" */
function compactHours(h: number) {
  if (h <= 0) return '0s'
  const totalSec = Math.round(h * 3600)
  const hh = Math.floor(totalSec / 3600)
  const mm = Math.floor((totalSec % 3600) / 60)
  const ss = totalSec % 60
  if (hh > 0) return mm > 0 ? `${hh}h ${mm}m` : `${hh}h`
  if (mm > 0) return ss > 0 ? `${mm}m ${ss}s` : `${mm}m`
  return `${ss}s`
}

function formatTick(h: number) {
  if (h === 0) return '0'
  if (h < 1) return `${Math.round(h * 60)}m`
  return `${h}h`
}

/** Pick an axis step so the scale has at most 8 intervals */
function niceStep(maxV: number) {
  const steps = [0.25, 0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24]
  for (const s of steps) {
    if (Math.ceil(maxV / s) <= 8) return s
  }
  return 24
}

interface XY {
  x: number
  y: number
}

/**
 * Smooth wavy curve that passes exactly through every data point
 * (chordal Catmull-Rom, sampled as cubic beziers). It follows the real
 * daily values instead of an independent sine fit, so days without data
 * stay untouched and the curve only spans the recorded days.
 */
function buildSmoothPath(points: XY[]): string {
  const n = points.length
  if (n === 0) return ''
  if (n === 1) return `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  if (n === 2) {
    return `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}L${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`
  }

  // Chordal parameterization so big day-gaps don't create phantom waves
  const param = [0]
  for (let i = 1; i < n; i++) {
    param.push(param[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y))
  }

  const tangent = (i: number): XY => {
    const prev = i === 0 ? points[0] : points[i - 1]
    const next = i === n - 1 ? points[n - 1] : points[i + 1]
    const dt =
      i === 0 ? param[1] - param[0]
      : i === n - 1 ? param[n - 1] - param[n - 2]
      : param[i + 1] - param[i - 1]
    return { x: (next.x - prev.x) / dt, y: (next.y - prev.y) / dt }
  }

  const clampY = (y: number) => Math.max(MT + 1, Math.min(BASE_Y - 1, y))
  const out: string[] = [`M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`]
  for (let i = 0; i < n - 1; i++) {
    const dt = param[i + 1] - param[i]
    const t0 = tangent(i)
    const t1 = tangent(i + 1)
    const c1 = { x: points[i].x + (dt / 3) * t0.x, y: points[i].y + (dt / 3) * t0.y }
    const c2 = { x: points[i + 1].x - (dt / 3) * t1.x, y: points[i + 1].y - (dt / 3) * t1.y }
    const p0 = points[i]
    const p3 = points[i + 1]
    for (let s = 1; s <= 20; s++) {
      const u = s / 20
      const u1 = 1 - u
      const bx = u1 * u1 * u1 * p0.x + 3 * u1 * u1 * u * c1.x + 3 * u1 * u * u * c2.x + u * u * u * p3.x
      const by = u1 * u1 * u1 * p0.y + 3 * u1 * u1 * u * c1.y + 3 * u1 * u * u * c2.y + u * u * u * p3.y
      out.push(`L${bx.toFixed(2)} ${clampY(by).toFixed(2)}`)
    }
  }
  return out.join(' ')
}

export default function MonthChart({ points, daysInMonth, theme, mode }: Props) {
  const positive = points.filter(p => p.seconds > 0)

  // No data at all in this month -> friendly placeholder at same aspect ratio
  if (positive.length === 0) {
    return (
      <div
        className="w-full flex items-center justify-center rounded-xl border border-white/5 bg-white/[0.02]"
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        <p className="text-white/30 text-sm">No focus time recorded this month yet</p>
      </div>
    )
  }

  const xAt = (day: number) => ML + (day - 0.5) * (PW / daysInMonth)
  const slot = PW / daysInMonth

  const dataHours = positive.map(p => hours(p.seconds))

  // Vertical domain: real data with a little headroom for the smooth curve
  const domainMax = Math.max(...dataHours, 0) * 1.15
  const step = niceStep(domainMax)
  const yMax = Math.max(step, Math.ceil(domainMax / step) * step)
  const yAt = (h: number) => BASE_Y - (Math.min(Math.max(h, 0), yMax) / yMax) * PH

  const ticks: number[] = []
  for (let v = 0; v <= yMax + 1e-9; v += step) ticks.push(v)

  const barWidth = Math.max(2, Math.min(26, slot * 0.55))
  const accent = ACCENT[theme]
  const accentSoft = ACCENT_SOFT[theme]

  const linePath = positive
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(p.day).toFixed(2)} ${yAt(hours(p.seconds)).toFixed(2)}`)
    .join(' ')

  const areaPath =
    positive.length > 1
      ? `${linePath} L${xAt(positive[positive.length - 1].day).toFixed(2)} ${BASE_Y} L${xAt(positive[0].day).toFixed(2)} ${BASE_Y} Z`
      : ''

  // Sin curve: smooth wavy line threaded exactly through the recorded days
  let curvePath = ''
  if (mode === 'sin' && positive.length > 0) {
    curvePath = buildSmoothPath(positive.map(p => ({ x: xAt(p.day), y: yAt(hours(p.seconds)) })))
  }

  // Dashed growth line: connects the first recorded day to the latest recorded
  // day (so it follows the month's real direction), extended to month end with
  // the trend arrow when data stops before the month is over.
  let trendPath = ''
  let showProjection = false
  let projectedHours = 0
  if (mode === 'sin' && positive.length >= 2) {
    const first = positive[0]
    const last = positive[positive.length - 1]
    const startH = hours(first.seconds)
    const endH = hours(last.seconds)
    const spanDays = last.day - first.day
    const perDay = spanDays > 0 ? (endH - startH) / spanDays : 0
    let d = `M${xAt(first.day).toFixed(2)} ${yAt(startH).toFixed(2)} L${xAt(last.day).toFixed(2)} ${yAt(endH).toFixed(2)}`
    if (last.day < daysInMonth) {
      projectedHours = Math.max(0, endH + perDay * (daysInMonth - last.day))
      d += ` L${xAt(daysInMonth).toFixed(2)} ${yAt(projectedHours).toFixed(2)}`
      showProjection = true
    }
    trendPath = d
  }

  const showLabels = positive.length <= 10

  // Table (bottom-right, sin mode): last few recorded days + projected month end
  const tableRows = mode === 'sin' ? positive.slice(-7) : []
  const showTable = mode === 'sin' && (tableRows.length > 0 || showProjection)

  let lastLabeledX = -Infinity

  return (
    <div className="w-full flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" role="img" aria-label={`Focus time chart (${mode} mode)`}>
      <defs>
        <linearGradient id={`bh-bar-${theme}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accentSoft} />
          <stop offset="100%" stopColor={accent} stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id={`bh-area-${theme}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.16" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
        <filter id="bh-sin-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <marker id="bh-trend-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill={TREND_COLOR} />
        </marker>
      </defs>

      {/* Horizontal grid + Y labels */}
      {ticks.map(v => {
        const y = yAt(v)
        return (
          <g key={v}>
            <line x1={ML} y1={y} x2={ML + PW} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={ML - 7} y={y + 3.5} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.4)">
              {formatTick(v)}
            </text>
          </g>
        )
      })}

      {/* Base axis */}
      <line x1={ML} y1={BASE_Y} x2={ML + PW} y2={BASE_Y} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

      {/* Bar mode */}
      {mode === 'bar' && positive.map(p => {
        const h = hours(p.seconds)
        const barH = Math.max(2, BASE_Y - yAt(h))
        return (
          <g key={p.date}>
            <title>{`${p.date}: ${formatDuration(p.seconds)}`}</title>
            <rect
              x={xAt(p.day) - barWidth / 2}
              y={BASE_Y - barH}
              width={barWidth}
              height={barH}
              rx={1.5}
              fill={`url(#bh-bar-${theme})`}
            />
          </g>
        )
      })}

      {/* Line mode */}
      {mode === 'line' && positive.length > 0 && (
        <>
          {areaPath && <path d={areaPath} fill={`url(#bh-area-${theme})`} />}
          <path d={linePath} fill="none" stroke={accent} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          {positive.map(p => (
            <g key={p.date}>
              <title>{`${p.date}: ${formatDuration(p.seconds)}`}</title>
              <circle cx={xAt(p.day)} cy={yAt(hours(p.seconds))} r="3.2" fill={accent} stroke="#050508" strokeWidth="1.2" />
            </g>
          ))}
        </>
      )}

      {/* Sin mode */}
      {mode === 'sin' && (
        <>
          {curvePath && (
            <>
              <path d={curvePath} fill="none" stroke={accent} strokeOpacity="0.35" strokeWidth="8" strokeLinecap="round" filter="url(#bh-sin-glow)" />
              <path d={curvePath} fill="none" stroke={accentSoft} strokeWidth="2.4" strokeLinecap="round" />
            </>
          )}
          {trendPath && (
            <path d={trendPath} fill="none" stroke={TREND_COLOR} strokeWidth="1.6" strokeDasharray="5 4" strokeLinecap="round" markerEnd="url(#bh-trend-arrow)" opacity="0.85" />
          )}
          {positive.map(p => {
            const cx = xAt(p.day)
            const cy = yAt(hours(p.seconds))
            const showText = showLabels && cx - lastLabeledX >= 30
            if (showText) lastLabeledX = cx
            const above = cy - 34 >= MT + 4
            const ty = above ? cy - 12 : cy + 22
            return (
              <g key={p.date}>
                <title>{`${p.date}: ${formatDuration(p.seconds)}`}</title>
                <circle cx={cx} cy={cy} r="3.4" fill={accent} stroke="#050508" strokeWidth="1.4" />
                {showText && (
                  <text
                    x={cx}
                    y={ty}
                    textAnchor="middle"
                    fontSize="9.5"
                    fill="rgba(255,255,255,0.85)"
                    fontWeight="600"
                  >
                    <tspan x={cx} dy={above ? 0 : -11}>Day {p.day}</tspan>
                    <tspan x={cx} dy={11} fill="rgba(255,255,255,0.45)" fontWeight="400">
                      {compactHours(hours(p.seconds))}
                    </tspan>
                  </text>
                )}
              </g>
            )
          })}
        </>
      )}

      {/* X labels — every day of the month */}
      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
        <text key={d} x={xAt(d)} y={H - 7} textAnchor="middle" fontSize="9.5" fill="rgba(255,255,255,0.4)">
          {d}
        </text>
      ))}

        </svg>
      </div>

      {/* Sin-mode daily summary — dedicated panel beside the chart so it never covers the curve */}
      {showTable && (
        <div className="hidden md:flex shrink-0 w-[170px] flex-col rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-xl self-start">
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/10">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">Day</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">Hours</span>
          </div>
          <div className="px-3.5 py-1.5">
            {tableRows.map((p, i) => (
              <div
                key={p.date}
                className={`flex items-center justify-between py-[5px] text-xs ${i === tableRows.length - 1 && !showProjection ? '' : 'border-b border-white/[0.05]'}`}
              >
                <span className="text-white/45 tabular-nums">{p.day}</span>
                <span className="text-white/85 tabular-nums">{compactHours(hours(p.seconds))}</span>
              </div>
            ))}
          </div>
          {showProjection && (
            <div className="px-3.5 py-2 border-t border-dashed border-white/10">
              <p className="text-[11px] tabular-nums" style={{ color: TREND_COLOR }}>
                ≈ {compactHours(projectedHours)} · Day {daysInMonth}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
