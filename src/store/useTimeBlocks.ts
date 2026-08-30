import { computed, reactive, watch } from 'vue'
import type { FolderColor, Item, TimeBlock, TimeBlockKind } from '@/types'
import { useNooks } from '@/composables/useNooks'
import { useToast } from '@/composables/useToast'
import { useStore } from '@/store/useStore'
import * as blocksApi from '@/services/timeBlocks'
import * as focusApi from '@/services/focus'
import { activityKind } from '@/utils/activityKinds'
import { activityColorOf } from '@/composables/useActivityColors'
import {
  actualMinutes as actualMinutesOf,
  actualSecondsByDayItem,
  blockStatus as blockStatusOf,
  plannedMinutes as plannedMinutesOf,
  summarize,
} from '@/utils/planning'

/* --------------------------------------------------------- Dates ISO --- */

/** `yyyy-mm-dd` du jour local — jamais `toISOString`, qui bascule en UTC. */
export function toDayIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayIso(): string {
  return toDayIso(new Date())
}

export function parseDayIso(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(day: string, delta: number): string {
  const date = parseDayIso(day)
  date.setDate(date.getDate() + delta)
  return toDayIso(date)
}

/** Le lundi de la semaine contenant `day`. */
export function startOfWeek(day: string): string {
  const date = parseDayIso(day)
  // getDay(): 0 = dimanche. On veut lundi comme premier jour.
  const shift = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - shift)
  return toDayIso(date)
}

/** Les sept jours de la semaine contenant `day`, du lundi au dimanche. */
export function weekDays(day: string): string[] {
  const monday = startOfWeek(day)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function startOfMonth(day: string): string {
  const date = parseDayIso(day)
  date.setDate(1)
  return toDayIso(date)
}

export function endOfMonth(day: string): string {
  const date = parseDayIso(day)
  // Le jour 0 du mois suivant, c'est le dernier du mois courant.
  date.setMonth(date.getMonth() + 1, 0)
  return toDayIso(date)
}

/**
 * Les 42 cases de la grille du mois contenant `day` — six semaines pleines,
 * du lundi précédant le 1er au dimanche qui referme la sixième semaine.
 *
 * Toujours 42, jamais 35 : une grille dont la hauteur change d'un mois à
 * l'autre fait sauter la page sous le curseur à chaque flèche.
 */
export function monthGridDays(day: string): string[] {
  const first = startOfWeek(startOfMonth(day))
  return Array.from({ length: 42 }, (_, i) => addDays(first, i))
}

/**
 * `day` décalé de `delta` mois, en retombant sur le dernier jour du mois quand
 * le quantième n'existe pas — le 31 mars reculé d'un mois donne le 28 février,
 * pas le 3 mars.
 */
export function addMonths(day: string, delta: number): string {
  const date = parseDayIso(day)
  const wanted = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + delta)
  const lastOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(wanted, lastOfMonth))
  return toDayIso(date)
}

/* ------------------------------------------------------------ État --- */

interface TimeBlocksState {
  blocks: TimeBlock[]
  /** Secondes de focus réellement passées, par `jour|itemId`. */
  actualSeconds: Map<string, number>
  /** Plage actuellement chargée, bornes comprises. */
  rangeFrom: string | null
  rangeTo: string | null
  isLoading: boolean
  loaded: boolean
}

const state = reactive<TimeBlocksState>({
  blocks: [],
  actualSeconds: new Map(),
  rangeFrom: null,
  rangeTo: null,
  isLoading: false,
  loaded: false,
})

function genId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/* ----------------------------------------------------- Chargement --- */

let loadToken = 0

/**
 * Charge une plage de jours — et le réalisé qui va avec.
 *
 * On charge toujours la semaine entière autour du jour regardé, pas le seul
 * jour : passer au lendemain avec la flèche ne relance alors aucune requête,
 * et la future vue semaine s'appuiera exactement sur la même plage.
 */
