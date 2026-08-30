import { watch } from 'vue'
import { prefsState, savePreferences, type CustomThemeConfig } from '@/composables/usePreferencesStore'
import type { ThemeId, PresetThemeId, ThemeMode, VisualIntensity, CornerStyle } from '@/composables/themeTypes'

export type { ThemeId, PresetThemeId, ThemeMode, VisualIntensity, CornerStyle }

export interface ThemeMeta {
  id: PresetThemeId
  emoji: string
  label: string
  tagline: string
}

export const THEME_LIST: ThemeMeta[] = [
  { id: 'lavender', emoji: '💜', label: 'Lavender', tagline: "L'ambiance d'origine de Nook." },
  { id: 'soft-pink', emoji: '🌸', label: 'Soft Pink', tagline: 'Poudré, cosy, lumineux.' },
  { id: 'gothic', emoji: '🌙', label: 'Gothic', tagline: 'Élégant, mystérieux, feutré.' },
  { id: 'pixel', emoji: '🎮', label: 'Pixel', tagline: 'Rétro gaming, saturé, ludique.' },
  { id: 'garden', emoji: '🌿', label: 'Garden', tagline: 'Végétal, calme, organique.' },
]

const state = prefsState

// --- Accent color: derive an 8-stop scale from a single hex, so a custom
// accent can override just the active theme's accent tokens. ---------------

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d) % 6
        break
      case g:
        h = (b - r) / d + 2
        break
      default:
        h = (r - g) / d + 4
    }
    h *= 60
    if (h < 0) h += 360
  }
  return [h, s * 100, l * 100]
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`
}

const ACCENT_STOPS: Record<string, number> = {
  '50': 95,
  '100': 90,
  '200': 81,
  '300': 70,
  '400': 58,
  '500': 48,
  '600': 38,
  '700': 30,
}

function deriveAccentScale(hex: string): Record<string, string> {
  const [h, s] = hexToHsl(hex)
  const scale: Record<string, string> = {}
  for (const [stop, l] of Object.entries(ACCENT_STOPS)) {
    scale[stop] = hslToHex(h, Math.min(88, Math.max(35, s)), l)
  }
  return scale
}

// --- Resolving what's actually active (preset vs. custom) -----------------

function activeThemeId(): PresetThemeId {
  return state.themeId === 'custom' ? state.customTheme.baseTheme : state.themeId
}

function activeMode(): ThemeMode {
  return state.themeId === 'custom' ? state.customTheme.mode : state.mode
}

function activeAccentColor(): string | null {
  return state.themeId === 'custom' ? state.customTheme.accentColor : state.accentColor
}

// --- DOM application --------------------------------------------------

let mediaQuery: MediaQueryList | null = null

function systemPrefersDark(): boolean {
  if (!mediaQuery) mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  return mediaQuery.matches
}

function applyToDom() {
  const root = document.documentElement
  root.setAttribute('data-theme', activeThemeId())

  const mode = activeMode()
  root.setAttribute('data-mode', mode === 'auto' ? (systemPrefersDark() ? 'dark' : 'light') : mode)
  root.setAttribute('data-intensity', state.visualIntensity)
  root.setAttribute('data-animations', state.animationsEnabled ? 'on' : 'off')

  const accent = activeAccentColor()
  if (accent) {
    const scale = deriveAccentScale(accent)
    for (const [stop, value] of Object.entries(scale)) root.style.setProperty(`--color-lavender-${stop}`, value)
  } else {
    for (const stop of Object.keys(ACCENT_STOPS)) root.style.removeProperty(`--color-lavender-${stop}`)
  }

  if (state.themeId === 'custom') {
    const sharp = state.customTheme.cornerStyle === 'sharp'
    root.style.setProperty('--radius-xl', sharp ? '0.5rem' : '1.25rem')
    root.style.setProperty('--radius-2xl', sharp ? '0.75rem' : '1.75rem')
  } else {
    root.style.removeProperty('--radius-xl')
    root.style.removeProperty('--radius-2xl')
  }
}

// Preferences load asynchronously from Supabase after init() has already
// applied the defaults — re-apply once the real values land (and on any
// later change, as a safety net alongside the setters' explicit calls).
watch(state, () => applyToDom(), { deep: true })

let initialized = false

export function useTheme() {
  function setTheme(id: ThemeId) {
    state.themeId = id
    savePreferences()
    applyToDom()
  }

  function setMode(mode: ThemeMode) {
    state.mode = mode
    savePreferences()
    applyToDom()
  }

  function setAccentColor(hex: string | null) {
    state.accentColor = hex
    savePreferences()
    applyToDom()
  }

  function setVisualIntensity(intensity: VisualIntensity) {
    state.visualIntensity = intensity
    savePreferences()
    applyToDom()
  }

  function setAnimationsEnabled(enabled: boolean) {
    state.animationsEnabled = enabled
    savePreferences()
    applyToDom()
  }

  function updateCustomTheme(patch: Partial<CustomThemeConfig>) {
    Object.assign(state.customTheme, patch)
    savePreferences()
    if (state.themeId === 'custom') applyToDom()
  }

  function init() {
    if (initialized) return
    initialized = true
    applyToDom()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', () => {
      if (activeMode() === 'auto') applyToDom()
    })
  }

  return {
    state,
    themes: THEME_LIST,
    setTheme,
    setMode,
    setAccentColor,
    setVisualIntensity,
    setAnimationsEnabled,
    updateCustomTheme,
    init,
  }
}
