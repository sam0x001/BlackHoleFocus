import { useEffect, useState } from 'react'
import blackHoleBg from '../assets/blackhole.jpg'

export { blackHoleBg }

/**
 * Geometry of the background artwork, measured from the source image
 * (1244 x 700). The photon ring is a near-perfect circle, so the focus timer
 * can be locked to the centre of the event horizon at any window size.
 *
 *   horizon centre : (607.0, 353.5) px
 *   photon ring    : r = 165.1 px   (least-squares circle fit, mean err 0.43 px)
 *   horizon shadow : r = 222 px     (edge of the dark core)
 *
 * Positions are stored as fractions of the image so they survive any scaling.
 */
export const BG = {
  src: blackHoleBg,
  width: 1244,
  height: 700,
  /** Centre of the black hole as a fraction of the image box. */
  cx: 607.0 / 1244,
  cy: 353.5 / 700,
  /** Photon-ring radius, in source pixels. */
  ring: 165.1,
  /** Radius of the dark core (event-horizon shadow), in source pixels. */
  core: 222,
} as const

export interface BlackHoleLayout {
  /** Scale applied by `object-fit: cover`. */
  scale: number
  /** Top-left of the drawn image, in viewport pixels. */
  offsetX: number
  offsetY: number
  /** Centre of the black hole, in viewport pixels (= `position: fixed` coords). */
  centerX: number
  centerY: number
  /** Photon-ring radius in viewport pixels. */
  ringRadius: number
  /** Dark-core radius in viewport pixels. */
  coreRadius: number
  /** Current window size in CSS pixels. */
  viewportWidth: number
  viewportHeight: number
}

function measure(): BlackHoleLayout {
  const vw = typeof window === 'undefined' ? 1280 : window.innerWidth
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight
  // Same maths as `object-fit: cover` on a full-viewport image.
  const scale = Math.max(vw / BG.width, vh / BG.height)
  const offsetX = (vw - BG.width * scale) / 2
  const offsetY = (vh - BG.height * scale) / 2
  return {
    scale,
    offsetX,
    offsetY,
    centerX: offsetX + BG.cx * BG.width * scale,
    centerY: offsetY + BG.cy * BG.height * scale,
    ringRadius: BG.ring * scale,
    coreRadius: BG.core * scale,
    viewportWidth: vw,
    viewportHeight: vh,
  }
}

/** Live black-hole geometry for the current window size. */
export function useBlackHoleLayout(): BlackHoleLayout {
  const [layout, setLayout] = useState(measure)

  useEffect(() => {
    let frame = 0
    const onResize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setLayout(measure()))
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return layout
}