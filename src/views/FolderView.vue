<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStore } from '@/store/useStore'
import CrossNookNotice from '@/components/nooks/CrossNookNotice.vue'
import { useUiState } from '@/composables/useUiState'
import { useFolderColor } from '@/composables/useFolderColor'
import TaskRow from '@/components/tasks/TaskRow.vue'
import NoteCard from '@/components/notes/NoteCard.vue'
import InlineQuickAdd from '@/components/common/InlineQuickAdd.vue'
import QuickAddButton from '@/components/common/QuickAddButton.vue'
import SelectModeToggle from '@/components/common/SelectModeToggle.vue'
import IconChevronLeft from '@/icons/IconChevronLeft.vue'

const route = useRoute()
const router = useRouter()
const { getFolder, folderTasks, folderNotes, folderStats, loaded } = useStore()
const { openEditFolder } = useUiState()

const folderId = computed(() => route.params.id as string)
const folder = computed(() => getFolder(folderId.value))
const palette = computed(() => (folder.value ? useFolderColor(folder.value.color) : null))

const todoTasks = computed(() => folderTasks(folderId.value, 'todo'))
const doingTasks = computed(() => folderTasks(folderId.value, 'in_progress'))
const doneTasks = computed(() => folderTasks(folderId.value, 'done'))
const notes = computed(() => folderNotes(folderId.value))
const stats = computed(() => folderStats(folderId.value))

const showDone = ref(false)
watch(folderId, () => (showDone.value = false))

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/')
}
</script>

<template>
  <div v-if="folder" class="page-sheet mx-auto max-w-3xl px-8 py-9">
    <button
      type="button"
      class="flex items-center gap-1.5 text-[13px] font-medium text-ink-faint transition-colors hover:text-lavender-600 cursor-pointer"
      @click="goBack"
    >
      <IconChevronLeft class="h-4 w-4" />
      Retour
    </button>

    <div class="mt-4 flex flex-wrap items-start justify-between gap-4">
      <div class="flex items-center gap-3.5">
        <button
          type="button"
          class="group relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-[26px] shadow-folder transition-transform hover:scale-[1.04] cursor-pointer"
          :class="palette?.bg"
          title="Modifier la couleur et l'icône"
          @click="openEditFolder(folder.id)"
        >
          {{ folder.icon }}
          <span
            class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-ink/0 text-[11px] font-semibold text-white opacity-0 transition-all group-hover:bg-ink/40 group-hover:opacity-100"
          >
            Modifier
          </span>
        </button>
        <div>
          <h1 class="font-display text-[24px] font-medium tracking-tight text-ink">{{ folder.name }}</h1>
          <p class="mt-0.5 text-[13.5px] text-ink-soft">
            <template v-if="stats.tasks && stats.notes">{{ stats.tasks }} tâches · {{ stats.notes }} notes</template>
            <template v-else-if="stats.tasks">{{ stats.tasks }} tâches</template>
            <template v-else-if="stats.notes">{{ stats.notes }} notes</template>
            <template v-else>Ce dossier est vide</template>
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <SelectModeToggle v-if="stats.tasks || stats.notes" scope="folder" />
        <QuickAddButton :folder-id="folder.id" />
      </div>
    </div>

    <section class="mt-9">
      <h2 class="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">À faire</h2>
      <div class="mt-2 flex flex-col gap-2">
        <div class="rounded-2xl bg-white p-3 shadow-soft ring-1 ring-ink/[0.08]">
          <InlineQuickAdd :folder-id="folder.id" placeholder="Ajouter une tâche…" />
          <p v-if="!todoTasks.length" class="px-2.5 pt-3 text-[13px] text-ink-faint">Aucune tâche à faire.</p>
          <TaskRow v-for="t in todoTasks" :key="t.id" :item="t" :show-folder="false" selection-scope="folder" class="mt-1" />
        </div>
      </div>
    </section>

    <section v-if="doingTasks.length" class="mt-6">
      <h2 class="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">En cours</h2>
      <div class="mt-2 rounded-2xl bg-white p-3 shadow-soft ring-1 ring-ink/[0.08]">
        <TaskRow v-for="t in doingTasks" :key="t.id" :item="t" :show-folder="false" selection-scope="folder" />
      </div>
    </section>

    <section v-if="doneTasks.length" class="mt-6">
      <button
        type="button"
        class="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint hover:text-ink cursor-pointer"
        @click="showDone = !showDone"
      >
        Terminées ({{ doneTasks.length }})
      </button>
      <div v-if="showDone" class="mt-2 rounded-2xl bg-white p-3 shadow-soft ring-1 ring-ink/[0.08]">
        <TaskRow v-for="t in doneTasks" :key="t.id" :item="t" :show-folder="false" selection-scope="folder" />
      </div>
    </section>

    <section class="mt-6">
      <h2 class="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Notes</h2>
      <div class="mt-2">
        <InlineQuickAdd :folder-id="folder.id" type="note" placeholder="Ajouter une note…" />
      </div>
      <!-- `items-start` : sans lui, une note courte s'étire à la hauteur de sa
           voisine et laisse un grand blanc sous son texte. -->
      <div v-if="notes.length" class="mt-3 grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
        <NoteCard v-for="n in notes" :key="n.id" :item="n" :show-folder="false" selection-scope="folder" />
      </div>
    </section>
  </div>

  <!-- Absent du nook ouvert : il vit peut-être dans un autre. -->
  <CrossNookNotice v-else kind="folder" :id="folderId" :ready="loaded" />
</template>
