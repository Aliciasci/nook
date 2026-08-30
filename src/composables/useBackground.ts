// Full-screen wallpaper behind the whole app.
//
// Mirrors useTheme's shape: the DOM only ever sees CSS custom properties plus
// a `data-app-bg` flag on <html>, so themes/background.css owns every visual
// decision and no component needs to know a wallpaper exists.
import { computed, nextTick, watch } from 'vue'
import {
  DEFAULT_BACKGROUND,
  prefsState,
  savePreferences,
  type BackgroundConfig,
} from '@/composables/usePreferencesStore'
import { removeBackground, uploadBackground } from '@/services/backgrounds'
import { patternDataUri, PATTERN_TILE_PX, type BackgroundPattern } from '@/utils/backgroundPatterns'

const state = prefsState

/** Les six teintes de l'app, celles des dossiers et de la couleur de texte. */
export const BACKGROUND_TINTS = ['blue', 'green', 'pink', 'beige', 'lavender', 'peach'] as const
export type BackgroundTintId = (typeof BACKGROUND_TINTS)[number]

function isTint(color: string): color is BackgroundTintId {
  return (BACKGROUND_TINTS as readonly string[]).includes(color)
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/**
 * La couleur peinte en fond, et celle du motif posé dessus.
 *
 * Pour une teinte de l'app, les deux sortent du thème actif : `--color-folder-X`
 * pour le fond, `--color-folder-X-ink` pour le motif. Le couple existe déjà dans
 * chaque thème, en clair comme en sombre — en sombre la teinte devient foncée et
 * l'encre claire, donc le motif reste visible sans rien calculer.
 *
 * Pour une couleur libre, il n'y a pas d'encre associée : on la fonce ou on
 * l'éclaircit selon sa luminosité, ce qui garantit un motif visible des deux
 * côtés du spectre.
 */
export function resolveBackgroundColors(color: string): { fill: string; ink: string } {
  if (isTint(color)) {
    return { fill: cssVar(`--color-folder-${color}`), ink: cssVar(`--color-folder-${color}-ink`) }
  }
  return { fill: color, ink: contrastInk(color) }
}

function contrastInk(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return '#000000'
  const n = parseInt(m[1], 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  // Luminosité perçue — les trois canaux ne pèsent pas pareil pour l'œil.
  const light = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55
  const mix = (c: number) => Math.round(light ? c * 0.45 : c + (255 - c) * 0.55)
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

function applyToDom() {
  const root = document.documentElement
  const { url, color, pattern, overlay, textTone } = state.background

  root.style.removeProperty('--app-bg-image')
  root.style.removeProperty('--app-bg-overlay')
  root.style.removeProperty('--app-bg-color')
  root.style.removeProperty('--app-bg-pattern')
  root.style.removeProperty('--app-bg-pattern-size')

  if (url) {
    // encodeURI keeps quotes and parentheses in a filename from breaking
    // out of the url() token.
    root.style.setProperty('--app-bg-image', `url("${encodeURI(url)}")`)
    root.style.setProperty('--app-bg-overlay', String(overlay))
    root.setAttribute('data-app-bg', 'on')
    root.setAttribute('data-app-bg-kind', 'image')
    root.setAttribute('data-app-bg-text', textTone)
    return
  }

  if (color) {
    const { fill, ink } = resolveBackgroundColors(color)
    root.style.setProperty('--app-bg-color', fill)
    if (pattern) {
      root.style.setProperty('--app-bg-pattern', patternDataUri(pattern as BackgroundPattern, ink))
      root.style.setProperty('--app-bg-pattern-size', `${PATTERN_TILE_PX}px ${PATTERN_TILE_PX}px`)
    }
    root.setAttribute('data-app-bg', 'on')
    root.setAttribute('data-app-bg-kind', 'color')
    root.setAttribute('data-app-bg-text', textTone)
    return
  }

  root.removeAttribute('data-app-bg')
  root.removeAttribute('data-app-bg-kind')
  root.removeAttribute('data-app-bg-text')
}

// Preferences arrive from Supabase after init() has run with the defaults.
watch(
  () => [state.background.url, state.background.color, state.background.pattern, state.background.overlay, state.background.textTone],
  applyToDom,
)

/**
 * Une teinte et son motif sont lus dans les variables du thème : changer de
 * thème ou passer en sombre les périme. `nextTick` laisse `useTheme` reposer
 * ses variables avant qu'on ne les relise.
 */
watch(
  () => [state.themeId, state.mode, state.customTheme.baseTheme, state.customTheme.mode],
  () => {
    if (state.background.color) void nextTick(applyToDom)
  },
)

let initialized = false

export function useBackground() {
  /** Replaces the current wallpaper, deleting the previous upload if any. */
  async function set(patch: Partial<BackgroundConfig>) {
    const previous = state.background.storagePath
    Object.assign(state.background, patch)
    applyToDom()
    savePreferences()

    // Only after the new one is committed, so a failed cleanup can't strand
    // the user with a wallpaper that no longer exists.
    if (previous && previous !== state.background.storagePath) {
      await removeBackground(previous)
    }
  }

  async function setFromFile(file: File) {
    const { url, path } = await uploadBackground(file)
    await set({ url, source: 'upload', storagePath: path, color: null })
  }

  async function setFromUrl(url: string) {
    const trimmed = url.trim()
    if (!trimmed) return
    let parsed: URL
    try {
      parsed = new URL(trimmed)
    } catch {
      throw new Error("Cette URL n'est pas valide.")
    }
    if (parsed.protocol !== 'https:') {
      throw new Error('Utilise une URL en https:// — une image en http sera bloquée par le navigateur.')
    }
    await set({ url: trimmed, source: 'url', storagePath: null, color: null })
  }

  /**
   * Pose une couleur unie. Exclusive avec l'image : un fond ne peut pas être
   * deux choses à la fois, et garder l'URL en réserve ferait réapparaître la
   * photo au prochain retrait de la couleur.
   */
  async function setColor(color: string | null) {
    await set({ color, url: null, source: null, storagePath: null })
  }

  function setPattern(pattern: BackgroundPattern | null) {
    state.background.pattern = pattern
    applyToDom()
    savePreferences()
  }

  async function clear() {
    // Keep the display preferences — removing an image shouldn't discard the
    // veil and text settings the user tuned for the next one.
    await set({
      ...DEFAULT_BACKGROUND,
      overlay: state.background.overlay,
      textTone: state.background.textTone,
    })
  }

  function setTextTone(tone: 'dark' | 'light') {
    state.background.textTone = tone
    applyToDom()
    savePreferences()
  }

  function setOverlay(value: number) {
    state.background.overlay = Math.min(1, Math.max(0, value))
    applyToDom()
    savePreferences()
  }

  function init() {
    if (initialized) return
    initialized = true
    applyToDom()
  }

  return {
    config: computed(() => state.background),
    hasBackground: computed(() => Boolean(state.background.url || state.background.color)),
    hasImage: computed(() => Boolean(state.background.url)),
    set,
    setColor,
    setPattern,
    setFromFile,
    setFromUrl,
    clear,
    setOverlay,
    setTextTone,
    init,
  }
}
