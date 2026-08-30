import { computed, reactive, watch } from 'vue'
import type { FocusAmbiance, Item } from '@/types'
import { useGarden } from '@/composables/useGarden'
import { useAuth } from '@/composables/useAuth'
import { onBeforeNookSwitch, useNooks } from '@/composables/useNooks'
import { currentNookId } from '@/lib/activeNook'
import { useStore } from '@/store/useStore'
import { useToast } from '@/composables/useToast'
import { prefsState, savePreferences } from '@/composables/usePreferencesStore'
import * as focusApi from '@/services/focus'

export const DURATION_PRESETS = [
  { minutes: 15, label: 'Sprint', description: 'Pour démarrer une tâche qui semble difficile.' },
  { minutes: 25, label: 'Focus', description: 'Le mode par défaut, inspiré du Pomodoro.' },
  { minutes: 50, label: 'Deep Focus', description: 'Pour une session plus longue.' },
] as const

interface TodaySession {
  actualSeconds: number
}

const today = reactive<{ sessions: TodaySession[]; loaded: boolean }>({ sessions: [], loaded: false })

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

let loadToken = 0

async function loadTodaySessions() {
  const token = ++loadToken
  try {
    const rows = await focusApi.listFocusSessions(startOfTodayIso())
    if (token !== loadToken) return
    today.sessions = rows.map((r) => ({ actualSeconds: r.actual_duration }))
  } catch {
    if (token !== loadToken) return
    useToast().error('Impossible de charger tes sessions Focus.')
  } finally {
    if (token === loadToken) today.loaded = true
  }
}

function resetTodaySessions() {
  loadToken++
  today.sessions = []
  today.loaded = false
}

type Phase = 'setup' | 'running' | 'paused' | 'complete'

interface FocusState {
  isActive: boolean
  phase: Phase
  task: Item | null
  durationMinutes: number
  remainingSeconds: number
  sessionNumber: number
}

const state = reactive<FocusState>({
  isActive: false,
  phase: 'setup',
  task: null,
  durationMinutes: 25,
  remainingSeconds: 25 * 60,
  sessionNumber: 1,
})

// --- Wall-clock timing -----------------------------------------------------
// The countdown is derived from a deadline, never accumulated by decrementing
// a counter once per tick. Browsers throttle timers in background tabs and
// stop them entirely when the machine sleeps — and a focus tool is used
// precisely while its tab is not the one being looked at. The interval below
// only decides when to repaint; the deadline decides what the number is.

let deadlineMs: number | null = null
let timerHandle: number | undefined
let currentSessionStartedAt: string | null = null

function remainingFromDeadline(): number {
  if (deadlineMs === null) return state.remainingSeconds
  return Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000))
}

function stopTicking() {
  if (timerHandle !== undefined) {
    window.clearInterval(timerHandle)
    timerHandle = undefined
  }
}

function startTicking() {
  stopTicking()
  // Faster than 1s so the displayed second flips close to when it really
  // changes, rather than drifting up to a full second away from the deadline.
  timerHandle = window.setInterval(() => {
    state.remainingSeconds = remainingFromDeadline()
    if (state.remainingSeconds <= 0) {
      stopTicking()
      completeSession(true, deadlineMs ? new Date(deadlineMs).toISOString() : undefined)
    }
  }, 250)
}

// --- Crash / reload survival ----------------------------------------------
// Everything above lives in memory, so a reload, a closed tab or a crash used
// to erase the session outright: no resume, and no row in focus_sessions
// either, so the time worked simply vanished. The snapshot below is written on
// every state change and replayed on startup.

const PERSIST_KEY = 'nook.focus.active'

/** Past this much time after the deadline, a session found on startup is
 *  treated as abandoned rather than achieved. Reopening the app days later
 *  should not congratulate you — or feed the garden — for a timer that ran out
 *  in an closed tab. */
const STALE_AFTER_MS = 2 * 60 * 60 * 1000

interface PersistedSession {
  userId: string
  /** Le nook où la session a commencé — une session ne se reprend pas ailleurs. */
  nookId: string | null
  taskId: string
  durationMinutes: number
  sessionNumber: number
  startedAt: string
  phase: 'running' | 'paused'
  /** Epoch ms. Null while paused — then remainingSeconds is authoritative. */
  deadlineMs: number | null
  remainingSeconds: number
}

const auth = useAuth()
const store = useStore()

