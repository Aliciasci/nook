<script setup lang="ts">
/**
 * La grille horaire : règle des heures à gauche, une colonne par jour affiché.
 *
 * Un seul composant pour la vue jour et la vue semaine — c'est la même grille,
 * à une colonne près. Les sept colonnes partagent une seule surface : le
 * pointeur en tire un jour par son abscisse et une minute par son ordonnée,
 * ce qui rend le déplacement d'un créneau de mardi à jeudi gratuit. Deux
 * surfaces séparées auraient demandé de relayer le geste de l'une à l'autre.
 *
 * Trois gestes, deux mécaniques de glisser assumées :
 *
 * - Déposer une tâche depuis la liste voisine passe par le glisser-déposer
 *   natif, comme partout ailleurs dans Nook — il traverse les composants.
 * - Créer, déplacer et redimensionner un créneau passe par les événements
 *   pointeur : le glisser natif ne donne pas de position continue, et sur une
 *   grille horaire c'est précisément ce qu'il faut.
 */
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import type { TimeBlock, TimeBlockKind } from '@/types'
import { useTimeBlocks, parseDayIso, toDayIso } from '@/store/useTimeBlocks'
import { activityKind } from '@/utils/activityKinds'
import { useWorkSchedule } from '@/composables/useWorkSchedule'
import { toMinutes, nowMinutes } from '@/utils/time'
import TimeBlockCard from '@/components/planning/TimeBlockCard.vue'

const props = defineProps<{
  /** Les jours affichés, dans l'ordre — un seul en vue jour, sept en semaine. */
  days: string[]
  now: Date
}>()

const emit = defineEmits<{ focus: [block: TimeBlock]; pickDay: [day: string] }>()

const blocks = useTimeBlocks()
const { schedule } = useWorkSchedule()

/* ---------------------------------------------------------- Géométrie --- */

const PX_PER_MIN = 1.2
const SNAP = 15
/** Durée d'un créneau créé par simple dépôt, sans étirement. */
const DEFAULT_DURATION = 60

/** Le jour courant dérive de `now`, donc il tourne tout seul à minuit. */
const today = computed(() => toDayIso(props.now))
const multi = computed(() => props.days.length > 1)

/** Les créneaux réellement enregistrés sur les jours affichés. */
const realBlocks = computed(() => props.days.flatMap((d) => blocks.blocksForDay(d)))

const workStart = computed(() => toMinutes(schedule.startTime))
const workEnd = computed(() => toMinutes(schedule.endTime))
const lunchStart = computed(() => toMinutes(schedule.lunchStart))
const lunchEnd = computed(() => toMinutes(schedule.lunchEnd))

const showsToday = computed(() => props.days.includes(today.value))

/**
 * Les bornes visibles : la journée de travail, élargie à ce qui déborde.
 * Un créneau posé à 7h ou à 21h doit rester visible, sans forcer tout le monde
 * à faire défiler une grille de minuit à minuit.
 *
 * Les bornes se calculent sur les créneaux enregistrés, jamais sur la position
 * provisoire d'un geste : une grille qui s'étire sous le curseur pendant qu'on
 * déplace un créneau déplacerait aussi tous les autres.
 */
const viewStart = computed(() => {
  let min = workStart.value
  for (const b of realBlocks.value) min = Math.min(min, b.startMinute)
  if (showsToday.value) min = Math.min(min, nowMinutes(props.now))
  return Math.max(0, Math.floor(min / 60) * 60 - 60)
})

const viewEnd = computed(() => {
  let max = workEnd.value
  for (const b of realBlocks.value) max = Math.max(max, b.endMinute)
  if (showsToday.value) max = Math.max(max, nowMinutes(props.now))
  return Math.min(1440, Math.ceil(max / 60) * 60 + 60)
})

const gridHeight = computed(() => (viewEnd.value - viewStart.value) * PX_PER_MIN)

const hourMarks = computed(() => {
  const marks: number[] = []
  for (let m = Math.ceil(viewStart.value / 60) * 60; m <= viewEnd.value; m += 60) marks.push(m)
  return marks
})

function yOf(minute: number): number {
  return (minute - viewStart.value) * PX_PER_MIN
}

function minuteOf(y: number): number {
  return viewStart.value + y / PX_PER_MIN
}

function snap(minute: number): number {
  return Math.round(minute / SNAP) * SNAP
}

function clampMinute(minute: number): number {
  return Math.max(0, Math.min(1440, minute))
}