async function loadRange(from: string, to: string): Promise<void> {
  const token = ++loadToken
  state.isLoading = true
  try {
    // Le réalisé se lit dans `focus_sessions`, en instants absolus : on borne
    // du début du premier jour au début du lendemain du dernier.
    const sinceIso = parseDayIso(from).toISOString()
    const untilIso = parseDayIso(addDays(to, 1)).toISOString()

    const [blocks, sessions] = await Promise.all([
      blocksApi.listTimeBlocks(from, to),
      focusApi.listFocusSessions(sinceIso, untilIso),
    ])
    if (token !== loadToken) return

    state.blocks = blocks
    state.actualSeconds = actualSecondsByDayItem(sessions)
    state.rangeFrom = from
    state.rangeTo = to
    state.loaded = true
  } catch {
    if (token !== loadToken) return
    useToast().error('Impossible de charger ton planning. Vérifie ta connexion et réessaie.')
  } finally {
    if (token === loadToken) state.isLoading = false
  }
}

function reset() {
  loadToken++
  state.blocks = []
  state.actualSeconds = new Map()
  state.rangeFrom = null
  state.rangeTo = null
  state.isLoading = false
  state.loaded = false
}

// Le planning appartient au nook, comme le reste.
const nooks = useNooks()
watch(nooks.activeId, () => reset())

/* ------------------------------------------------------------ API --- */