function persist() {
  const userId = auth.state.user?.id
  if (!userId || !state.task || !currentSessionStartedAt) return
  if (state.phase !== 'running' && state.phase !== 'paused') return
  const payload: PersistedSession = {
    userId,
    nookId: currentSessionNookId,
    taskId: state.task.id,
    durationMinutes: state.durationMinutes,
    sessionNumber: state.sessionNumber,
    startedAt: currentSessionStartedAt,
    phase: state.phase,
    deadlineMs,
    remainingSeconds: state.remainingSeconds,
  }
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(payload))
  } catch {
    // Private mode or a full quota: losing resume is bad but not fatal.
  }
}

function clearPersisted() {
  try {
    localStorage.removeItem(PERSIST_KEY)
  } catch {
    /* nothing to do */
  }
}

function readPersisted(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    return raw ? (JSON.parse(raw) as PersistedSession) : null
  } catch {
    return null
  }
}

let restored = false

function restoreSession() {
  if (restored) return
  const saved = readPersisted()
  if (!saved) {
    restored = true
    return
  }
  // Never replay one account's session into another's.
  if (saved.userId !== auth.state.user?.id) {
    clearPersisted()
    restored = true
    return
  }
  // Ni dans un autre nook. On garde l'instantané sans le reprendre : revenir
  // dans le bon nook doit encore pouvoir le retrouver.
  if (saved.nookId && saved.nookId !== currentNookId()) {
    restored = true
    return
  }
  const task = store.items.value.find((it) => it.id === saved.taskId)
  if (!task) {
    // The task was deleted while away; there is nothing to resume onto.
    clearPersisted()
    restored = true
    return
  }
  restored = true

  state.task = task
  state.durationMinutes = saved.durationMinutes
  state.sessionNumber = saved.sessionNumber
  currentSessionStartedAt = saved.startedAt
  currentSessionNookId = saved.nookId ?? currentNookId()
  state.isActive = true

  if (saved.phase === 'paused') {
    deadlineMs = null
    state.remainingSeconds = saved.remainingSeconds
    state.phase = 'paused'
    return
  }

  deadlineMs = saved.deadlineMs
  state.remainingSeconds = remainingFromDeadline()

  if (state.remainingSeconds > 0) {
    state.phase = 'running'
    startTicking()
    return
  }

  // The countdown ran out while the app was closed.
  const endedAtIso = deadlineMs ? new Date(deadlineMs).toISOString() : undefined
  const overdueMs = deadlineMs ? Date.now() - deadlineMs : 0

  if (overdueMs > STALE_AFTER_MS) {
    // Too old to claim as focused time: record it, credit nothing, say so.
    saveSession(false, endedAtIso)
    deadlineMs = null
    clearPersisted()
    state.isActive = false
    state.task = null
    state.phase = 'setup'
    useToast().push('Une session Focus était restée ouverte — elle a été clôturée.')
    return
  }

  // Recent enough that the user really did let it run: credit it, stamped at
  // the moment it actually finished rather than now.
  completeSession(true, endedAtIso)
}

// Les sessions du jour sont celles du nook ouvert : le compteur « Ma journée »
// et le rapport ne mélangent pas le temps pro et le temps perso.
const nooks = useNooks()
watch(
  nooks.activeId,
  (nookId) => {
    if (nookId) void loadTodaySessions()
    else resetTodaySessions()
  },
  { immediate: true },
)

watch(
  auth.session,
  (session) => {
    if (session) return
    // auth.session is null both before Supabase has restored the session and
    // after a real sign-out. Only the second is a logout — treating the first
    // as one wiped the snapshot on every page load, before it could be read.
    if (auth.state.isLoading) return

    resetTodaySessions()
    stopTicking()
    clearPersisted()
    restored = false
    state.isActive = false
    state.task = null
    deadlineMs = null
    currentSessionStartedAt = null
    currentSessionNookId = null
  },
  { immediate: true },
)

/**
 * Une session en cours porte sur une tâche du nook qu'on quitte : elle est
 * clôturée et rangée dans *son* nook plutôt que suivre l'utilisateur dans le
 * suivant, où sa tâche n'existe pas.
 */
onBeforeNookSwitch(() => {
  if (!state.isActive) return
  stopTicking()
  if (state.phase === 'running' || state.phase === 'paused') {
    state.remainingSeconds = remainingFromDeadline()
    saveSession(false)
    useToast().push('Ta session Focus a été clôturée et rangée dans le nook que tu quittes.')
  }
  deadlineMs = null
  clearPersisted()
  restored = false
  state.isActive = false
  state.task = null
  state.phase = 'setup'
})

// The snapshot names a task by id, so it can only be replayed once the store
// has the items to resolve it against.
watch(
  () => store.loaded.value && Boolean(auth.state.user),
  (ready) => {
    if (ready) restoreSession()
  },
  { immediate: true },
)

/**
 * Le nook dans lequel la session courante a commencé. Une session lancée sur
 * une tâche du nook pro reste du temps pro, même si elle se clôture après une
 * bascule.
 */
