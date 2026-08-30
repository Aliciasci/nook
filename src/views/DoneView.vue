<script setup lang="ts">
import { useStore } from '@/store/useStore'
import PageHeader from '@/components/common/PageHeader.vue'
import TaskRow from '@/components/tasks/TaskRow.vue'
import SelectModeToggle from '@/components/common/SelectModeToggle.vue'

const { doneTasks } = useStore()
</script>

<template>
  <div class="page-sheet mx-auto max-w-2xl px-8 py-9">
    <PageHeader
      title="Terminées"
      :subtitle="`${doneTasks.length} tâche${doneTasks.length > 1 ? 's' : ''} terminée${doneTasks.length > 1 ? 's' : ''}.`"
    >
      <SelectModeToggle v-if="doneTasks.length" scope="done" />
    </PageHeader>

    <div v-if="doneTasks.length === 0" class="mt-8 rounded-2xl bg-white p-10 text-center shadow-soft ring-1 ring-ink/[0.08]">
      <p class="text-[13.5px] text-ink-faint">Rien de terminé pour le moment.</p>
    </div>

    <div v-else class="mt-6 rounded-2xl bg-white p-3 shadow-soft ring-1 ring-ink/[0.08]">
      <TaskRow v-for="t in doneTasks" :key="t.id" :item="t" selection-scope="done" />
    </div>
  </div>
</template>
