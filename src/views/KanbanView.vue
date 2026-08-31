<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '@/store/useStore'
import { useUiState } from '@/composables/useUiState'
import PageHeader from '@/components/common/PageHeader.vue'
import KanbanColumn from '@/components/kanban/KanbanColumn.vue'
import type { Item, ItemStatus } from '@/types'

const { items, updateItem, toggleTaskDone } = useStore()
const { openItemDetail } = useUiState()

const tasks = computed(() => items.value.filter((it) => it.type === 'task' && !it.archivedAt))

/** Priorité haute d'abord, puis échéance la plus proche — sans échéance en
 *  dernier. Même lecture que « À faire » groupé par échéance, à plat. */
function sortTasks(list: Item[]): Item[] {
  return list.slice().sort((a, b) => {
    const pa = a.priority === 'high' ? 0 : 1
    const pb = b.priority === 'high' ? 0 : 1
    if (pa !== pb) return pa - pb
    if (a.dueDate !== b.dueDate) {
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate.localeCompare(b.dueDate)
    }
    return b.createdAt.localeCompare(a.createdAt)
  })
}

const COLUMNS: { status: ItemStatus; title: string }[] = [
  { status: 'todo', title: 'À faire' },
  { status: 'in_progress', title: 'En cours' },
  { status: 'done', title: 'Terminé' },
]

const columns = computed(() =>
  COLUMNS.map((col) => ({ ...col, items: sortTasks(tasks.value.filter((it) => it.status === col.status)) })),
)

const draggingId = ref<string | null>(null)

function onDragStart(id: string) {
  draggingId.value = id
}
function onDragEnd() {
  draggingId.value = null
}

/**
 * Le passage par / hors de « Terminé » passe par `toggleTaskDone` : lui seul
 * déclenche l'XP du jardin, et seulement en entrant dans « Terminé » — jamais
 * en la quittant, le jardin ne régresse pas. Un aller-retour Terminé → En
 * cours redevient donc `todo` d'abord, puis reprend sa colonne demandée.
 */
function onDropOn(status: ItemStatus) {
  const id = draggingId.value
  draggingId.value = null
  if (!id) return
  const item = tasks.value.find((it) => it.id === id)
  if (!item || item.status === status) return

  if (status === 'done') {
    toggleTaskDone(id)
    return
  }
  if (item.status === 'done') {
    toggleTaskDone(id) // -> 'todo'
    if (status === 'in_progress') updateItem(id, { status: 'in_progress' })
    return
  }
  updateItem(id, { status })
}
</script>

<template>
  <div class="page-sheet mx-auto max-w-[1400px] px-8 py-9">
    <PageHeader title="Kanban" :subtitle="`${tasks.length} tâche${tasks.length > 1 ? 's' : ''} au total.`" />

    <div v-if="tasks.length === 0" class="mt-8 rounded-2xl bg-white p-10 text-center shadow-soft ring-1 ring-ink/[0.08]">
      <p class="text-[13.5px] text-ink-faint">Aucune tâche pour le moment.</p>
    </div>

    <div v-else class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
      <KanbanColumn
        v-for="col in columns"
        :key="col.status"
        :title="col.title"
        :status="col.status"
        :items="col.items"
        :dragging-id="draggingId"
        @open="openItemDetail"
        @drag-start="onDragStart"
        @drag-end="onDragEnd"
        @drop="onDropOn(col.status)"
      />
    </div>
  </div>
</template>
