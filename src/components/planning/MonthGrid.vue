<script setup lang="ts">
/**
 * Le mois : six semaines de sept cases, chacune donnant le temps bloqué du
 * jour et ses premiers créneaux.
 *
 * Pas de règle des heures ici, donc aucun des gestes de la grille horaire :
 * tracer ou étirer à l'échelle d'une case de 90 px n'aurait pas la précision
 * du quart d'heure. Restent les deux gestes qui gardent du sens — déposer une
 * tâche sur un jour, et ouvrir un jour en vue jour.
 */
import { computed, ref } from 'vue'
import type { TimeBlock, TimeBlockKind } from '@/types'
import { useTimeBlocks, parseDayIso, toDayIso } from '@/store/useTimeBlocks'
import { activityKind } from '@/utils/activityKinds'
import { useWorkSchedule } from '@/composables/useWorkSchedule'
import { resolvePalette } from '@/utils/activityPalette'
import { formatDuration, toMinutes } from '@/utils/time'

const props = defineProps<{
  /** Les 42 jours de la grille, du lundi au dimanche. */
  days: string[]
  /** N'importe quel jour du mois affiché — sert à distinguer les jours voisins. */
  month: string
  now: Date
}>()

const emit = defineEmits<{ pickDay: [day: string] }>()

const blocks = useTimeBlocks()
const { schedule } = useWorkSchedule()

/** Au-delà de trois créneaux, la case compte le reste plutôt que de s'allonger. */
const MAX_VISIBLE = 3
/** Durée d'un créneau créé par dépôt sur une case. */
const DEFAULT_DURATION = 60

const WEEKDAYS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']

const today = computed(() => toDayIso(props.now))
const monthIndex = computed(() => parseDayIso(props.month).getMonth())

/** Les six semaines, pour que chaque ligne soit une rangée de la grille. */
const weeks = computed(() => Array.from({ length: 6 }, (_, i) => props.days.slice(i * 7, i * 7 + 7)))

function inMonth(day: string): boolean {
  return parseDayIso(day).getMonth() === monthIndex.value
}

function isWeekend(day: string): boolean {
  const wd = parseDayIso(day).getDay()
  return wd === 0 || wd === 6
}

function dayNumber(day: string): string {
  return String(parseDayIso(day).getDate())
}

function dayBlocks(day: string): TimeBlock[] {
  return blocks.blocksForDay(day)
}

function plannedOf(day: string): number {
  return dayBlocks(day).reduce((sum, b) => sum + blocks.plannedMinutes(b), 0)
}

function hhmm(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}

/** La teinte du créneau, résolue : une catégorie peut porter une couleur libre. */
function dotStyle(block: TimeBlock): Record<string, string> {
  return { backgroundColor: resolvePalette(blocks.colorOf(block)).solid }
}

/* ------------------------------------------- Dépôt d'une tâche (natif) --- */

const dropDay = ref<string | null>(null)

function onDragOver(day: string, e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  dropDay.value = day
}

/**
 * Une tâche depuis « À caser », ou une activité depuis la rangée de
 * suggestions : une case de mois accepte les deux, comme la grille horaire.
 */
function onDrop(day: string, e: DragEvent) {
  e.preventDefault()
  dropDay.value = null

  const kind = activityKind(e.dataTransfer?.getData('application/x-nook-activity') as TimeBlockKind | null)
  const itemId = kind
    ? null
    : e.dataTransfer?.getData('application/x-nook-item') || e.dataTransfer?.getData('text/plain')
  if (!kind && !itemId) return

  // Sans heure sous le pointeur, le créneau se pose au début de la journée de
  // travail, à la suite de ce qui y est déjà.
  const start = dayBlocks(day).reduce((end, b) => Math.max(end, b.endMinute), toMinutes(schedule.startTime))
  blocks.addBlock({
    day,
    startMinute: Math.min(start, 1440 - DEFAULT_DURATION),
    endMinute: Math.min(1440, start + DEFAULT_DURATION),
    itemId,
    title: kind?.label,
    kind: kind?.id ?? null,
  })
}
</script>

<template>
  <div class="overflow-hidden rounded-xl bg-white ring-1 ring-ink/[0.08]">
    <div class="grid grid-cols-7 border-b border-line">
      <div
        v-for="(w, i) in WEEKDAYS"
        :key="w"
        class="py-2 text-center text-[11px] uppercase tracking-wide"
        :class="i >= 5 ? 'text-ink-faint/70' : 'text-ink-faint'"
      >
        {{ w }}
      </div>
    </div>

    <div v-for="(week, wi) in weeks" :key="wi" class="grid grid-cols-7" :class="wi > 0 ? 'border-t border-line' : ''">
      <div
        v-for="(d, di) in week"
        :key="d"
        :data-day="d"
        class="relative flex min-h-[96px] cursor-pointer flex-col gap-1 p-1.5 transition-colors"
        :class="[
          di > 0 ? 'border-l border-line' : '',
          inMonth(d) ? '' : 'bg-ink/[0.015]',
          isWeekend(d) && inMonth(d) ? 'bg-ink/[0.03]' : '',
          dropDay === d ? 'bg-lavender-100/70 ring-1 ring-inset ring-lavender-400' : 'hover:bg-lavender-50/60',
        ]"
        :title="`Voir le ${dayNumber(d)} en vue jour`"
        @click="emit('pickDay', d)"
        @dragover="onDragOver(d, $event)"
        @dragleave="dropDay = null"
        @drop="onDrop(d, $event)"
      >
        <div class="flex items-baseline justify-between gap-1">
          <span
            class="text-[12px] font-medium tabular-nums"
            :class="[
              d === today
                ? 'flex h-[20px] w-[20px] items-center justify-center rounded-full bg-lavender-500 text-white'
                : inMonth(d)
                  ? 'text-ink'
                  : 'text-ink-faint/60',
            ]"
          >
            {{ dayNumber(d) }}
          </span>
          <span v-if="plannedOf(d)" class="text-[10.5px] tabular-nums text-ink-faint">
            {{ formatDuration(plannedOf(d)) }}
          </span>
        </div>

        <div class="flex min-w-0 flex-col gap-[3px]">
          <div
            v-for="b in dayBlocks(d).slice(0, MAX_VISIBLE)"
            :key="b.id"
            class="flex min-w-0 items-center gap-1"
            :class="inMonth(d) ? '' : 'opacity-60'"
          >
            <span class="h-1.5 w-1.5 shrink-0 rounded-full" :style="dotStyle(b)" />
            <span class="shrink-0 text-[10px] tabular-nums text-ink-faint">{{ hhmm(b.startMinute) }}</span>
            <span
              class="min-w-0 flex-1 truncate text-[11px] leading-tight"
              :class="blocks.itemOf(b)?.status === 'done' ? 'text-ink-faint line-through' : 'text-ink-soft'"
            >
              {{ blocks.labelOf(b) }}
            </span>
          </div>
          <span
            v-if="dayBlocks(d).length > MAX_VISIBLE"
            class="pl-2.5 text-[10.5px] font-medium text-ink-faint"
          >
            +{{ dayBlocks(d).length - MAX_VISIBLE }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
