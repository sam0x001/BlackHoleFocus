import { useId } from 'react'

interface Props {
  /**
   * Fill of the wave, 0..1. `null` means "no fixed target" (stopwatch): the
   * whole wave is drawn and the flow animation runs indefinitely.
   */
  progress: number | null
  accent: string
  accentDeep: string
  accentSoft: string
  /** True while the timer is actually running — drives the flow animation. */
  running?: boolean
  /** Small caption under the left end (e.g. elapsed time). */
  labelLeft?: string
  /** Small caption under the right end (e.g. target time). */
  labelRight?: string
  /** Accessible description. */
  ariaLabel?: string
}

// ---- Geometry (viewBox units) ----
const W = 640
const H = 120
const MID = H / 2
const AMP = 16
const WAVELENGTH = 128
const STEP = 4

function waveY(x: number) {
  return MID + AMP * Math.sin((x / WAVELENGTH) * Math.PI * 2)
}

/**
 * The wave is sampled from the same `waveY()` used for the head marker, so the
 * dot always sits exactly on the line (a hand-written bezier approximation
 * would drift away from it). It extends one wavelength past both ends so the
 * flowing dashes never pop in or out at the edges.
 */
const WAVE_PATH = (() => {
  const parts: string[] = []
  for (let x = -WAVELENGTH; x <= W + WAVELENGTH; x += STEP) {
    parts.push(`${parts.length === 0 ? 'M' : 'L'}${x} ${waveY(x).toFixed(2)}`)
  }
  return parts.join(' ')
})()

export default function WavyTimeline({
  progress,
  accent,
  accentDeep,
  accentSoft,
  running = false,
  labelLeft,
  labelRight,
  ariaLabel = 'Session timeline'
}: Props) {
  // useId() returns characters (":") that are invalid inside url(#…)
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const clamped = progress === null ? 1 : Math.min(1, Math.max(0, progress))
  const filled = clamped > 0
  const headX = clamped * W
  const headY = waveY(headX)

  return (
    <div className="w-full select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id={`${uid}-grad`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={accentDeep} />
            <stop offset="100%" stopColor={accent} />
          </linearGradient>
          <clipPath id={`${uid}-clip`}>
            <rect x="0" y="0" width={clamped * W} height={H} />
          </clipPath>
          <filter id={`${uid}-glow`} x="-40%" y="-120%" width="180%" height="340%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* End ticks — the visible start / finish of the linear timeline */}
        <line x1="1.5" y1={MID - 26} x2="1.5" y2={MID + 26} stroke="rgba(255,255,255,0.16)" strokeWidth="2" strokeLinecap="round" />
        <line x1={W - 1.5} y1={MID - 26} x2={W - 1.5} y2={MID + 26} stroke="rgba(255,255,255,0.16)" strokeWidth="2" strokeLinecap="round" />

        {/* Dim track */}
        <path
          d={WAVE_PATH}
          fill="none"
          stroke="rgba(255,255,255,0.09)"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Filled part of the wave (clipped to progress — no dash maths) */}
        <g clipPath={`url(#${uid}-clip)`}>
          <path
            d={WAVE_PATH}
            fill="none"
            stroke={`url(#${uid}-grad)`}
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Energy flowing along the wave */}
          <path
            d={WAVE_PATH}
            fill="none"
            stroke={accentSoft}
            strokeOpacity="0.8"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="2 22"
            className={running ? 'bh-wave-flow' : undefined}
          />
        </g>

        {/* Head marker */}
        {progress !== null && filled && (
          <circle
            cx={headX}
            cy={headY}
            r="6"
            fill={accent}
            filter={`url(#${uid}-glow)`}
            className={running ? 'bh-wave-head' : undefined}
          />
        )}
      </svg>

      {(labelLeft || labelRight) && (
        <div className="flex items-center justify-between mt-1 px-0.5 text-[10px] tabular-nums text-white/30 tracking-wide">
          <span>{labelLeft}</span>
          <span>{labelRight}</span>
        </div>
      )}
    </div>
  )
}
