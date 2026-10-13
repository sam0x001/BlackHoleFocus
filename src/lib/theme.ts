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
 * glass/button styles in index.css follow the active theme.
 */
import { useStore, type Theme } from '../store/useStore'
import { BG } from './blackhole'

export interface ThemePalette {
  name: string
  description: string
  /** Main accent (disk highlights for Void). */
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
  /** Tailwind class fragments (complete strings so the JIT keeps them). */
  navActive: string
  fieldBorder: string
  fieldRing: string
  fieldGlow: string
  /** Selection ring / solid + soft accent fills (used by the export dialog). */
  ringActive: string
  bgSoft: string
  bgSolid: string
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
    logoGlow: 'rgba(159, 212, 255, 0.55)',
    navActive: 'bg-sky-300/10 text-sky-100 border-sky-300/25',
    fieldBorder: 'border-sky-300/15 hover:border-sky-300/30 focus:border-sky-300/45',
    fieldRing: 'focus:ring-sky-300/20',
    fieldGlow: 'hover:shadow-[0_0_12px_rgba(159,212,255,0.35)]',
    ringActive: 'ring-sky-300/30',
    bgSoft: 'bg-sky-300/12',
    bgSolid: 'bg-sky-300',
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
    logoGlow: 'rgba(192, 132, 252, 0.55)',
    navActive: 'bg-purple-400/15 text-purple-200 border-purple-400/25',
    fieldBorder: 'border-purple-400/20 hover:border-purple-400/40 focus:border-purple-400/50',
    fieldRing: 'focus:ring-purple-400/20',
    fieldGlow: 'hover:shadow-[0_0_12px_rgba(192,132,252,0.4)]',
    ringActive: 'ring-purple-400/30',
    bgSoft: 'bg-purple-400/15',
    bgSolid: 'bg-purple-400',
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
    logoGlow: 'rgba(96, 165, 250, 0.55)',
    navActive: 'bg-blue-400/15 text-blue-200 border-blue-400/25',
    fieldBorder: 'border-blue-400/20 hover:border-blue-400/40 focus:border-blue-400/50',
    fieldRing: 'focus:ring-blue-400/20',
    fieldGlow: 'hover:shadow-[0_0_12px_rgba(96,165,250,0.4)]',
    ringActive: 'ring-blue-400/30',
    bgSoft: 'bg-blue-400/15',
    bgSolid: 'bg-blue-400',
  },
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
  neon: `radial-gradient(ellipse 80% 60% at 50% 40%, rgba(59,130,246,0.18), transparent 60%), ${PALETTES.neon.bg}`,
}

/** The artwork that backs the Void theme (locked — not user-replaceable). */
export const VOID_BACKDROP = BG.src

/** Palette of the currently selected theme (honours a per-theme accent override). */
export function usePalette(): ThemePalette {
  const theme = useStore(s => s.theme)
  const override = useStore(s => s.accentOverride?.[theme] ?? null)
  const base = PALETTES[theme]
  return override ? withAccent(base, override) : base
}

/** #rrggbb → "r, g, b" (for rgba() usage). */
export function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return '159, 212, 255'
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

/** Replace the accent of a palette with a custom hex colour. */
export function withAccent(base: ThemePalette, hex: string): ThemePalette {
  const rgb = hexToRgb(hex)
  return {
    ...base,
    accent: hex,
    accentRgb: rgb,
    accentDeep: hex,
    accentDeepRgb: rgb,
    gradient: `linear-gradient(90deg, ${hex}b3, ${hex})`,
    glow: `rgba(${rgb}, 0.35)`,
    logoGlow: `rgba(${rgb}, 0.55)`
  }
}

/** Resolve the effective palette (base + optional accent override) for a theme. */
export function effectivePalette(theme: Theme, override?: string | null): ThemePalette {
  return override ? withAccent(PALETTES[theme], override) : PALETTES[theme]
}

/**
 * Publish the palette as CSS variables on <html> so the shared glass, button
 * and scrollbar styles in index.css always match the active theme.
 */
export function applyThemeVariables(palette: ThemePalette) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--bh-bg', palette.bg)
  root.style.setProperty('--bh-accent', palette.accentRgb)
  root.style.setProperty('--bh-accent-deep', palette.accentDeepRgb)
  root.style.setProperty('--bh-ring', palette.accentSoftRgb)
}