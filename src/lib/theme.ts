/**
 * Theme palettes.
 *
 * The app ships with three themes:
 *   Void  — the default. Its background is the built-in black-hole artwork and
 *           CANNOT be changed by the user. The palette below is sampled from
 *           that artwork: hue ≈ 220 for the disk body, near-white for the
 *           photon ring, faint lavender in the hottest highlights.
 *   Pulse — cold purple, with a user-supplied background image.
 *   Neon  — electric blue, with a user-supplied background image.
 *
 * Palettes are published as CSS variables (see `applyThemeVariables`) so the
 * shared glass / button / nav / chart styles in index.css follow the active
 * theme — and so a per-theme accent override recolours the WHOLE app, not just
 * two gradients.
 *
 * IMPORTANT: `--bh-accent` is an "r, g, b" triplet (used inside rgba()), while
 * `--bh-accent-solid` is a real colour. Never use the triplet where a colour is
 * expected — that is what made the Focus rhythm bars and the countdown ring
 * invisible.
 */
import { useStore, type Theme } from '../store/useStore'
import { BG } from './blackhole'

export interface ThemePalette {
  name: string
  description: string
  /** Main accent (disk highlights for Void). Always readable on the dark bg. */
  accent: string
  /** `accent` as an "r, g, b" triplet, for use inside rgba(). */
  accentRgb: string
  /** Deeper shade of the accent, for gradients and weight. */
  accentDeep: string
  accentDeepRgb: string
  /** Near-white tint used for highlights and the photon ring. */
  accentSoft: string
  accentSoftRgb: string
  /** Page background behind the artwork layer. */
  bg: string
  /** Inline-style gradient for progress bars. */
  gradient: string
  /** rgba() glow for box-shadows / text-shadows. */
  glow: string
  /** rgba() glow behind the brand mark. */
  logoGlow: string
}

export const PALETTES: Record<Theme, ThemePalette> = {
  void: {
    name: 'Void',
    description: 'Black-hole artwork with ice-blue accents',
    accent: '#9fd4ff',
    accentRgb: '159, 212, 255',
    accentDeep: '#4d9fd6',
    accentDeepRgb: '77, 159, 214',
    accentSoft: '#dceeff',
    accentSoftRgb: '220, 238, 255',
    bg: '#04060d',
    gradient: 'linear-gradient(90deg, #4d9fd6, #9fd4ff)',
    glow: 'rgba(159, 212, 255, 0.35)',
    logoGlow: 'rgba(159, 212, 255, 0.55)'
  },
  pulse: {
    name: 'Pulse',
    description: 'Cold purple, electric energy',
    accent: '#c084fc',
    accentRgb: '192, 132, 252',
    accentDeep: '#a855f7',
    accentDeepRgb: '168, 85, 247',
    accentSoft: '#e9d5ff',
    accentSoftRgb: '233, 213, 255',
    bg: '#08050f',
    gradient: 'linear-gradient(90deg, #a855f7, #c084fc)',
    glow: 'rgba(192, 132, 252, 0.35)',
    logoGlow: 'rgba(192, 132, 252, 0.55)'
  },
  neon: {
    name: 'Neon',
    description: 'Electric blue, cyber edge',
    accent: '#60a5fa',
    accentRgb: '96, 165, 250',
    accentDeep: '#3b82f6',
    accentDeepRgb: '59, 130, 246',
    accentSoft: '#bfdbfe',
    accentSoftRgb: '191, 219, 254',
    bg: '#050510',
    gradient: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
    glow: 'rgba(96, 165, 250, 0.35)',
    logoGlow: 'rgba(96, 165, 250, 0.55)'
  }
}

/** Selection order used by the sidebar/settings pickers. */
export const THEME_ORDER: Theme[] = ['void', 'pulse', 'neon']

/** Themes whose background the user is allowed to replace. */
export const CUSTOMISABLE_THEMES: Theme[] = ['pulse', 'neon']

export function isCustomisable(theme: Theme) {
  return theme !== 'void'
}

