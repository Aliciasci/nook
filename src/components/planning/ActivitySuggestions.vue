<script setup lang="ts">
/**
 * La rangée d'activités, au-dessus de la grille.
 *
 * Deux gestes pour la même chose, parce qu'on ne planifie pas toujours à la
 * minute près : **cliquer** pose l'activité au prochain trou de la journée —
 * c'est le geste de « je fais du sport ce soir, trouve-moi une place » — et
 * **glisser** la pose à l'heure exacte, comme une tâche depuis « À caser ».
 *
 * Le dernier bouton n'est pas une septième catégorie : c'est le bloc libre,
 * celui qui n'entre dans aucune case. Il garde sa place au bout de la rangée
 * plutôt que dans un menu, parce que « réunion dentiste » est au moins aussi
 * fréquent que « sport ».
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { TimeBlockKind } from '@/types'
import { useTimeBlocks, todayIso, parseDayIso } from '@/store/useTimeBlocks'
import { useWorkSchedule } from '@/composables/useWorkSchedule'
import { activityColorOf } from '@/composables/useActivityColors'
import { resolvePalette } from '@/utils/activityPalette'
import { useToast } from '@/composables/useToast'
import { ACTIVITY_KINDS } from '@/utils/activityKinds'
import { activityIcon } from '@/components/planning/activityIcons'
import { toMinutes, nowMinutes } from '@/utils/time'
import IconMoreHorizontal from '@/icons/IconMoreHorizontal.vue'

const props = defineProps<{
  /** Le jour que le clic vise — celui de la vue jour, l'ancre des autres. */
  day: string
}>()

const blocks = useTimeBlocks()
const { schedule } = useWorkSchedule()
const toast = useToast()

/** Durée d'une activité posée d'un clic ou d'un dépôt. */
const DEFAULT_DURATION = 60
const SNAP = 15

function hhmm(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}

/**
 * Le prochain trou de la journée qui tienne la durée demandée.
 *
 * On part du début de la journée de travail — de l'heure courante si c'est
 * aujourd'hui, personne ne planifie dans le passé — et on saute par-dessus
 * chaque créneau qui mord sur le trou. Un trou entre deux créneaux est donc
 * repris : caler « Pause » à 18h parce que la journée finit là, alors que
 * 12h à 14h est vide, ne rendrait service à personne.
 */
function nextFreeStart(duration: number): number {
  let start = toMinutes(schedule.startTime)
  if (props.day === todayIso()) {
    start = Math.max(start, Math.ceil(nowMinutes(new Date()) / SNAP) * SNAP)
  }
  for (const b of blocks.blocksForDay(props.day)) {
    if (b.endMinute <= start) continue
    if (b.startMinute >= start + duration) break
    start = Math.ceil(b.endMinute / SNAP) * SNAP
  }
  return Math.min(start, 1440 - duration)
}

const dayLabel = computed(() =>
  parseDayIso(props.day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
)

function hintFor(label: string): string {
  return `Poser « ${label} » sur ${dayLabel.value} à ${hhmm(nextFreeStart(DEFAULT_DURATION))} — ou glisser sur la grille`
}

function place(title: string, kind: TimeBlockKind | null) {
  const start = nextFreeStart(DEFAULT_DURATION)
  const block = blocks.addBlock({
    day: props.day,
    startMinute: start,
    endMinute: start + DEFAULT_DURATION,
    title,
    kind,
  })
  if (block) toast.push(`« ${title} » posé à ${hhmm(start)}.`)
}

/** La chip porte la teinte du moment de sa catégorie, réglages compris. */
function chipVars(kind: TimeBlockKind): Record<string, string> {
  const p = resolvePalette(activityColorOf(kind))
  return { '--chip-ink': p.ink, '--chip-ring': p.ring }
}

function onDragStart(kind: TimeBlockKind, e: DragEvent) {
  if (!e.dataTransfer) return
  // Un type propre à Nook, comme pour les tâches. `text/plain` n'est pas
  // repris ici : il porte déjà un identifiant de tâche ailleurs, et une
  // grille qui confondrait les deux poserait la mauvaise chose.
  e.dataTransfer.setData('application/x-nook-activity', kind)
  e.dataTransfer.effectAllowed = 'copy'
}

/* -------------------------------------------------------- Bloc libre --- */

const freeOpen = ref(false)
const freeTitle = ref('')
const freeInput = ref<HTMLInputElement>()
const freeRoot = ref<HTMLElement>()

function openFree() {
  freeOpen.value = true
  freeTitle.value = ''
  void nextTick(() => freeInput.value?.focus())
}

function confirmFree() {
  const title = freeTitle.value.trim()
  freeOpen.value = false
  if (title) place(title, null)
}

function onDocDown(e: MouseEvent) {
  if (freeRoot.value && !freeRoot.value.contains(e.target as Node)) freeOpen.value = false
}
onMounted(() => document.addEventListener('mousedown', onDocDown))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocDown))
</script>

<template>
  <div>
    <h2 class="px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Suggestions d'activités</h2>

    <div class="mt-2 flex flex-wrap items-center gap-2">
      <button
        v-for="k in ACTIVITY_KINDS"
        :key="k.id"
        type="button"
        draggable="true"
        :title="hintFor(k.label)"
        class="flex cursor-grab items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-[var(--chip-ink)] shadow-soft ring-1 ring-[var(--chip-ring)] transition-all hover:-translate-y-px hover:shadow-soft-lg active:cursor-grabbing"
        :style="chipVars(k.id)"
        @dragstart="onDragStart(k.id, $event)"
        @click="place(k.label, k.id)"
      >
        <component :is="activityIcon(k.id, false)" class="h-[17px] w-[17px]" />
        <span class="text-[12.5px] font-medium">{{ k.label }}</span>
      </button>

      <div ref="freeRoot" class="relative">
        <button
          type="button"
          title="Poser un bloc libre — réunion, trajet, rendez-vous"
          aria-label="Poser un bloc libre"
          class="flex items-center rounded-xl bg-white px-3 py-3 text-ink-faint shadow-soft ring-1 ring-ink/[0.08] transition-all hover:-translate-y-px hover:text-ink hover:shadow-soft-lg cursor-pointer"
          @click="openFree"
        >
          <IconMoreHorizontal class="h-[17px] w-[17px]" />
        </button>

        <Transition name="pop">
          <div
            v-if="freeOpen"
            class="absolute left-0 z-30 mt-2 w-64 rounded-2xl bg-white p-3 shadow-soft-lg ring-1 ring-ink/[0.08]"
          >
            <p class="px-0.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Bloc libre</p>
            <input
              ref="freeInput"
              v-model="freeTitle"
              type="text"
              maxlength="80"
              placeholder="Rendez-vous, trajet, courses…"
              class="w-full rounded-xl bg-paper px-3 py-2 text-[13px] text-ink outline-none ring-1 ring-ink/[0.08] transition-colors focus:bg-white focus:ring-2 focus:ring-lavender-300"
              @keydown.enter.prevent="confirmFree"
              @keydown.esc.prevent="freeOpen = false"
            />
            <p class="mt-2 px-0.5 text-[11.5px] leading-snug text-ink-faint">
              Il se posera à {{ hhmm(nextFreeStart(DEFAULT_DURATION)) }}, sans catégorie.
            </p>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>
