<script setup lang="ts">
/** Le vivier : les tâches ouvertes, à glisser sur la grille. */
import { computed } from 'vue'
import type { Item } from '@/types'
import { useStore } from '@/store/useStore'
import { useTimeBlocks } from '@/store/useTimeBlocks'
import { useFolderColor } from '@/composables/useFolderColor'
import IconPuzzle from '@/icons/IconPuzzle.vue'

const props = defineProps<{ day: string }>()

const store = useStore()
const blocks = useTimeBlocks()

/** Les tâches déjà posées sur ce jour — pour ne pas les proposer deux fois. */
const scheduledIds = computed(() => {
  const ids = new Set<string>()
  for (const b of blocks.blocksForDay(props.day)) if (b.itemId) ids.add(b.itemId)
  return ids
})

/**
 * Les tâches ouvertes, celles du jour d'abord — c'est ce qu'on cherche à
 * caser quand on planifie sa journée — puis les prioritaires, puis le reste.
 */
const tasks = computed(() => {
  const open = store.allOpenTasks.value.filter((t) => !scheduledIds.value.has(t.id))
  const rank = (t: Item) => {
    if (t.dueDate === props.day) return 0
    if (t.dueDate && t.dueDate < props.day) return 1 // en retard
    if (t.priority === 'high') return 2
    return 3
  }
  return open.slice().sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title))
})

/* ------------------------------------------------------------ L'anneau --- */

/**
 * L'anneau ne mesure pas la liste en dessous : elle contient toutes les
 * tâches ouvertes du nook, dont la plupart ne sont pas pour aujourd'hui, et
 * un anneau à 4 % tous les matins ne dirait rien.
 *
 * Il mesure **ce que la journée doit porter** : les tâches dues ce jour-là ou
 * en retard. Celles-là, on les a casées ou pas, et c'est une vraie question.
 */
const due = computed(() =>
  store.allOpenTasks.value.filter((t) => t.dueDate && t.dueDate <= props.day),
)
const placed = computed(() => due.value.filter((t) => scheduledIds.value.has(t.id)).length)
const ratio = computed(() => (due.value.length ? placed.value / due.value.length : 1))
const percent = computed(() => Math.round(ratio.value * 100))

const ringLabel = computed(() => {
  if (!due.value.length) return 'Rien d’urgent à caser 🌿'
  if (placed.value === due.value.length) return 'Tout est casé ! 🌿'
  return `${placed.value} sur ${due.value.length} casée${due.value.length > 1 ? 's' : ''}`
})

const RADIUS = 32
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/* ----------------------------------------------------------- La liste --- */

function badge(task: Item): { label: string; class: string } | null {
  if (task.dueDate && task.dueDate < props.day) return { label: 'en retard', class: 'text-rose-600 bg-rose-50' }
  if (task.dueDate === props.day) return { label: "aujourd'hui", class: 'text-lavender-700 bg-lavender-100' }
  if (task.priority === 'high') return { label: 'haute', class: 'text-amber-700 bg-amber-50' }
  return null
}

function folderDot(task: Item): string | null {
  const folder = store.getFolder(task.folderId)
  return folder ? useFolderColor(folder.color).solid : null
}

function onDragStart(task: Item, e: DragEvent) {
  if (!e.dataTransfer) return
  // Un type propre à Nook, plus `text/plain` en repli : Firefox n'amorce pas
  // un glisser sans données, et certains navigateurs ne rendent les types
  // personnalisés qu'au dépôt.
  e.dataTransfer.setData('application/x-nook-item', task.id)
  e.dataTransfer.setData('text/plain', task.id)
  e.dataTransfer.effectAllowed = 'copy'
}
</script>

<template>
  <div class="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/[0.08]">
    <div class="flex items-start justify-between gap-2">
      <h2 class="font-display text-[14px] font-medium text-ink">À caser</h2>
      <IconPuzzle class="h-[17px] w-[17px] shrink-0 text-ink-faint/70" />
    </div>

    <div class="mt-3 flex flex-col items-center">
      <div class="relative">
        <svg viewBox="0 0 80 80" class="h-[100px] w-[100px] -rotate-90" aria-hidden="true">
          <circle cx="40" cy="40" :r="RADIUS" fill="none" stroke-width="6" class="stroke-ink/[0.08]" />
          <!-- À zéro, un bout arrondi de longueur nulle dessine quand même un
               point en haut de l'anneau : mieux vaut ne rien tracer. -->
          <circle
            v-if="ratio > 0"
            cx="40"
            cy="40"
            :r="RADIUS"
            fill="none"
            stroke-width="6"
            stroke-linecap="round"
            class="stroke-lavender-500 transition-[stroke-dasharray] duration-500"
            :stroke-dasharray="`${ratio * CIRCUMFERENCE} ${CIRCUMFERENCE}`"
          />
        </svg>
        <span
          class="absolute inset-0 flex items-center justify-center font-display text-[19px] font-medium tabular-nums text-ink"
        >
          {{ percent }}%
        </span>
      </div>
      <p class="mt-2 text-center text-[12.5px] text-ink-faint">{{ ringLabel }}</p>
    </div>

    <p v-if="tasks.length" class="mt-4 text-[11.5px] leading-snug text-ink-faint">
      Glisse une tâche sur la grille pour lui donner une heure.
    </p>

    <ul v-if="tasks.length" class="mt-2 flex max-h-[44vh] flex-col gap-1 overflow-y-auto">
      <li
        v-for="task in tasks"
        :key="task.id"
        draggable="true"
        class="flex cursor-grab items-center gap-2 rounded-xl px-2.5 py-2 ring-1 ring-ink/[0.06] transition-colors hover:bg-paper active:cursor-grabbing"
        @dragstart="onDragStart(task, $event)"
      >
        <span v-if="folderDot(task)" class="h-1.5 w-1.5 shrink-0 rounded-full" :class="folderDot(task)!" />
        <span class="min-w-0 flex-1 truncate text-[12.5px] text-ink">{{ task.title }}</span>
        <span
          v-if="badge(task)"
          class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
          :class="badge(task)!.class"
        >
          {{ badge(task)!.label }}
        </span>
      </li>
    </ul>
  </div>
</template>
