<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '@/store/useStore'
import PageHeader from '@/components/common/PageHeader.vue'
import TaskRow from '@/components/tasks/TaskRow.vue'
import NoteCard from '@/components/notes/NoteCard.vue'

const { archivedItems } = useStore()

const archivedTasks = computed(() => archivedItems.value.filter((it) => it.type === 'task'))
const archivedNotes = computed(() => archivedItems.value.filter((it) => it.type === 'note'))
</script>

<template>
  <div class="page-sheet mx-auto max-w-2xl px-8 py-9">
    <PageHeader
      title="Archive"
      :subtitle="`${archivedItems.length} élément${archivedItems.length > 1 ? 's' : ''} archivé${archivedItems.length > 1 ? 's' : ''}.`"
    />

    <div v-if="archivedItems.length === 0" class="mt-8 rounded-2xl bg-white p-10 text-center shadow-soft ring-1 ring-ink/[0.08]">
      <p class="text-[13.5px] text-ink-faint">
        Rien d'archivé pour le moment — le menu ⋯ d'une tâche ou d'une note propose « Archiver ».
      </p>
    </div>

    <template v-else>
      <section v-if="archivedTasks.length" class="mt-6">
        <h2 class="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Tâches</h2>
        <div class="mt-2 rounded-2xl bg-white p-3 shadow-soft ring-1 ring-ink/[0.08]">
          <TaskRow v-for="t in archivedTasks" :key="t.id" :item="t" date-mode="created" selection-scope="archive" />
        </div>
      </section>

      <section v-if="archivedNotes.length" class="mt-6">
        <h2 class="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Notes</h2>
        <div class="mt-3 grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
          <NoteCard v-for="n in archivedNotes" :key="n.id" :item="n" selection-scope="archive" />
        </div>
      </section>
    </template>
  </div>
</template>
