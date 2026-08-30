<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '@/store/useStore'
import type { Item } from '@/types'

const props = defineProps<{ folderId: string }>()

const MAX_SHOWN = 5

const { folderTasks, folderNotes } = useStore()

// Unfinished work first — that's what a peek at a folder is for. Within that,
// the soonest due date leads, then the most recently touched.
const pending = computed<Item[]>(() =>
  folderTasks(props.folderId)
    .filter((it) => it.status !== 'done')
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      return b.updatedAt.localeCompare(a.updatedAt)
    }),
)

const shown = computed(() => pending.value.slice(0, MAX_SHOWN))
const overflow = computed(() => pending.value.length - shown.value.length)
const doneCount = computed(() => folderTasks(props.folderId, 'done').length)
const noteCount = computed(() => folderNotes(props.folderId).length)

function dueLabel(iso: string): string {
  const due = new Date(iso)
  const today = new Date()
  due.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'demain'
  if (days === -1) return 'hier'
  if (days < 0) return `retard ${-days}j`
  return due.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function isLate(iso: string): boolean {
  const due = new Date(iso)
  const today = new Date()
  due.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return due.getTime() < today.getTime()
}
</script>

<template>
  <div class="rounded-2xl bg-white p-3 shadow-soft-lg ring-1 ring-ink/[0.08]">
    <ul v-if="shown.length" class="flex flex-col gap-0.5">
      <li
        v-for="task in shown"
        :key="task.id"
        class="flex items-baseline gap-2 rounded-lg px-2 py-1.5"
      >
        <span
          class="mt-[1px] h-1.5 w-1.5 shrink-0 rounded-full"
          :class="task.status === 'in_progress' ? 'bg-lavender-400' : 'bg-ink/20'"
        />
        <span class="min-w-0 flex-1 truncate text-[12.5px] text-ink">{{ task.title }}</span>
        <span
          v-if="task.dueDate"
          class="shrink-0 text-[11px] font-medium"
          :class="isLate(task.dueDate) ? 'text-rose-500' : 'text-ink-faint'"
        >
          {{ dueLabel(task.dueDate) }}
        </span>
      </li>
    </ul>

    <p v-else class="px-2 py-1.5 text-[12.5px] text-ink-faint">
      Aucune tâche en cours
    </p>

    <p
      v-if="overflow > 0 || doneCount || noteCount"
      class="mt-1.5 border-t border-line px-2 pt-1.5 text-[11px] text-ink-faint"
    >
      <span v-if="overflow > 0">+{{ overflow }} autre{{ overflow > 1 ? 's' : '' }}</span>
      <span v-if="overflow > 0 && (doneCount || noteCount)"> · </span>
      <span v-if="doneCount">{{ doneCount }} terminée{{ doneCount > 1 ? 's' : '' }}</span>
      <span v-if="doneCount && noteCount"> · </span>
      <span v-if="noteCount">{{ noteCount }} note{{ noteCount > 1 ? 's' : '' }}</span>
    </p>
  </div>
</template>
