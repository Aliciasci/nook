// Internal shared backing store for the `user_preferences` row — both
// useTheme.ts and useWorkSchedule.ts read/write slices of this single
// reactive object instead of each owning their own persistence. Not meant to
// be imported by components directly; go through useTheme()/useWorkSchedule().
import { reactive, watch } from 'vue'
import { onBeforeNookSwitch, useNooks } from '@/composables/useNooks'
import { useToast } from '@/composables/useToast'
import { getPreferences, updatePreferences, type PreferencesRow } from '@/services/preferences'
import type { ThemeId, PresetThemeId, ThemeMode, VisualIntensity, CornerStyle } from '@/composables/themeTypes'
import type { TimeBlockKind } from '@/types'
import { isFreeColor, isTint } from '@/utils/activityPalette'

export interface CustomThemeConfig {
  baseTheme: PresetThemeId
  accentColor: string | null
  mode: ThemeMode
  cornerStyle: CornerStyle
}

/**
 * Une des six teintes de l'app (`blue`, `green`…) ou une couleur libre en
 * `#rrggbb`. Les teintes suivent le thème actif ; une couleur libre, non.
 */
export type BackgroundTint = string

export interface BackgroundConfig {
  /**
   * Couleur de fond unie, alternative à l'image. Exclusive avec `url` : poser
   * l'une efface l'autre, un fond ne pouvant pas être deux choses à la fois.
   */
  color: BackgroundTint | null
  /** Motif répété par-dessus la couleur. `null` = aplat. */
  pattern: string | null
  /** Public URL of the wallpaper, or null when none is set. */
  url: string | null
  /** Where it came from — 'upload' owns a Storage object we must clean up. */
  source: 'upload' | 'url' | null
  /** Storage path, set only for uploads, so the old file can be deleted. */
  storagePath: string | null
  /** 0 = raw photo, 1 = fully veiled by the theme's paper color. */
  overlay: number
  /** Ink color for text sitting directly on the wallpaper, with no card behind
   *  it. 'dark' is the theme's normal ink; 'light' is for dark photos. */
  textTone: 'dark' | 'light'
}

/**
 * Une ligne de la to-do list de l'accueil.
 *
 * Volontairement hors du modèle `Item` : ces micro-trucs n'ont ni dossier, ni
 * échéance, ni importance, et n'ont rien à faire dans l'Inbox, le Planning ou
 * le Rapport. Ils vivent donc dans `user_preferences.extra` — par nook, sans
 * migration, comme le fond d'écran.
 */
export interface TodoEntry {
  id: string
  text: string
  done: boolean
}

/** Plafonds : cette ligne porte aussi le thème et le fond, elle se relit à
 *  chaque ouverture de nook. Une to-do list n'a pas à la faire grossir. */
export const TODO_MAX_ENTRIES = 100
export const TODO_MAX_LENGTH = 200

export interface PreferencesState {
  themeId: ThemeId
  mode: ThemeMode
  accentColor: string | null
  visualIntensity: VisualIntensity
  animationsEnabled: boolean
  customTheme: CustomThemeConfig
  background: BackgroundConfig
  schedule: {
    startTime: string
    lunchStart: string
    lunchEnd: string
    endTime: string
  }
  focusLastDuration: number
  focusAmbiance: string
  todoList: TodoEntry[]
  /**
   * La teinte donnée à une activité du planning, quand elle n'est pas celle
   * du catalogue. Une des six teintes de l'app, ou une couleur libre.
   * Les catégories laissées telles quelles n'ont pas de clé ici — l'absence
   * dit « celle d'origine », ce qu'une valeur recopiée ne dirait pas.
   */
  activityColors: Partial<Record<TimeBlockKind, string>>
  loaded: boolean
}

export const DEFAULT_BACKGROUND: BackgroundConfig = {
  color: null,
  pattern: null,
  url: null,
  source: null,
  storagePath: null,
  overlay: 0.55,
  textTone: 'dark',
}

const DEFAULT_CUSTOM: CustomThemeConfig = {
  baseTheme: 'lavender',
  accentColor: null,
  mode: 'light',
  cornerStyle: 'soft',
}

export const prefsState = reactive<PreferencesState>({
  themeId: 'lavender',
  mode: 'light',
  accentColor: null,
  visualIntensity: 'normal',
  animationsEnabled: true,
  customTheme: { ...DEFAULT_CUSTOM },
  background: { ...DEFAULT_BACKGROUND },
  schedule: { startTime: '09:00', lunchStart: '12:30', lunchEnd: '13:30', endTime: '18:00' },
  focusLastDuration: 25,
  focusAmbiance: 'silence',
  todoList: [],
  activityColors: {},
  loaded: false,
})

function hhmm(value: string): string {
  return value.slice(0, 5)
}

/**
 * `extra` est du jsonb : rien ne garantit ce qu'on y relit. Une entrée
 * illisible est écartée plutôt que de faire tomber tout le chargement — le
 * thème et les horaires voyagent dans la même ligne.
 */
function readTodoList(value: unknown): TodoEntry[] {
  if (!Array.isArray(value)) return []
  const entries: TodoEntry[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const { id, text, done } = raw as Partial<TodoEntry>
    if (typeof id !== 'string' || typeof text !== 'string') continue
    entries.push({ id, text: text.slice(0, TODO_MAX_LENGTH), done: done === true })
    if (entries.length === TODO_MAX_ENTRIES) break
  }
  return entries
}

const KINDS: TimeBlockKind[] = ['travail', 'focus', 'reunion', 'etude', 'sport', 'pause']

