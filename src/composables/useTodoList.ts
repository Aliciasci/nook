import { computed } from 'vue'
import {
  TODO_MAX_ENTRIES,
  TODO_MAX_LENGTH,
  prefsState,
  savePreferences,
  type TodoEntry,
} from '@/composables/usePreferencesStore'
import { useToast } from '@/composables/useToast'

export type { TodoEntry }

// Référence directe sur le tableau des préférences, comme `useWorkSchedule`
// tient `prefsState.schedule` : le chargement d'un nook le remplit en place,
// jamais en le remplaçant.
const entries = prefsState.todoList

function genId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * La to-do list de l'accueil — des micro-trucs à cocher, hors du système de
 * tâches : ni dossier, ni échéance, ni importance, et rien qui remonte dans
 * l'Inbox, le Planning ou le Rapport.
 *
 * Elle vit dans `user_preferences.extra`, donc par nook, et suit la même
 * écriture différée que le thème — `flushPreferences` la vide déjà avant une
 * bascule de nook.
 */
export function useTodoList() {
  /**
   * Les lignes cochées descendent en bas, chaque groupe gardant son ordre
   * d'ajout : ce qui reste à faire se lit d'un coup d'œil, sans que cocher
   * fasse disparaître la trace de ce qui vient d'être fait.
   */
  const visible = computed(() => [...entries.filter((e) => !e.done), ...entries.filter((e) => e.done)])

  const openCount = computed(() => entries.reduce((n, e) => (e.done ? n : n + 1), 0))
  const doneCount = computed(() => entries.length - openCount.value)

  // La ligne de préférences arrive en une requête au démarrage et à chaque
  // bascule de nook. Écrire avant qu'elle soit là poserait une liste vide
  // par-dessus celle de la base.
  const ready = computed(() => prefsState.loaded)

  function add(text: string) {
    const value = text.trim()
    if (!value || !ready.value) return
    if (entries.length >= TODO_MAX_ENTRIES) {
      useToast().error(`Ta to-do list est pleine (${TODO_MAX_ENTRIES} lignes). Nettoie les lignes cochées.`)
      return
    }
    entries.push({ id: genId(), text: value.slice(0, TODO_MAX_LENGTH), done: false })
    savePreferences()
  }

  function toggle(id: string) {
    const entry = entries.find((e) => e.id === id)
    if (!entry) return
    entry.done = !entry.done
    savePreferences()
  }

  function remove(id: string) {
    const idx = entries.findIndex((e) => e.id === id)
    if (idx === -1) return
    entries.splice(idx, 1)
    savePreferences()
  }

  function clearDone() {
    if (!doneCount.value) return
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].done) entries.splice(i, 1)
    }
    savePreferences()
  }

  return { entries: visible, openCount, doneCount, ready, add, toggle, remove, clearDone }
}