/** Built-in fallback for themes with no custom image installed. */
export const FALLBACK_BACKGROUND: Record<Theme, string> = {
  void: `radial-gradient(ellipse 80% 60% at 50% 40%, rgba(159,212,255,0.15), transparent 60%), ${PALETTES.void.bg}`,
  pulse: `radial-gradient(ellipse 80% 60% at 50% 40%, rgba(168,85,247,0.18), transparent 60%), ${PALETTES.pulse.bg}`,
  neon: `radial-gradient(ellipse 80% 60% at 50% 40%, rgba(59,130,246,0.18), transparent 60%), ${PALETTES.neon.bg}`
}

/** The artwork that backs the Void theme (locked — not user-replaceable). */
export const VOID_BACKDROP = BG.src

// ---------- Colour maths ----------

type RGB = [number, number, number]

function parseHex(hex: string): RGB | null {
  if (typeof hex !== 'string') return null
  const h = hex.replace('#', '').trim()
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex([r, g, b]: RGB): string {
  return `#${[r, g, b]
    .map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('')}`
}

function triplet([r, g, b]: RGB): string {
  return `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`
}

function mix(from: RGB, to: RGB, t: number): RGB {
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t
  ]
}

/** WCAG relative luminance (0 = black, 1 = white). */
function luminance([r, g, b]: RGB): number {
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/**
 * Lift a too-dark accent toward white until it is visible on the near-black
 * background. Without this a user could pick e.g. #101010 and every bar, ring
 * and glow in the app would silently disappear.
 */
export function ensureReadableAccent(hex: string, minLuminance = 0.16): string {
  const rgb = parseHex(hex)
  if (!rgb) return PALETTES.void.accent
  let current = rgb
  for (let i = 0; i < 14 && luminance(current) < minLuminance; i++) {
    current = mix(current, [255, 255, 255], 0.18)
  }
  return toHex(current)
}

/** #rrggbb → "r, g, b" (for rgba() usage). */
export function hexToRgb(hex: string): string {
  const rgb = parseHex(hex)
  return rgb ? triplet(rgb) : PALETTES.void.accentRgb
}

/** Replace the accent of a palette with a custom hex colour. */
export function withAccent(base: ThemePalette, hex: string): ThemePalette {
  const safe = ensureReadableAccent(hex)
  const normal = parseHex(safe) as RGB
  const deep = mix(normal, [0, 0, 0], 0.28)
  const soft = mix(normal, [255, 255, 255], 0.62)
  return {
    ...base,
    accent: toHex(normal),
    accentRgb: triplet(normal),
    accentDeep: toHex(deep),
    accentDeepRgb: triplet(deep),
    accentSoft: toHex(soft),
    accentSoftRgb: triplet(soft),
    gradient: `linear-gradient(90deg, ${toHex(deep)}, ${toHex(normal)})`,
    glow: `rgba(${triplet(normal)}, 0.35)`,
    logoGlow: `rgba(${triplet(normal)}, 0.55)`
  }
}

/** Palette of the currently selected theme (honours a per-theme accent override). */
export function usePalette(): ThemePalette {
  const theme = useStore(s => s.theme)
  const override = useStore(s => s.accentOverride?.[theme] ?? null)
  const base = PALETTES[theme]
  return override ? withAccent(base, override) : base
}

/** Resolve the effective palette (base + optional accent override) for a theme. */
export function effectivePalette(theme: Theme, override?: string | null): ThemePalette {
  return override ? withAccent(PALETTES[theme], override) : PALETTES[theme]
}

/**
 * Publish the palette as CSS variables on <html> so the shared glass, button,
 * nav, scrollbar and chart styles in index.css always match the active
 * (possibly overridden) accent.
 *
 * Both forms are published on purpose: `--bh-accent` is a triplet for rgba(),
 * `--bh-accent-solid` is a real colour for plain `color` / `background` / SVG
 * `stroke` / `fill`.
 */
export function applyThemeVariables(palette: ThemePalette) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--bh-bg', palette.bg)
  root.style.setProperty('--bh-accent', palette.accentRgb)
  root.style.setProperty('--bh-accent-solid', palette.accent)
  root.style.setProperty('--bh-accent-deep', palette.accentDeepRgb)
  root.style.setProperty('--bh-accent-deep-solid', palette.accentDeep)
  root.style.setProperty('--bh-accent-soft', palette.accentSoftRgb)
  root.style.setProperty('--bh-accent-soft-solid', palette.accentSoft)
  root.style.setProperty('--bh-ring', palette.accentSoftRgb)
}