let currentSessionNookId: string | null = null

function presetLabel(minutes: number): string | null {
  return DURATION_PRESETS.find((p) => p.minutes === minutes)?.label ?? null
}

function saveSession(completed: boolean, endedAtIso?: string) {
  if (!state.task || !currentSessionStartedAt) return
  const actualSeconds = Math.max(0, state.durationMinutes * 60 - state.remainingSeconds)
  const endedAt = endedAtIso ?? new Date().toISOString()

  today.sessions.push({ actualSeconds })

  focusApi
    .createFocusSession({
      id: crypto.randomUUID(),
      nookId: currentSessionNookId ?? undefined,
      itemId: state.task.id,
      mode: presetLabel(state.durationMinutes),
      plannedDuration: state.durationMinutes,
      actualDuration: actualSeconds,
      startedAt: currentSessionStartedAt,
      endedAt,
      completed,
    })
    .catch(() => {
      useToast().error("Cette session Focus n'a pas pu être enregistrée.")
    })

  currentSessionStartedAt = null
  currentSessionNookId = null
}

function completeSession(completed: boolean, endedAtIso?: string) {
  stopTicking()
  state.remainingSeconds = completed ? 0 : remainingFromDeadline()
  saveSession(completed, endedAtIso)
  deadlineMs = null
  clearPersisted()
  state.phase = 'complete'
  if (completed) useGarden().notifyFocusCompleted()
}

export function useFocusSession() {
  const todayFocusStats = computed(() => {
    const totalSeconds = today.sessions.reduce((sum, s) => sum + s.actualSeconds, 0)
    return { totalSeconds, sessionCount: today.sessions.length }
  })

  /**
   * Ouvre le mode Focus sur une tâche.
   *
   * `minutes` pré-remplit la durée — c'est par là qu'arrive un créneau du
   * planning, qui connaît déjà le temps qu'on s'était réservé. Sans lui, on
   * reprend la dernière durée choisie.
   */
  function openFocus(task: Item, minutes?: number) {
    state.task = task
    state.phase = 'setup'
    state.durationMinutes = minutes && minutes > 0 ? Math.round(minutes) : prefsState.focusLastDuration
    state.remainingSeconds = state.durationMinutes * 60
    deadlineMs = null
    state.isActive = true
  }

  function startSession(minutes: number) {
    if (!state.task) return
    prefsState.focusLastDuration = minutes
    savePreferences()
    state.durationMinutes = minutes
    state.remainingSeconds = minutes * 60
    state.sessionNumber = today.sessions.length + 1
    currentSessionStartedAt = new Date().toISOString()
    currentSessionNookId = currentNookId()
    deadlineMs = Date.now() + minutes * 60 * 1000
    state.phase = 'running'
    persist()
    startTicking()
    useGarden().notifyFocusStarted()
  }

  function pause() {
    if (state.phase !== 'running') return
    stopTicking()
    state.remainingSeconds = remainingFromDeadline()
    deadlineMs = null
    state.phase = 'paused'
    persist()
  }

  function resume() {
    if (state.phase !== 'paused') return
    deadlineMs = Date.now() + state.remainingSeconds * 1000
    state.phase = 'running'
    persist()
    startTicking()
  }

  function finishTask(toggleTaskDone: (id: string) => void) {
    if (!state.task) return
    if (state.task.status !== 'done') toggleTaskDone(state.task.id)
    completeSession(true)
  }

  function quitFocus() {
    stopTicking()
    if (state.phase === 'running' || state.phase === 'paused') {
      state.remainingSeconds = remainingFromDeadline()
      saveSession(false)
    }
    deadlineMs = null
    clearPersisted()
    state.isActive = false
    state.task = null
    currentSessionStartedAt = null
  }

  function continueSession() {
    if (!state.task) return
    startSession(state.durationMinutes)
  }

  function captureThought(addTask: (input: { title: string; folderId?: string | null }) => void, title: string) {
    const trimmed = title.trim()
    if (!trimmed) return
    addTask({ title: trimmed, folderId: null })
  }

  function setAmbiance(value: FocusAmbiance) {
    prefsState.focusAmbiance = value
    savePreferences()
    // Placeholder hook: wire actual ambient-audio playback here later
    // (e.g. play(value) / stop()) — architecture only for the MVP.
  }

  return {
    state,
    ambiance: computed(() => prefsState.focusAmbiance as FocusAmbiance),
    todayFocusStats,
    openFocus,
    startSession,
    pause,
    resume,
    finishTask,
    quitFocus,
    continueSession,
    captureThought,
    setAmbiance,
  }
}