function hhmm(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(Math.round(minute) % 60).padStart(2, '0')}`
}

const nowY = computed(() => yOf(nowMinutes(props.now)))

/**
 * L'heure ronde que la pastille de l'heure courante recouvre s'efface : à
 * 17h11, « 17:00 » dépassant de dessous la pastille se lit comme une faute
 * d'affichage plutôt que comme deux repères.
 */
function hiddenByNow(minute: number): boolean {
  return nowVisible.value && Math.abs(yOf(minute) - nowY.value) < 20
}
const nowVisible = computed(
  () => showsToday.value && nowMinutes(props.now) >= viewStart.value && nowMinutes(props.now) <= viewEnd.value,
)

/* ------------------------------------------------------ En-têtes de jour --- */

function headerLabel(day: string): { weekday: string; number: string } {
  const date = parseDayIso(day)
  return {
    weekday: date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''),
    number: String(date.getDate()),
  }
}

function isWeekend(day: string): boolean {
  const wd = parseDayIso(day).getDay()
  return wd === 0 || wd === 6
}

/* -------------------------------------------- Empilement des recouvrements --- */

interface Placed {
  block: TimeBlock
  lane: number
  lanes: number
}

/**
 * Deux créneaux qui se chevauchent se partagent la largeur.
 *
 * Les créneaux sont regroupés en grappes de recouvrement transitif — A touche
 * B, B touche C, donc les trois se partagent la colonne même si A et C ne se
 * touchent pas. Sans ça, A et C se superposeraient à l'identique.
 */
function place(dayBlocks: TimeBlock[]): Placed[] {
  const sorted = dayBlocks.slice().sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute)
  const out: Placed[] = []
  let cluster: TimeBlock[] = []
  let clusterEnd = -1

  const flush = () => {
    if (!cluster.length) return
    // Attribution gloutonne : chaque créneau prend la première voie libre.
    const laneEnds: number[] = []
    const lanes: number[] = []
    for (const b of cluster) {
      let lane = laneEnds.findIndex((end) => end <= b.startMinute)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(b.endMinute)
      } else {
        laneEnds[lane] = b.endMinute
      }
      lanes.push(lane)
    }
    const count = laneEnds.length
    cluster.forEach((b, i) => out.push({ block: b, lane: lanes[i], lanes: count }))
    cluster = []
    clusterEnd = -1
  }

  for (const b of sorted) {
    if (cluster.length && b.startMinute >= clusterEnd) flush()
    cluster.push(b)
    clusterEnd = Math.max(clusterEnd, b.endMinute)
  }
  flush()
  return out
}

/**
 * Les créneaux tels qu'ils doivent s'afficher *maintenant* : celui qu'on est
 * en train de déplacer ou d'étirer porte la position du geste, pas encore
 * écrite en base. Le placement se fait donc sur des créneaux déjà déplacés,
 * et un créneau tiré vers un autre jour change de colonne de lui-même — y
 * compris dans le calcul des recouvrements de sa colonne d'arrivée.
 */
const effective = computed<TimeBlock[]>(() => {
  const g = gesture.value
  if (!g || g.kind === 'create') return realBlocks.value
  return realBlocks.value.map((b) => {
    if (b.id !== g.id) return b
    if (g.kind === 'move') return { ...b, day: g.day, startMinute: g.start, endMinute: g.start + g.duration }
    return { ...b, endMinute: g.end }
  })
})

const placedByDay = computed(() => {
  const map = new Map<string, Placed[]>()
  for (const day of props.days) map.set(day, place(effective.value.filter((b) => b.day === day)))
  return map
})

function styleOf(p: Placed) {
  const width = 100 / p.lanes
  return {
    top: `${yOf(p.block.startMinute)}px`,
    height: `${heightOf(p)}px`,
    left: `${p.lane * width}%`,
    width: `calc(${width}% - 4px)`,
  }
}

function heightOf(p: Placed): number {
  return Math.max(18, (p.block.endMinute - p.block.startMinute) * PX_PER_MIN - 2)
}

/* ------------------------------------------------- Gestes au pointeur --- */

const surface = ref<HTMLElement | null>(null)

type Gesture =
  | { kind: 'create'; day: string; anchor: number; start: number; end: number }
  | { kind: 'move'; id: string; day: string; grab: number; duration: number; start: number }
  | { kind: 'resize'; id: string; start: number; end: number }

const gesture = ref<Gesture | null>(null)

function localMinute(e: PointerEvent): number {
  const rect = surface.value!.getBoundingClientRect()
  return clampMinute(minuteOf(e.clientY - rect.top))
}

/** Le jour sous le pointeur : les colonnes se partagent la surface à égalité. */
function dayAt(clientX: number): string {
  const rect = surface.value!.getBoundingClientRect()
  const index = Math.floor(((clientX - rect.left) / rect.width) * props.days.length)
  return props.days[Math.max(0, Math.min(props.days.length - 1, index))]
}

function onSurfaceDown(e: PointerEvent) {
  // Bouton principal seulement. Les cartes arrêtent leur propre `pointerdown`
  // (`.stop`) : sans ça il remonterait jusqu'ici et le geste « déplacer »
  // serait aussitôt écrasé par un geste « créer ».
  if (e.button !== 0 || !surface.value) return
  const m = snap(localMinute(e))
  gesture.value = { kind: 'create', day: dayAt(e.clientX), anchor: m, start: m, end: m + SNAP }
  surface.value.setPointerCapture(e.pointerId)
}

function onMoveStart(block: TimeBlock, e: PointerEvent) {
  if (e.button !== 0 || !surface.value) return
  gesture.value = {
    kind: 'move',
    id: block.id,
    day: block.day,
    grab: localMinute(e) - block.startMinute,
    duration: block.endMinute - block.startMinute,
    start: block.startMinute,
  }
  surface.value.setPointerCapture(e.pointerId)
}

function onResizeStart(block: TimeBlock, e: PointerEvent) {
  if (e.button !== 0 || !surface.value) return
  gesture.value = { kind: 'resize', id: block.id, start: block.startMinute, end: block.endMinute }
  surface.value.setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  const g = gesture.value
  if (!g || !surface.value) return
  const m = localMinute(e)

  if (g.kind === 'create') {
    // Le tracé reste dans la colonne où il a commencé : un créneau à cheval
    // sur deux jours n'existe pas.
    const a = Math.min(g.anchor, snap(m))
    const b = Math.max(g.anchor, snap(m))
    gesture.value = { ...g, start: a, end: Math.max(b, a + SNAP) }
    return
  }
  if (g.kind === 'move') {
    const start = clampMinute(snap(m - g.grab))
    gesture.value = { ...g, day: dayAt(e.clientX), start: Math.min(start, 1440 - g.duration) }
    return
  }
  gesture.value = { ...g, end: Math.max(snap(m), g.start + SNAP) }
}

function onPointerUp() {
  const g = gesture.value
  gesture.value = null
  if (!g) return

  if (g.kind === 'create') {
    // Un simple clic (sans étirement) ne crée rien : sur une grille, cliquer
    // pour regarder est plus fréquent que cliquer pour poser.
    if (g.end - g.start <= SNAP) return
    startFreeBlock(g.day, g.start, g.end)
    return
  }
  if (g.kind === 'move') {
    const block = realBlocks.value.find((b) => b.id === g.id)
    if (block && (block.startMinute !== g.start || block.day !== g.day)) {
      blocks.updateBlock(g.id, { day: g.day, startMinute: g.start, endMinute: g.start + g.duration })
    }
    return
  }
  const block = realBlocks.value.find((b) => b.id === g.id)
  if (block && block.endMinute !== g.end) blocks.updateBlock(g.id, { endMinute: g.end })
}

onBeforeUnmount(() => {
  gesture.value = null
})

/** Aperçu du créneau en cours de création, dans sa colonne. */
function draftFor(day: string) {
  const g = gesture.value
  if (!g || g.kind !== 'create' || g.day !== day) return null
  return {
    style: { top: `${yOf(g.start)}px`, height: `${Math.max(4, (g.end - g.start) * PX_PER_MIN)}px` },
    label: `${hhmm(g.start)} – ${hhmm(g.end)}`,
  }
}

/* ------------------------------------------------- Nouveau bloc libre --- */

const newBlock = ref<{ day: string; start: number; end: number; title: string } | null>(null)
const newBlockInput = ref<HTMLInputElement>()

function startFreeBlock(day: string, start: number, end: number) {
  newBlock.value = { day, start, end, title: '' }
  void nextTick(() => newBlockInput.value?.focus())
}

function confirmFreeBlock() {
  const draft = newBlock.value
  if (!draft) return
  const title = draft.title.trim()
  newBlock.value = null
  if (!title) return
  blocks.addBlock({ day: draft.day, startMinute: draft.start, endMinute: draft.end, title })
}

/* ------------------------------------------- Dépôt d'une tâche (natif) --- */

const drop = ref<{ day: string; minute: number } | null>(null)

function onDragOver(e: DragEvent) {
  if (!surface.value) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  const rect = surface.value.getBoundingClientRect()
  drop.value = { day: dayAt(e.clientX), minute: snap(clampMinute(minuteOf(e.clientY - rect.top))) }
}

function onDragLeave() {
  drop.value = null
}

/**
 * Deux choses peuvent tomber sur la grille : une tâche depuis « À caser », ou
 * une activité depuis la rangée de suggestions. L'activité est regardée en
 * premier — elle porte son propre type, quand une tâche se replie sur
 * `text/plain`.
 */
function onDrop(e: DragEvent) {
  e.preventDefault()
  const target = drop.value
  drop.value = null
  if (!target) return

  const kind = activityKind(e.dataTransfer?.getData('application/x-nook-activity') as TimeBlockKind | null)
  if (kind) {
    blocks.addBlock({
      day: target.day,
      startMinute: target.minute,
      endMinute: Math.min(1440, target.minute + DEFAULT_DURATION),
      title: kind.label,
      kind: kind.id,
    })
    return
  }

  const itemId = e.dataTransfer?.getData('application/x-nook-item') || e.dataTransfer?.getData('text/plain')
  if (!itemId) return
  blocks.addBlock({
    day: target.day,
    startMinute: target.minute,
    endMinute: Math.min(1440, target.minute + DEFAULT_DURATION),
    itemId,
  })
}
</script>

<template>
  <!-- Sept colonnes ne tiennent pas sous ~760 px : la grille défile alors
       latéralement plutôt que d'écraser les jours à 40 px de large. En vue
       jour, une seule colonne, rien à faire défiler. -->
  <div :class="multi ? 'overflow-x-auto pb-1' : ''">
    <!-- En-têtes de jour, alignés sur les colonnes : la gouttière de gauche
         reprend exactement la largeur de la règle des heures. -->
    <div v-if="multi" class="mb-1.5 flex min-w-[760px] gap-2">
      <div class="w-12 shrink-0" />
      <div class="grid flex-1" :style="{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }">
        <button
          v-for="d in days"
          :key="d"
          type="button"
          class="flex items-baseline justify-center gap-1.5 rounded-lg py-1 transition-colors cursor-pointer hover:bg-lavender-50"
          :title="`Voir le ${headerLabel(d).number} en vue jour`"
          @click="emit('pickDay', d)"
        >
          <span class="text-[11px] uppercase tracking-wide" :class="d === today ? 'text-lavender-600' : 'text-ink-faint'">
            {{ headerLabel(d).weekday }}
          </span>
          <span
            class="text-[13px] font-medium tabular-nums"
            :class="
              d === today
                ? 'flex h-[21px] w-[21px] items-center justify-center rounded-full bg-lavender-500 text-white'
                : 'text-ink'
            "
          >
            {{ headerLabel(d).number }}
          </span>
        </button>
      </div>
    </div>

    <div class="flex gap-2" :class="multi ? 'min-w-[760px]' : ''">
      <!-- Règle des heures -->
      <div class="relative w-12 shrink-0" :style="{ height: `${gridHeight}px` }">
        <span
          v-for="m in hourMarks"
          :key="m"
          v-show="!hiddenByNow(m)"
          class="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-ink-faint"
          :style="{ top: `${yOf(m)}px` }"
        >
          {{ hhmm(m) }}
        </span>

        <!-- L'heure courante se lit dans la règle, pas dans la grille : la
             surface rogne ce qui la dépasse, et une pastille posée sur les
             créneaux mangerait un titre. Elle couvre l'heure ronde voisine,
             ce qui est exactement ce qu'on veut — c'est elle qui compte. -->
        <span
          v-if="nowVisible"
          class="absolute right-1 z-10 -translate-y-1/2 rounded-full bg-white px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-rose-500 shadow-soft ring-1 ring-rose-200"
          :style="{ top: `${nowY}px` }"
        >
          {{ hhmm(nowMinutes(now)) }}
        </span>
      </div>

      <!-- Surface : une seule, découpée en colonnes -->
      <div
        ref="surface"
        class="relative grid flex-1 touch-none overflow-hidden rounded-xl bg-white ring-1 ring-ink/[0.08]"
        :style="{ height: `${gridHeight}px`, gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }"
        @pointerdown="onSurfaceDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <!-- Décor commun à toutes les colonnes : hors journée de travail,
             pause déjeuner, lignes d'heure. -->
        <div
          v-if="workStart > viewStart"
          class="pointer-events-none absolute inset-x-0 top-0 bg-ink/[0.025]"
          :style="{ height: `${yOf(workStart)}px` }"
        />
        <div
          v-if="workEnd < viewEnd"
          class="pointer-events-none absolute inset-x-0 bottom-0 bg-ink/[0.025]"
          :style="{ top: `${yOf(workEnd)}px` }"
        />
        <div
          class="pointer-events-none absolute inset-x-0 bg-ink/[0.025]"
          :style="{ top: `${yOf(lunchStart)}px`, height: `${(lunchEnd - lunchStart) * PX_PER_MIN}px` }"
        />
        <div
          v-for="m in hourMarks"
          :key="m"
          class="pointer-events-none absolute inset-x-0 border-t border-line"
          :style="{ top: `${yOf(m)}px` }"
        />

        <!-- Colonnes -->
        <div
          v-for="(d, i) in days"
          :key="d"
          :data-day="d"
          class="relative"
          :class="i > 0 ? 'border-l border-line' : ''"
        >
          <!-- Week-end : à peine teinté, pour que la semaine se lise d'un coup -->
          <div v-if="multi && isWeekend(d)" class="pointer-events-none absolute inset-0 bg-ink/[0.02]" />

          <!-- Heure courante, sur la seule colonne d'aujourd'hui -->
          <div
            v-if="nowVisible && d === today"
            class="pointer-events-none absolute inset-x-0 z-20"
            :style="{ top: `${nowY}px` }"
          >
            <div class="relative border-t border-rose-400/80">
              <div class="absolute right-0 -top-[3.5px] h-[7px] w-[7px] rounded-full bg-rose-400" />
            </div>
          </div>

          <!-- Repère de dépôt d'une tâche -->
          <div
            v-if="drop && drop.day === d"
            class="pointer-events-none absolute inset-x-1 z-20 rounded-md border-2 border-dashed border-lavender-400 bg-lavender-100/40"
            :style="{ top: `${yOf(drop.minute)}px`, height: `${DEFAULT_DURATION * PX_PER_MIN}px` }"
          >
            <span class="px-1.5 text-[10.5px] font-medium text-lavender-700">{{ hhmm(drop.minute) }}</span>
          </div>

          <!-- Créneau en cours de tracé -->
          <div
            v-if="draftFor(d)"
            class="pointer-events-none absolute inset-x-1 z-20 rounded-md border-2 border-dashed border-lavender-400 bg-lavender-100/50"
            :style="draftFor(d)!.style"
          >
            <span class="px-1.5 text-[10.5px] font-medium text-lavender-700">{{ draftFor(d)!.label }}</span>
          </div>

          <!-- Créneaux -->
          <div v-for="p in placedByDay.get(d)" :key="p.block.id" class="absolute z-10 pl-0.5" :style="styleOf(p)">
            <TimeBlockCard
              :block="p.block"
              :height="heightOf(p)"
              :active="gesture !== null && gesture.kind !== 'create' && gesture.id === p.block.id"
              @focus="emit('focus', $event)"
              @remove="blocks.removeBlock($event.id)"
              @move-start="onMoveStart"
              @resize-start="onResizeStart"
            />
          </div>

          <!-- Nom du nouveau bloc libre -->
          <div
            v-if="newBlock && newBlock.day === d"
            class="absolute inset-x-1 z-30 rounded-lg bg-white p-2 shadow-soft-lg ring-1 ring-lavender-300"
            :style="{ top: `${yOf(newBlock.start)}px` }"
            @pointerdown.stop
          >
            <p class="mb-1 text-[10.5px] text-ink-faint">{{ hhmm(newBlock.start) }} – {{ hhmm(newBlock.end) }}</p>
            <input
              ref="newBlockInput"
              v-model="newBlock.title"
              type="text"
              maxlength="80"
              placeholder="Réunion, sport, trajet…"
              class="w-full rounded-md bg-paper px-2 py-1 text-[12.5px] text-ink outline-none ring-1 ring-ink/[0.08] focus:ring-2 focus:ring-lavender-300"
              @keydown.enter.prevent="confirmFreeBlock"
              @keydown.esc.prevent="newBlock = null"
              @blur="confirmFreeBlock"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