/** Même prudence que pour la to-do list : `extra` est du jsonb. */
function readActivityColors(value: unknown): Partial<Record<TimeBlockKind, string>> {
  if (!value || typeof value !== 'object') return {}
  const out: Partial<Record<TimeBlockKind, string>> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!KINDS.includes(key as TimeBlockKind)) continue
    if (typeof raw !== 'string') continue
    if (!isTint(raw) && !isFreeColor(raw)) continue
    out[key as TimeBlockKind] = raw
  }
  return out
}

function applyRow(row: PreferencesRow) {
  prefsState.themeId = row.theme as ThemeId
  prefsState.visualIntensity = row.visual_intensity as VisualIntensity
  prefsState.accentColor = row.accent_color
  prefsState.animationsEnabled = row.animations_enabled
  // Mutate the nested objects in place (never reassign `.schedule` /
  // `.customTheme` themselves) — useWorkSchedule.ts holds a direct reference
  // to `prefsState.schedule`, which would go stale if this replaced it.
  Object.assign(prefsState.schedule, {
    startTime: hhmm(row.work_start_time),
    lunchStart: hhmm(row.lunch_start_time),
    lunchEnd: hhmm(row.lunch_end_time),
    endTime: hhmm(row.work_end_time),
  })
  const extra = (row.extra ?? {}) as {
    mode?: PreferencesState['mode']
    customTheme?: Partial<CustomThemeConfig>
    focusLastDuration?: number
    focusAmbiance?: string
    background?: Partial<BackgroundConfig>
    checklist?: unknown
    activityColors?: unknown
  }
  prefsState.mode = extra.mode ?? 'light'
  Object.assign(prefsState.customTheme, DEFAULT_CUSTOM, extra.customTheme ?? {})
  prefsState.focusLastDuration = extra.focusLastDuration ?? 25
  prefsState.focusAmbiance = extra.focusAmbiance ?? 'silence'
  Object.assign(prefsState.background, DEFAULT_BACKGROUND, extra.background ?? {})
  // En place, comme `schedule` : useTodoList.ts tient une référence directe
  // sur ce tableau, la réassigner la laisserait sur l'ancien nook.
  prefsState.todoList.splice(0, prefsState.todoList.length, ...readTodoList(extra.checklist))
  // En place là aussi : le planning lit cet objet à chaque rendu de carte.
  for (const key of Object.keys(prefsState.activityColors)) {
    delete prefsState.activityColors[key as TimeBlockKind]
  }
  Object.assign(prefsState.activityColors, readActivityColors(extra.activityColors))
}

let loadToken = 0

export async function loadPreferences() {
  const token = ++loadToken
  try {
    const row = await getPreferences()
    if (token !== loadToken) return
    if (row) applyRow(row)
  } catch {
    if (token !== loadToken) return
    useToast().error('Impossible de charger tes préférences.')
  } finally {
    if (token === loadToken) prefsState.loaded = true
  }
}

export function resetPreferences() {
  loadToken++
  prefsState.themeId = 'lavender'
  prefsState.mode = 'light'
  prefsState.accentColor = null
  prefsState.visualIntensity = 'normal'
  prefsState.animationsEnabled = true
  Object.assign(prefsState.customTheme, DEFAULT_CUSTOM)
  Object.assign(prefsState.background, DEFAULT_BACKGROUND)
  Object.assign(prefsState.schedule, { startTime: '09:00', lunchStart: '12:30', lunchEnd: '13:30', endTime: '18:00' })
  prefsState.focusLastDuration = 25
  prefsState.focusAmbiance = 'silence'
  prefsState.todoList.splice(0)
  for (const key of Object.keys(prefsState.activityColors)) {
    delete prefsState.activityColors[key as TimeBlockKind]
  }
  prefsState.loaded = false
}

// Le thème, le fond et les horaires appartiennent au nook : changer de nook
// recharge la ligne de préférences de celui qu'on ouvre.
const nooks = useNooks()
watch(
  nooks.activeId,
  (nookId) => {
    if (nookId) void loadPreferences()
    else resetPreferences()
  },
  { immediate: true },
)

let saveTimer: number | undefined

function writePreferences(): Promise<void> {
  return updatePreferences({
    theme: prefsState.themeId,
    accent_color: prefsState.accentColor,
    visual_intensity: prefsState.visualIntensity,
    animations_enabled: prefsState.animationsEnabled,
    work_start_time: prefsState.schedule.startTime,
    lunch_start_time: prefsState.schedule.lunchStart,
    lunch_end_time: prefsState.schedule.lunchEnd,
    work_end_time: prefsState.schedule.endTime,
    extra: {
      mode: prefsState.mode,
      customTheme: prefsState.customTheme,
      focusLastDuration: prefsState.focusLastDuration,
      focusAmbiance: prefsState.focusAmbiance,
      background: prefsState.background,
      // La clé jsonb garde son nom d'origine : la renommer perdrait les lignes
      // déjà écrites, pour cinq caractères que personne ne lit.
      checklist: prefsState.todoList,
      activityColors: prefsState.activityColors,
    },
  }).catch(() => {
    useToast().error("Tes préférences n'ont pas pu être sauvegardées.")
  })
}

export function savePreferences() {
  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    saveTimer = undefined
    void writePreferences()
  }, 400)
}

/**
 * Écrit tout de suite ce qui attendait le débounce. Le nook n'est résolu qu'au
 * moment de l'écriture : une sauvegarde qui traverserait la bascule irait
 * poser le thème de l'ancien nook sur le nouveau.
 */
export function flushPreferences(): Promise<void> {
  if (!saveTimer) return Promise.resolve()
  window.clearTimeout(saveTimer)
  saveTimer = undefined
  return writePreferences()
}

onBeforeNookSwitch(flushPreferences)
