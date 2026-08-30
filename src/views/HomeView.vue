<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useStore } from '@/store/useStore'
import { useUiState } from '@/composables/useUiState'
import FolderCard from '@/components/folders/FolderCard.vue'
import InboxList from '@/components/inbox/InboxList.vue'
import TodayPanel from '@/components/today/TodayPanel.vue'
import QuickNotesWidget from '@/components/today/QuickNotesWidget.vue'
import TodoListWidget from '@/components/today/TodoListWidget.vue'
import QuickAddButton from '@/components/common/QuickAddButton.vue'
import SelectModeToggle from '@/components/common/SelectModeToggle.vue'
import IconSearch from '@/icons/IconSearch.vue'
import IconArrowRight from '@/icons/IconArrowRight.vue'

const { folders, todayTasks, inboxItems, moveFolder } = useStore()

/* ------------------------------------------- Rangement des dossiers --- */

// Glisser-déposer natif, comme les blocs de la documentation. La grille est
// horizontale : c'est donc l'abscisse du pointeur, et non son ordonnée, qui
// dit de quel côté de la carte survolée l'insertion se ferait.
const dragIndex = ref<number | null>(null)
const dropIndex = ref<number | null>(null)

function onFolderDragStart(index: number, e: DragEvent) {
  dragIndex.value = index
  // Firefox n'amorce pas un glisser sans données attachées.
  e.dataTransfer?.setData('text/plain', folders.value[index]?.id ?? '')
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onFolderDragOver(index: number, e: DragEvent) {
  if (dragIndex.value === null) return
  e.preventDefault()
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  dropIndex.value = e.clientX < rect.left + rect.width / 2 ? index : index + 1
}

function onFolderDrop() {
  const from = dragIndex.value
  let to = dropIndex.value
  dragIndex.value = null
  dropIndex.value = null
  if (from === null || to === null) return
  // `to` compte les places avant retrait de la carte glissée.
  if (to > from) to -= 1
  const folder = folders.value[from]
  if (folder) moveFolder(folder.id, to)
}

function onFolderDragEnd() {
  dragIndex.value = null
  dropIndex.value = null
}
const { openSearch } = useUiState()

const inboxPreviewLimit = 5
const hasMoreInbox = computed(() => inboxItems.value.length > inboxPreviewLimit)
</script>

<template>
  <div class="page-sheet mx-auto max-w-[1800px] px-8 py-9">
    <div class="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_320px]">
      <div class="min-w-0">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="font-display text-[26px] font-medium tracking-tight text-ink">Bonjour Alicia 👋</h1>
            <p class="mt-1.5 text-[14.5px] text-ink-soft">
              Tu as {{ todayTasks.count }} choses à faire aujourd'hui.
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2.5 text-[13px] text-ink-faint shadow-soft transition-colors hover:border-lavender-300 hover:text-ink cursor-pointer"
              @click="openSearch"
            >
              <IconSearch class="h-4 w-4" />
              Rechercher
              <kbd class="ml-1 rounded-md bg-paper px-1.5 py-0.5 text-[10.5px] font-medium">⌘K</kbd>
            </button>
            <QuickAddButton />
          </div>
        </div>

        <section class="mt-9">
          <h2 class="px-1 font-display text-[15px] font-medium text-ink">Mes dossiers</h2>
          <div
            class="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4"
            @dragend="onFolderDragEnd"
            @drop="onFolderDrop"
          >
            <div
              v-for="(folder, index) in folders"
              :key="folder.id"
              class="relative"
              :class="dragIndex === index ? 'opacity-40' : ''"
              draggable="true"
              @dragstart="onFolderDragStart(index, $event)"
              @dragover="onFolderDragOver(index, $event)"
              @dragend="onFolderDragEnd"
            >
              <!-- Trait d'insertion, dans la gouttière entre deux cartes. -->
              <div
                v-if="dragIndex !== null && dropIndex === index"
                class="pointer-events-none absolute -left-2.5 top-1 bottom-1 z-10 w-1 rounded-full bg-lavender-400"
              />
              <FolderCard :folder="folder" :dragging="dragIndex !== null" />
              <div
                v-if="dragIndex !== null && dropIndex === index + 1"
                class="pointer-events-none absolute -right-2.5 top-1 bottom-1 z-10 w-1 rounded-full bg-lavender-400"
              />
            </div>
          </div>
        </section>

        <section class="mt-9">
          <div class="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/[0.08]">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <h2 class="font-display text-[15px] font-medium text-ink">Inbox</h2>
                <span v-if="inboxItems.length" class="rounded-full bg-lavender-100 px-2 py-0.5 text-[11px] font-semibold text-lavender-700">
                  {{ inboxItems.length }}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <SelectModeToggle v-if="inboxItems.length" scope="home-inbox" />
                <RouterLink
                  v-if="hasMoreInbox"
                  to="/inbox"
                  class="flex items-center gap-1 text-[12px] font-medium text-ink-faint hover:text-lavender-600"
                >
                  Voir tout
                  <IconArrowRight class="h-3 w-3" />
                </RouterLink>
              </div>
            </div>

            <div class="mt-3">
              <InboxList :limit="inboxPreviewLimit" selection-scope="home-inbox" />
            </div>
          </div>
        </section>
      </div>

      <aside class="flex flex-col gap-5 xl:sticky xl:top-9 xl:self-start">
        <TodayPanel />
        <QuickNotesWidget />
        <TodoListWidget />
      </aside>
    </div>
  </div>
</template>
