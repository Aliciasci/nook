import { computed, reactive, watch } from 'vue'
import { useWorkSchedule } from '@/composables/useWorkSchedule'
import { onBeforeNookSwitch, useNooks } from '@/composables/useNooks'
import { useToast } from '@/composables/useToast'
import { toMinutes, nowMinutes } from '@/utils/time'
import * as gardenApi from '@/services/garden'

// XP awarded per action. Deliberately NOT proportional to time spent —
// starting/finishing things is rewarded, clocking hours is not.
export const XP_FOCUS_START = 5
export const XP_FOCUS_COMPLETE = 15
export const XP_TASK_COMPLETE = 10
export const XP_PRIORITY_BONUS = 30
export const XP_DAY_COMPLETE_BONUS = 50

export interface GardenLevel {
  level: number
  xpRequired: number
  unlocks: string[]
}

// Cumulative unlock catalogue. Once unlocked, an element stays forever —
// the garden never regresses.
export const GARDEN_LEVELS: GardenLevel[] = [
  { level: 1, xpRequired: 0, unlocks: ['ground', 'sprout-1', 'sprout-2', 'cloud-1'] },
  { level: 2, xpRequired: 80, unlocks: ['bush-1', 'cloud-2'] },
  { level: 3, xpRequired: 200, unlocks: ['flower-1', 'flower-2', 'stone-1'] },
  { level: 4, xpRequired: 380, unlocks: ['tree-1'] },
  { level: 5, xpRequired: 620, unlocks: ['path', 'tree-2'] },
  { level: 6, xpRequired: 920, unlocks: ['house'] },
  { level: 7, xpRequired: 1280, unlocks: ['pond', 'flower-3'] },
  { level: 8, xpRequired: 1700, unlocks: ['tree-3', 'bush-2'] },
  { level: 9, xpRequired: 2180, unlocks: ['fireflies', 'flower-4'] },
  { level: 10, xpRequired: 2720, unlocks: ['full-bloom'] },
]

const MAX_LEVEL = GARDEN_LEVELS[GARDEN_LEVELS.length - 1]

interface GardenState {
  xp: number
  activeDays: number
  lastActiveDate: string | null
  lastPriorityBonusDate: string | null
  lastDayBonusDate: string | null
  seenLevel: number
  loaded: boolean
}

const state = reactive<GardenState>({
  xp: 0,
  activeDays: 0,
  lastActiveDate: null,
  lastPriorityBonusDate: null,
  lastDayBonusDate: null,
  seenLevel: 1,
  loaded: false,
})

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function levelForXp(xp: number): GardenLevel {
  let current = GARDEN_LEVELS[0]
  for (const l of GARDEN_LEVELS) {
    if (xp >= l.xpRequired) current = l
    else break
  }
  return current
}

function elementTypeFromKey(key: string): string {
  return key.replace(/-\d+$/, '')
}

// --- Load / reset, mirroring the same auth-driven pattern as the other
// Supabase-backed composables. --------------------------------------------

let loadToken = 0

async function load() {
  const token = ++loadToken
  try {
    const row = await gardenApi.getGardenProgress()
    if (token !== loadToken) return
    if (row) {
      state.xp = row.xp
      state.activeDays = row.active_days
      state.lastActiveDate = row.last_active_date
      const extra = (row.extra ?? {}) as { lastPriorityBonusDate?: string | null; lastDayBonusDate?: string | null }
      state.lastPriorityBonusDate = extra.lastPriorityBonusDate ?? null
      state.lastDayBonusDate = extra.lastDayBonusDate ?? null
      // The saved level is what this user has already seen — only level-ups
      // that happen live during this session should celebrate.
      state.seenLevel = row.level
    }
  } catch {
    if (token !== loadToken) return
    useToast().error('Impossible de charger la progression de ton jardin.')
  } finally {
    if (token === loadToken) state.loaded = true
  }
}

function reset() {
  loadToken++
  state.xp = 0
  state.activeDays = 0
  state.lastActiveDate = null
  state.lastPriorityBonusDate = null
  state.lastDayBonusDate = null
  state.seenLevel = 1
  state.loaded = false
}

// Un jardin par nook : chaque espace pousse à son rythme, et changer de nook
// recharge le sien.
const nooks = useNooks()
watch(
  nooks.activeId,
  (nookId) => {
    if (nookId) void load()
    else reset()
  },
  { immediate: true },
)

let saveTimer: number | undefined

function writeProgress(): Promise<void> {
  return gardenApi
    .updateGardenProgress({
      xp: state.xp,
      level: levelForXp(state.xp).level,
      activeDays: state.activeDays,
      lastActiveDate: state.lastActiveDate,
      extra: { lastPriorityBonusDate: state.lastPriorityBonusDate, lastDayBonusDate: state.lastDayBonusDate },
    })
    .catch(() => {
      useToast().error("La progression de ton jardin n'a pas pu être sauvegardée.")
    })
}

