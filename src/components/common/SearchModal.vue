<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Modal from '@/components/common/Modal.vue'
import { useStore } from '@/store/useStore'
import { useDocs } from '@/store/useDocs'
import { useUiState } from '@/composables/useUiState'
import { useFolderColor } from '@/composables/useFolderColor'
import IconSearch from '@/icons/IconSearch.vue'
import IconListCheck from '@/icons/IconListCheck.vue'
import IconNote from '@/icons/IconNote.vue'
import IconBook from '@/icons/IconBook.vue'

const { search, getFolder } = useStore()
const docs = useDocs()
const { state, closeSearch } = useUiState()
const router = useRouter()

const query = ref('')
const inputEl = ref<HTMLInputElement>()

const results = computed(() => search(query.value))
const docResults = computed(() => docs.searchPages(query.value))
const hasResults = computed(
  () =>
    results.value.tasks.length + results.value.notes.length + results.value.folders.length + docResults.value.length >
    0,
)

watch(
  () => state.searchOpen,
  (open) => {
    if (open) {
      query.value = ''
      // La documentation n'est chargée qu'à la demande : sans ça, une page
      // jamais ouverte resterait introuvable depuis la recherche.
      void docs.ensureLoaded()
      nextTick(() => inputEl.value?.focus())
    }
  },
)

function goFolder(id: string) {
  closeSearch()
  router.push(`/folder/${id}`)
}

function goItem(folderId: string | null) {
  closeSearch()
  router.push(folderId ? `/folder/${folderId}` : '/inbox')
}

function goDoc(id: string) {
  closeSearch()
  router.push(`/docs/${id}`)
}
</script>

<template>
  <Modal :open="state.searchOpen" align="top" @close="closeSearch">
    <div class="overflow-hidden rounded-2xl bg-white shadow-soft-lg ring-1 ring-ink/5">
      <div class="flex items-center gap-2.5 border-b border-line px-4 py-3.5">
        <IconSearch class="h-4 w-4 shrink-0 text-ink-faint" />
        <input
          ref="inputEl"
          v-model="query"
          type="text"
          placeholder="Rechercher une tâche, une note, un dossier, une page…"
          class="w-full bg-transparent text-[14px] text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <kbd class="rounded-md border border-line px-1.5 py-0.5 text-[10.5px] font-medium text-ink-faint">Esc</kbd>
      </div>

      <div v-if="query && !hasResults" class="px-4 py-8 text-center text-[13px] text-ink-faint">
        Aucun résultat pour « {{ query }} »
      </div>

      <div v-else-if="query" class="max-h-[50vh] overflow-y-auto p-2">
        <div v-if="results.folders.length" class="mb-1">
          <p class="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Dossiers</p>
          <button
            v-for="f in results.folders"
            :key="f.id"
            type="button"
            class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px] text-ink hover:bg-lavender-50 cursor-pointer"
            @click="goFolder(f.id)"
          >
            <span class="h-2.5 w-2.5 rounded-full" :class="useFolderColor(f.color).bg" />
            {{ f.name }}
          </button>
        </div>

        <div v-if="results.tasks.length" class="mb-1">
          <p class="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Tâches</p>
          <button
            v-for="t in results.tasks"
            :key="t.id"
            type="button"
            class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px] text-ink hover:bg-lavender-50 cursor-pointer"
            @click="goItem(t.folderId)"
          >
            <IconListCheck class="h-4 w-4 shrink-0 text-lavender-500" />
            <span class="flex-1 truncate">{{ t.title }}</span>
            <span v-if="getFolder(t.folderId)" class="text-[11.5px] text-ink-faint">{{ getFolder(t.folderId)?.name }}</span>
          </button>
        </div>

        <div v-if="docResults.length" class="mb-1">
          <p class="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Documentation</p>
          <button
            v-for="hit in docResults"
            :key="hit.page.id"
            type="button"
            class="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-lavender-50 cursor-pointer"
            @click="goDoc(hit.page.id)"
          >
            <IconBook class="mt-0.5 h-4 w-4 shrink-0 text-lavender-500" />
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-1.5 text-[13.5px] text-ink">
                <span v-if="hit.page.icon">{{ hit.page.icon }}</span>
                <span class="truncate">{{ hit.page.title }}</span>
              </span>
              <span v-if="hit.excerpt" class="mt-0.5 block truncate text-[11.5px] text-ink-faint">
                {{ hit.excerpt }}
              </span>
            </span>
          </button>
        </div>

        <div v-if="results.notes.length">
          <p class="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Notes</p>
          <button
            v-for="note in results.notes"
            :key="note.id"
            type="button"
            class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px] text-ink hover:bg-lavender-50 cursor-pointer"
            @click="goItem(note.folderId)"
          >
            <IconNote class="h-4 w-4 shrink-0 text-lavender-500" />
            <span class="flex-1 truncate">{{ note.title }}</span>
            <span v-if="getFolder(note.folderId)" class="text-[11.5px] text-ink-faint">{{ getFolder(note.folderId)?.name }}</span>
          </button>
        </div>
      </div>

      <div v-else class="px-4 py-8 text-center text-[13px] text-ink-faint">
        Tape pour rechercher dans tes tâches, tes notes, tes dossiers et ta documentation.
      </div>
    </div>
  </Modal>
</template>