export function useTimeBlocks() {
  const store = useStore()

  /**
   * S'assure que `[from, to]` est en mémoire.
   *
   * Une plage déjà couverte par ce qui est chargé ne relance rien : revenir de
   * la vue mois à la vue jour ne repart pas en requête, la journée regardée
   * était dans les 42 déjà là. Les dates ISO se comparent comme des chaînes.
   */
  function ensureRange(from: string, to: string): Promise<void> {
    if (state.loaded && state.rangeFrom && state.rangeTo && state.rangeFrom <= from && state.rangeTo >= to) {
      return Promise.resolve()
    }
    return loadRange(from, to)
  }

  /** S'assure que la semaine contenant `day` est chargée. */
  function ensureDay(day: string): Promise<void> {
    const from = startOfWeek(day)
    return ensureRange(from, addDays(from, 6))
  }

  /** Recharge la plage courante — après une session de focus, par exemple. */
  function refresh(): Promise<void> {
    if (!state.rangeFrom || !state.rangeTo) return Promise.resolve()
    return loadRange(state.rangeFrom, state.rangeTo)
  }

  function blocksForDay(day: string): TimeBlock[] {
    return state.blocks
      .filter((b) => b.day === day)
      .sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute)
  }

  /** Les créneaux d'une plage, bornes comprises, rangés par jour puis heure. */
  function blocksForRange(from: string, to: string): TimeBlock[] {
    return state.blocks
      .filter((b) => b.day >= from && b.day <= to)
      .sort((a, b) => a.day.localeCompare(b.day) || a.startMinute - b.startMinute || a.endMinute - b.endMinute)
  }

  /** La tâche d'un créneau, si elle existe encore. */
  function itemOf(block: TimeBlock): Item | undefined {
    return store.getItem(block.itemId)
  }

  /**
   * Le titre affiché : celui de la tâche tant qu'elle vit, sinon l'étiquette
   * gardée sur le créneau.
   */
  function labelOf(block: TimeBlock): string {
    return itemOf(block)?.title ?? block.title
  }

  /**
   * La teinte du créneau : la sienne d'abord, puis celle de sa catégorie,
   * puis celle du dossier de sa tâche. `null` = teinte neutre.
   *
   * La teinte explicite passe devant la catégorie : elle a été choisie à la
   * main sur ce créneau-là, la catégorie ne fait que proposer la sienne.
   *
   * Le résultat est une *chaîne* et non une `FolderColor` : une catégorie peut
   * porter une couleur libre, que les six noms de l'app ne savent pas dire.
   * Voir `utils/activityPalette` pour la résolution en valeurs CSS.
   */
  function colorOf(block: TimeBlock): string | null {
    if (block.color) return block.color
    const kind = activityKind(block.kind)
    if (kind) return activityColorOf(kind.id)
    const item = itemOf(block)
    return item ? (store.getFolder(item.folderId)?.color ?? null) : null
  }

  function plannedMinutes(block: TimeBlock): number {
    return plannedMinutesOf(block)
  }

  /** Minutes réellement passées en focus sur la tâche de ce créneau, ce jour-là. */
  function actualMinutes(block: TimeBlock): number {
    return actualMinutesOf(block, state.actualSeconds)
  }

  function blockStatus(block: TimeBlock) {
    return blockStatusOf(block, itemOf(block), actualMinutes(block))
  }

  /** Le bilan d'une journée : prévu, réalisé, et ce qui est passé à la trappe. */
  function daySummary(day: string) {
    return summarize(blocksForDay(day), (id) => store.getItem(id), state.actualSeconds)
  }

  /** Le même bilan sur une plage — la semaine ou le mois affiché. */
  function rangeSummary(from: string, to: string) {
    return summarize(blocksForRange(from, to), (id) => store.getItem(id), state.actualSeconds)
  }

  /* ------------------------------------------------------ Écritures --- */

  function addBlock(input: {
    day: string
    startMinute: number
    endMinute: number
    itemId?: string | null
    title?: string
    color?: FolderColor | null
    kind?: TimeBlockKind | null
  }): TimeBlock | null {
    const item = input.itemId ? store.getItem(input.itemId) : undefined
    const title = (input.title ?? item?.title ?? '').trim() || 'Sans titre'

    const block: TimeBlock = {
      id: genId(),
      itemId: input.itemId ?? null,
      title,
      day: input.day,
      startMinute: Math.max(0, Math.round(input.startMinute)),
      endMinute: Math.min(1440, Math.round(input.endMinute)),
      color: input.color ?? null,
      kind: input.kind ?? null,
      notes: null,
    }
    if (block.endMinute <= block.startMinute) return null

    state.blocks.push(block)
    blocksApi
      .createTimeBlock({
        id: block.id,
        itemId: block.itemId,
        title: block.title,
        day: block.day,
        startMinute: block.startMinute,
        endMinute: block.endMinute,
        color: block.color,
        kind: block.kind,
      })
      .catch(() => {
        const idx = state.blocks.findIndex((b) => b.id === block.id)
        if (idx !== -1) state.blocks.splice(idx, 1)
        useToast().error("Ce créneau n'a pas pu être enregistré.")
      })
    return block
  }

  function updateBlock(id: string, patch: blocksApi.TimeBlockPatch) {
    const block = state.blocks.find((b) => b.id === id)
    if (!block) return
    const before: blocksApi.TimeBlockPatch = {}
    for (const key of Object.keys(patch) as (keyof blocksApi.TimeBlockPatch)[]) {
      // @ts-expect-error — recopie clé à clé d'un patch partiel homogène
      before[key] = block[key]
    }
    Object.assign(block, patch)

    blocksApi.updateTimeBlock(id, patch).catch(() => {
      Object.assign(block, before)
      useToast().error("Ce créneau n'a pas pu être modifié.")
    })
  }

  function removeBlock(id: string) {
    const idx = state.blocks.findIndex((b) => b.id === id)
    if (idx === -1) return
    const [removed] = state.blocks.splice(idx, 1)
    blocksApi.deleteTimeBlock(id).catch(() => {
      state.blocks.splice(idx, 0, removed)
      useToast().error("Ce créneau n'a pas pu être supprimé.")
    })
  }

  return {
    state,
    isLoading: computed(() => state.isLoading),
    loaded: computed(() => state.loaded),
    ensureDay,
    ensureRange,
    refresh,
    blocksForDay,
    blocksForRange,
    itemOf,
    labelOf,
    colorOf,
    plannedMinutes,
    actualMinutes,
    blockStatus,
    daySummary,
    rangeSummary,
    addBlock,
    updateBlock,
    removeBlock,
  }
}
