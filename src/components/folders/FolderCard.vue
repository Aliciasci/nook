<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Folder } from '@/types'
import { useStore } from '@/store/useStore'
import { useUiState } from '@/composables/useUiState'
import { useFolderColor } from '@/composables/useFolderColor'
import { useHiddenFolders } from '@/composables/useHiddenFolders'
import { useItemLinkDrag } from '@/composables/useItemLinkDrag'
import IconMoreHorizontal from '@/icons/IconMoreHorizontal.vue'
import FolderPreview from '@/components/folders/FolderPreview.vue'

const props = withDefaults(
  defineProps<{
    folder: Folder
    /** Un rangement est en cours dans la grille. */
    dragging?: boolean
  }>(),
  { dragging: false },
)

const { folderStats, removeFolder } = useStore()
const { hide: hideFolder } = useHiddenFolders()
const itemDrag = useItemLinkDrag()
const { openEditFolder } = useUiState()
const router = useRouter()
const palette = useFolderColor(props.folder.color)

const menuOpen = ref(false)
const root = ref<HTMLElement>()

/* ------------------------------------ Recevoir une tâche ou une note --- */

/** La carte est survolée par un élément qu'elle peut ranger. */
const dropTarget = ref(false)

function onItemDragOver(e: DragEvent) {
  if (!itemDrag.acceptsFolder(props.folder.id)) return
  // Sans ça, le navigateur refuse le dépôt : c'est le `preventDefault` du
  // survol qui déclare la cible, pas celui du dépôt.
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  // L'aperçu s'ouvrirait sous le pointeur, juste là où on vise.
  closePreview()
  dropTarget.value = true
}

function onItemDrop() {
  dropTarget.value = false
  itemDrag.dropOnFolder(props.folder.id, props.folder.name)
}

// Hover preview. The delay keeps the panel from flashing while the pointer
// merely crosses the grid on its way somewhere else.
const PREVIEW_DELAY = 350
const previewOpen = ref(false)
let previewTimer: number | undefined

function openPreview() {
  // Pendant un glisser, l'aperçu passerait sous le pointeur et masquerait la
  // grille au moment précis où on vise une place.
  if (menuOpen.value || props.dragging) return // the context menu occupies the same space
  window.clearTimeout(previewTimer)
  previewTimer = window.setTimeout(() => (previewOpen.value = true), PREVIEW_DELAY)
}

function closePreview() {
  window.clearTimeout(previewTimer)
  previewOpen.value = false
}

// Le minuteur de survol peut avoir été armé juste avant le début du glisser.
watch(
  () => props.dragging,
  (dragging) => {
    if (dragging) closePreview()
  },
)

function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) menuOpen.value = false
}
onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick)
  window.clearTimeout(previewTimer)
})

function open() {
  router.push(`/folder/${props.folder.id}`)
}

function edit() {
  closePreview()
  menuOpen.value = false
  openEditFolder(props.folder.id)
}

/** Retire la carte de la grille — le dossier, lui, ne bouge pas. */
function hide() {
  closePreview()
  menuOpen.value = false
  hideFolder(props.folder.id)
}

function confirmDelete() {
  menuOpen.value = false
  removeFolder(props.folder.id)
}

const stats = () => folderStats(props.folder.id)
</script>

<template>
  <div
    ref="root"
    class="group relative h-[168px] cursor-pointer"
    @click="open"
    @mouseenter="openPreview"
    @mouseleave="closePreview"
    @focusin="openPreview"
    @focusout="closePreview"
    @dragover="onItemDragOver"
    @dragleave="dropTarget = false"
    @drop.prevent.stop="onItemDrop"
  >
    <div
      class="absolute -top-2 left-6 h-5 w-20 rounded-t-xl transition-transform duration-200 group-hover:-translate-y-0.5"
      :class="palette.bg"
    />

    <div
      class="relative flex h-full flex-col justify-between rounded-2xl p-5 shadow-folder transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-soft-lg"
      :class="[palette.bg, dropTarget ? 'ring-2 ring-lavender-400 shadow-soft-lg -translate-y-1' : 'ring-1 ring-black/[0.02]']"
    >
      <div class="flex items-start justify-between">
        <span class="text-[26px] leading-none">{{ folder.icon }}</span>

        <button
          type="button"
          class="rounded-lg p-1.5 opacity-0 transition-all hover:bg-black/[0.06] group-hover:opacity-100 cursor-pointer"
          :class="palette.ink"
          @click.stop="closePreview(); menuOpen = !menuOpen"
        >
          <IconMoreHorizontal class="h-4 w-4" />
        </button>

        <Transition name="pop">
          <div
            v-if="menuOpen"
            class="absolute right-3 top-11 z-20 w-40 rounded-2xl bg-white p-1.5 shadow-soft-lg ring-1 ring-ink/5"
            @click.stop
          >
            <button
              type="button"
              class="w-full rounded-xl px-3 py-2 text-left text-[13px] font-medium text-ink-soft hover:bg-lavender-50 cursor-pointer"
              @click="open"
            >
              Ouvrir
            </button>
            <button
              type="button"
              class="w-full rounded-xl px-3 py-2 text-left text-[13px] font-medium text-ink-soft hover:bg-lavender-50 cursor-pointer"
              @click="edit"
            >
              Modifier
            </button>
            <button
              type="button"
              class="w-full rounded-xl px-3 py-2 text-left text-[13px] font-medium text-ink-soft hover:bg-lavender-50 cursor-pointer"
              @click="hide"
            >
              Masquer
            </button>
            <button
              type="button"
              class="w-full rounded-xl px-3 py-2 text-left text-[13px] font-medium text-rose-500 hover:bg-rose-50 cursor-pointer"
              @click="confirmDelete"
            >
              Supprimer
            </button>
          </div>
        </Transition>
      </div>

      <div>
        <h3 class="font-display text-[16px] font-medium tracking-tight" :class="palette.ink">
          {{ folder.name }}
        </h3>
        <p class="mt-0.5 text-[12px] font-medium opacity-70" :class="palette.ink">
          <template v-if="stats().tasks && stats().notes">{{ stats().tasks }} tâches · {{ stats().notes }} notes</template>
          <template v-else-if="stats().tasks">{{ stats().tasks }} tâches</template>
          <template v-else-if="stats().notes">{{ stats().notes }} notes</template>
          <template v-else>Vide</template>
        </p>
      </div>
    </div>

    <!-- Sits outside the card body so the card's own hover lift doesn't drag
         it, and above the neighbouring cards in the grid. -->
    <Transition name="pop">
      <div
        v-if="previewOpen"
        class="absolute left-1/2 top-[calc(100%+0.5rem)] z-30 w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2"
        @click.stop="open"
      >
        <FolderPreview :folder-id="folder.id" />
      </div>
    </Transition>
  </div>
</template>
