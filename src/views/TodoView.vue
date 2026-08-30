<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '@/store/useStore'
import PageHeader from '@/components/common/PageHeader.vue'
import TaskRow from '@/components/tasks/TaskRow.vue'
import QuickAddButton from '@/components/common/QuickAddButton.vue'
import SelectModeToggle from '@/components/common/SelectModeToggle.vue'
import type { Item, Priority } from '@/types'

const { allOpenTasks, folders } = useStore()

type GroupBy = 'due' | 'priority' | 'folder'
const groupBy = ref<GroupBy>('due')

const groupOptions: { key: GroupBy; label: string }[] = [
  { key: 'due', label: 'Échéance' },
  { key: 'priority', label: 'Priorité' },
  { key: 'folder', label: 'Dossier' },
]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const groups = computed<{ label: string; items: Item[] }[]>(() => {
  const tasks = allOpenTasks.value

  if (groupBy.value === 'priority') {
    const order: { key: Priority; label: string }[] = [
      { key: 'high', label: 'Haute' },
      { key: 'medium', label: 'Normale' },
      { key: 'low', label: 'Basse' },
    ]
    const result = order
      .map((o) => ({ label: o.label, items: tasks.filter((t) => t.priority === o.key) }))
      .filter((g) => g.items.length)
    const none = tasks.filter((t) => !t.priority)
    if (none.length) result.push({ label: 'Sans priorité', items: none })
    return result
  }

  if (groupBy.value === 'folder') {
    const result = folders.value
      .map((f) => ({ label: f.name, items: tasks.filter((t) => t.folderId === f.id) }))
      .filter((g) => g.items.length)
    const none = tasks.filter((t) => !t.folderId)
    if (none.length) result.push({ label: 'Sans dossier', items: none })
    return result
  }

  const today = todayISO()
  const result: { label: string; items: Item[] }[] = []
  const late = tasks.filter((t) => t.dueDate && t.dueDate < today)
  const dueToday = tasks.filter((t) => t.dueDate === today)
  const upcoming = tasks
    .filter((t) => t.dueDate && t.dueDate > today)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
  const none = tasks.filter((t) => !t.dueDate)
  if (late.length) result.push({ label: 'En retard', items: late })
  if (dueToday.length) result.push({ label: "Aujourd'hui", items: dueToday })
  if (upcoming.length) result.push({ label: 'À venir', items: upcoming })
  if (none.length) result.push({ label: 'Sans échéance', items: none })
  return result
})
</script>

<template>
  <div class="page-sheet mx-auto max-w-2xl px-8 py-9">
    <PageHeader title="À faire" :subtitle="`${allOpenTasks.length} tâche${allOpenTasks.length > 1 ? 's' : ''} en cours.`">
      <SelectModeToggle scope="todo" />
      <QuickAddButton />
    </PageHeader>

    <div class="mt-5 inline-flex items-center gap-1 rounded-xl bg-lavender-50 p-1">
      <span class="px-2 text-[11.5px] font-medium text-ink-faint">Trier par</span>
      <button
        v-for="opt in groupOptions"
        :key="opt.key"
        type="button"
        class="rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors cursor-pointer"
        :class="groupBy === opt.key ? 'bg-white text-ink shadow-soft' : 'text-ink-faint hover:text-ink'"
        @click="groupBy = opt.key"
      >
        {{ opt.label }}
      </button>
    </div>

    <div v-if="allOpenTasks.length === 0" class="mt-8 rounded-2xl bg-white p-10 text-center shadow-soft ring-1 ring-ink/[0.08]">
      <p class="text-[13.5px] text-ink-faint">Aucune tâche en cours. Tout est à jour ✨</p>
    </div>

    <section v-for="group in groups" :key="group.label" class="mt-6">
      <h2 class="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{{ group.label }}</h2>
      <div class="mt-2 rounded-2xl bg-white p-3 shadow-soft ring-1 ring-ink/[0.08]">
        <TaskRow
          v-for="t in group.items"
          :key="t.id"
          :item="t"
          :show-folder="groupBy !== 'folder'"
          selection-scope="todo"
        />
      </div>
    </section>
  </div>
</template>