function persist() {
  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    saveTimer = undefined
    void writeProgress()
  }, 300)
}

// L'XP gagnée juste avant la bascule appartient au nook qu'on quitte.
onBeforeNookSwitch(() => {
  if (!saveTimer) return
  window.clearTimeout(saveTimer)
  saveTimer = undefined
  return writeProgress()
})

// Transient: a just-unlocked level, shown as a gentle "✨ Nouveau !" beat
// then cleared. Not persisted — it's a one-time celebration per session.
const celebration = reactive<{ level: GardenLevel | null }>({ level: null })
let celebrationTimer: number | undefined

export function useGarden() {
  const level = computed(() => levelForXp(state.xp))

  const unlockedElements = computed(() => {
    const set = new Set<string>()
    for (const l of GARDEN_LEVELS) {
      if (state.xp >= l.xpRequired) for (const u of l.unlocks) set.add(u)
    }
    return set
  })

  const nextLevel = computed(() => {
    const idx = GARDEN_LEVELS.findIndex((l) => l.level === level.value.level)
    return GARDEN_LEVELS[idx + 1] ?? null
  })

  const xpToNext = computed(() => (nextLevel.value ? nextLevel.value.xpRequired - state.xp : 0))

  const progressToNext = computed(() => {
    if (!nextLevel.value) return 1
    const span = nextLevel.value.xpRequired - level.value.xpRequired
    if (span <= 0) return 1
    return Math.min(1, (state.xp - level.value.xpRequired) / span)
  })

  const activeDaysCount = computed(() => state.activeDays)
  const isMaxLevel = computed(() => level.value.level === MAX_LEVEL.level)

  function celebrate(newLevel: GardenLevel) {
    celebration.level = newLevel
    if (celebrationTimer) window.clearTimeout(celebrationTimer)
    celebrationTimer = window.setTimeout(() => {
      celebration.level = null
    }, 4000)
  }

  function markActiveToday() {
    const t = todayISO()
    if (state.lastActiveDate !== t) {
      state.lastActiveDate = t
      state.activeDays += 1
    }
  }

  function addXp(amount: number) {
    if (amount <= 0) return
    const before = level.value.level
    state.xp += amount
    markActiveToday()
    persist()
    const after = levelForXp(state.xp).level
    if (after > before && after > state.seenLevel) {
      state.seenLevel = after
      const newLevel = levelForXp(state.xp)
      celebrate(newLevel)
      persist()
      void gardenApi.recordUnlocks(newLevel.unlocks.map((key) => ({ key, type: elementTypeFromKey(key) })))
    }
  }

  /** Call after a task is marked done, with whether it was the last open
   * high-priority task due today — awards the priority bonus once per day. */
  function notifyTaskCompleted(wasLastPriorityToday: boolean) {
    addXp(XP_TASK_COMPLETE)
    if (wasLastPriorityToday) {
      const today = todayISO()
      if (state.lastPriorityBonusDate !== today) {
        state.lastPriorityBonusDate = today
        persist()
        addXp(XP_PRIORITY_BONUS)
      }
    }
  }

  function notifyFocusStarted() {
    addXp(XP_FOCUS_START)
  }

  function notifyFocusCompleted() {
    addXp(XP_FOCUS_COMPLETE)
  }

  /** Lightweight periodic check: once the scheduled work day has ended and
   * the user actually worked some of it, award the day-complete bonus. Safe
   * to call often — it's a no-op once already awarded today. */
  function checkDayCompleteBonus() {
    const today = todayISO()
    if (state.lastDayBonusDate === today) return
    const { schedule } = useWorkSchedule()
    const now = nowMinutes(new Date())
    const start = toMinutes(schedule.startTime)
    const end = toMinutes(schedule.endTime)
    const lunchStart = toMinutes(schedule.lunchStart)
    const lunchEnd = toMinutes(schedule.lunchEnd)
    if (now < end) return
    const workedSomeMinutes = Math.max(0, Math.min(now, end) - start - Math.max(0, lunchEnd - lunchStart))
    if (workedSomeMinutes <= 0) return
    state.lastDayBonusDate = today
    persist()
    addXp(XP_DAY_COMPLETE_BONUS)
  }

  return {
    state,
    level,
    unlockedElements,
    nextLevel,
    xpToNext,
    progressToNext,
    activeDaysCount,
    isMaxLevel,
    celebration,
    addXp,
    notifyTaskCompleted,
    notifyFocusStarted,
    notifyFocusCompleted,
    checkDayCompleteBonus,
  }
}
