<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useVisionBoards } from '@/store/useVisionBoards'
import { useStore } from '@/store/useStore'
import { useToast } from '@/composables/useToast'
import { useFolderColor } from '@/composables/useFolderColor'
import {
  uploadVisionBoardImage,
  uploadVisionBoardImageFromUrl,
  uploadVisionBoardImageBlob,
  ACCEPTED_TYPES,
} from '@/services/visionBoardImages'
import { fetchPinterestImage, isPinterestUrl } from '@/services/pinExtract'
import PageHeader from '@/components/common/PageHeader.vue'
import VisionBoardTabs from '@/components/visionboard/VisionBoardTabs.vue'
import VisionBoardCanvas from '@/components/visionboard/VisionBoardCanvas.vue'
import IconImage from '@/icons/IconImage.vue'
import IconNote from '@/icons/IconNote.vue'
import IconLink from '@/icons/IconLink.vue'
import IconSection from '@/icons/IconSection.vue'
import IconVisionBoard from '@/icons/IconVisionBoard.vue'
import IconPlus from '@/icons/IconPlus.vue'
import type { FolderColor, Item, VisionBoardItemKind } from '@/types'

const board = useVisionBoards()
const { search } = useStore()
const toast = useToast()

const creatingFirstBoard = ref(false)

async function createFirstBoard() {
  creatingFirstBoard.value = true
  try {
    const created = await board.createBoard('Mon vision board')
    if (created) board.setCurrentBoard(created.id)
  } finally {
    creatingFirstBoard.value = false
  }
}

const items = computed(() => (board.currentBoardId.value ? board.itemsForBoard(board.currentBoardId.value) : []))
const loading = computed(() => (board.currentBoardId.value ? board.isBoardLoading(board.currentBoardId.value) : false))

watch(
  board.currentBoardId,
  (id) => {
    if (id) void board.ensureItemsLoaded(id)
  },
  { immediate: true },
)

function message(error: unknown): string {
  return error instanceof Error ? error.message : "L'opération a échoué."
}

/* ------------------------------------------------------------- Image --- */

const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const imagePickerOpen = ref(false)
const imageRoot = ref<HTMLElement | null>(null)
const imageUrlDraft = ref('')
const imageUrlInput = ref<HTMLInputElement>()

function openImagePicker() {
  if (!board.currentBoardId.value) return
  imagePickerOpen.value = true
  colorPickerOpen.value = false
  linkPickerOpen.value = false
  imageUrlDraft.value = ''
  void nextTick(() => imageUrlInput.value?.focus())
}

async function onFilePicked(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  const boardId = board.currentBoardId.value
  if (!file || !boardId) return

  imagePickerOpen.value = false
  uploading.value = true
  try {
    const uploaded = await uploadVisionBoardImage(file)
    board.addImageItem(boardId, uploaded)
  } catch (error) {
    toast.error(message(error))
  } finally {
    uploading.value = false
  }
}

/**
 * Depuis une URL — celle d'une image directe sur un site quelconque (fetch
 * direct, le navigateur s'en charge), ou une adresse Pinterest (page d'un pin
 * ou image sur son CDN) : ni l'une ni l'autre n'autorisent la requête depuis
 * un navigateur, donc c'est la fonction Edge `extract-pin-image` qui s'en
 * charge et renvoie l'image déjà récupérée.
 */
async function addImageFromUrl() {
  const raw = imageUrlDraft.value.trim()
  const boardId = board.currentBoardId.value
  if (!raw || !boardId) return

  imagePickerOpen.value = false
  uploading.value = true
  try {
    const uploaded = isPinterestUrl(raw)
      ? await uploadVisionBoardImageBlob(await fetchPinterestImage(raw))
      : await uploadVisionBoardImageFromUrl(raw)
    board.addImageItem(boardId, uploaded)
  } catch (error) {
    toast.error(message(error))
  } finally {
    uploading.value = false
  }
}

/* -------------------------------------------------------------- Note --- */

function addNote() {
  const boardId = board.currentBoardId.value
  if (boardId) board.addNoteItem(boardId)
}

/* ----------------------------------------------------------- Section --- */

function addSection() {
  const boardId = board.currentBoardId.value
  if (boardId) board.addSectionItem(boardId)
}

/* ------------------------------------------------------------ Filtres --- */

const KIND_FILTERS: { kind: VisionBoardItemKind; label: string }[] = [
  { kind: 'image', label: 'Images' },
  { kind: 'note', label: 'Notes' },
  { kind: 'color', label: 'Couleurs' },
  { kind: 'link', label: 'Cartes' },
  { kind: 'section', label: 'Sections' },
]

/** Vide = rien de masqué — c'est l'état de départ, tout est visible. */
const hiddenKinds = ref<Set<VisionBoardItemKind>>(new Set())

function toggleKindFilter(kind: VisionBoardItemKind) {
  if (hiddenKinds.value.has(kind)) hiddenKinds.value.delete(kind)
  else hiddenKinds.value.add(kind)
}

const filteredItems = computed(() => items.value.filter((it) => !hiddenKinds.value.has(it.kind)))

/* ------------------------------------------------------------- Color --- */

const colorOptions: FolderColor[] = ['lavender', 'blue', 'green', 'pink', 'beige', 'peach']
const colorPickerOpen = ref(false)
const colorRoot = ref<HTMLElement | null>(null)

function addColor(color: FolderColor) {
  const boardId = board.currentBoardId.value
  colorPickerOpen.value = false
  if (boardId) board.addColorItem(boardId, color)
}

/* -------------------------------------------------------------- Link --- */

const linkPickerOpen = ref(false)
const linkQuery = ref('')
const linkInput = ref<HTMLInputElement>()
const linkRoot = ref<HTMLElement | null>(null)

const linkResults = computed(() => {
  const q = linkQuery.value.trim()
  if (!q) return { tasks: [], notes: [] }
  const r = search(q)
  return { tasks: r.tasks.slice(0, 6), notes: r.notes.slice(0, 6) }
})

function openLinkPicker() {
  if (!board.currentBoardId.value) return
  linkPickerOpen.value = true
  linkQuery.value = ''
  void nextTick(() => linkInput.value?.focus())
}

function pickLink(target: Item) {
  const boardId = board.currentBoardId.value
  linkPickerOpen.value = false
  if (boardId) board.addLinkItem(boardId, target)
}

/** Ferme le picker quand le focus part ailleurs que dans son propre panneau. */
function onPickerFocusOut(e: FocusEvent) {
  const panel = e.currentTarget as HTMLElement
  if (!e.relatedTarget || !panel.contains(e.relatedTarget as Node)) linkPickerOpen.value = false
}

function onDocClick(e: MouseEvent) {
  if (imageRoot.value && !imageRoot.value.contains(e.target as Node)) imagePickerOpen.value = false
  if (colorRoot.value && !colorRoot.value.contains(e.target as Node)) colorPickerOpen.value = false
  if (linkRoot.value && !linkRoot.value.contains(e.target as Node)) linkPickerOpen.value = false
}
onMounted(() => window.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => window.removeEventListener('mousedown', onDocClick))
</script>

<template>
  <div class="page-sheet mx-auto max-w-[1400px] px-8 py-9">
    <PageHeader title="Vision board" subtitle="Un canvas libre par idée — images, notes, couleurs, cartes vers tes tâches, sections.">
      <VisionBoardTabs />
    </PageHeader>

    <div
      v-if="!board.currentBoardId.value"
      class="mt-8 flex flex-col items-center gap-4 rounded-2xl bg-white p-12 text-center shadow-soft ring-1 ring-ink/[0.08]"
    >
      <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-lavender-100 text-lavender-600">
        <IconVisionBoard class="h-7 w-7" />
      </div>
      <div>
        <p class="font-display text-[16px] font-medium text-ink">Ton premier vision board t'attend</p>
        <p class="mt-1 text-[13px] text-ink-faint">
          Un canvas libre pour poser tes images, tes notes et tes idées, à ton rythme.
        </p>
      </div>
      <button
        type="button"
        :disabled="creatingFirstBoard"
        class="flex items-center gap-2 rounded-xl bg-lavender-500 px-4 py-2.5 text-[13.5px] font-medium text-white shadow-soft transition-colors hover:bg-lavender-600 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
        @click="createFirstBoard"
      >
        <IconPlus class="h-4 w-4" />
        {{ creatingFirstBoard ? 'Création…' : 'Créer mon premier vision board' }}
      </button>
    </div>

    <template v-else>
      <div class="mt-5 flex flex-wrap items-center gap-2">
        <input ref="fileInput" type="file" class="hidden" :accept="ACCEPTED_TYPES.join(',')" @change="onFilePicked" />
        <div ref="imageRoot" class="relative">
          <button
            type="button"
            :disabled="uploading"
            class="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-[12.5px] font-medium text-ink-soft shadow-soft transition-colors hover:border-lavender-300 hover:text-lavender-600 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            @click="imagePickerOpen ? (imagePickerOpen = false) : openImagePicker()"
          >
            <IconImage class="h-4 w-4" />
            {{ uploading ? 'Envoi…' : 'Image' }}
          </button>
          <Transition name="pop">
            <div
              v-if="imagePickerOpen"
              class="absolute left-0 top-[calc(100%+0.375rem)] z-30 w-72 rounded-xl bg-white p-3 shadow-soft-lg ring-1 ring-ink/[0.08]"
            >
              <button
                type="button"
                class="w-full rounded-xl bg-lavender-500 px-3 py-2 text-[12.5px] font-medium text-white shadow-soft transition-colors hover:bg-lavender-600 cursor-pointer"
                @click="fileInput?.click()"
              >
                Choisir un fichier
              </button>
              <div class="my-2.5 flex items-center gap-2">
                <span class="h-px flex-1 bg-line" />
                <span class="text-[11px] text-ink-faint">ou</span>
                <span class="h-px flex-1 bg-line" />
              </div>
              <label class="block text-[11.5px] text-ink-soft">
                Coller un lien de pin Pinterest, ou l'adresse directe d'une image
              </label>
              <div class="mt-1.5 flex gap-1.5">
                <input
                  ref="imageUrlInput"
                  v-model="imageUrlDraft"
                  type="url"
                  placeholder="https://…"
                  class="w-full rounded-lg bg-paper px-2.5 py-1.5 text-[12.5px] text-ink placeholder:text-ink-faint outline-none ring-1 ring-ink/[0.08] focus:ring-2 focus:ring-lavender-300"
                  @keydown.enter.prevent="addImageFromUrl"
                />
                <button
                  type="button"
                  class="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-lavender-300 hover:text-lavender-600 cursor-pointer"
                  @click="addImageFromUrl"
                >
                  Ajouter
                </button>
              </div>
            </div>
          </Transition>
        </div>

        <button
          type="button"
          class="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-[12.5px] font-medium text-ink-soft shadow-soft transition-colors hover:border-lavender-300 hover:text-lavender-600 cursor-pointer"
          @click="addNote"
        >
          <IconNote class="h-4 w-4" />
          Note
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-[12.5px] font-medium text-ink-soft shadow-soft transition-colors hover:border-lavender-300 hover:text-lavender-600 cursor-pointer"
          @click="addSection"
        >
          <IconSection class="h-4 w-4" />
          Section
        </button>

        <div ref="colorRoot" class="relative">
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-[12.5px] font-medium text-ink-soft shadow-soft transition-colors hover:border-lavender-300 hover:text-lavender-600 cursor-pointer"
            @click="colorPickerOpen = !colorPickerOpen; linkPickerOpen = false; imagePickerOpen = false"
          >
            <span class="h-3.5 w-3.5 rounded-full" :class="useFolderColor('lavender').bg" />
            Couleur
          </button>
          <Transition name="pop">
            <div
              v-if="colorPickerOpen"
              class="absolute left-0 top-[calc(100%+0.375rem)] z-30 flex gap-2 rounded-xl bg-white p-2.5 shadow-soft-lg ring-1 ring-ink/[0.08]"
            >
              <button
                v-for="c in colorOptions"
                :key="c"
                type="button"
                class="h-7 w-7 rounded-full border-2 border-transparent transition-transform hover:scale-110 cursor-pointer"
                :class="useFolderColor(c).bg"
                @click="addColor(c)"
              />
            </div>
          </Transition>
        </div>

        <div ref="linkRoot" class="relative">
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-[12.5px] font-medium text-ink-soft shadow-soft transition-colors hover:border-lavender-300 hover:text-lavender-600 cursor-pointer"
            @click="openLinkPicker(); colorPickerOpen = false; imagePickerOpen = false"
          >
            <IconLink class="h-4 w-4" />
            Lier une tâche/note
          </button>
          <Transition name="pop">
            <div
              v-if="linkPickerOpen"
              class="absolute left-0 top-[calc(100%+0.375rem)] z-30 w-72 rounded-xl bg-white p-2 shadow-soft-lg ring-1 ring-ink/[0.08]"
              @focusout="onPickerFocusOut"
            >
              <input
                ref="linkInput"
                v-model="linkQuery"
                type="text"
                placeholder="Rechercher une tâche ou une note…"
                class="w-full rounded-lg bg-paper px-2.5 py-1.5 text-[12.5px] text-ink placeholder:text-ink-faint outline-none ring-1 ring-ink/[0.08] focus:ring-2 focus:ring-lavender-300"
              />
              <div v-if="linkQuery.trim()" class="mt-1.5 max-h-56 overflow-y-auto">
                <button
                  v-for="t in linkResults.tasks"
                  :key="t.id"
                  type="button"
                  class="flex w-full items-center gap-2 truncate rounded-lg px-2 py-1.5 text-left text-[12.5px] text-ink hover:bg-lavender-50 cursor-pointer"
                  @click="pickLink(t)"
                >
                  {{ t.title }}
                </button>
                <button
                  v-for="n in linkResults.notes"
                  :key="n.id"
                  type="button"
                  class="flex w-full items-center gap-2 truncate rounded-lg px-2 py-1.5 text-left text-[12.5px] text-ink hover:bg-lavender-50 cursor-pointer"
                  @click="pickLink(n)"
                >
                  {{ n.title }}
                </button>
                <p v-if="!linkResults.tasks.length && !linkResults.notes.length" class="px-2 py-1.5 text-[12px] text-ink-faint">
                  Aucun résultat.
                </p>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-1.5">
        <span class="text-[11.5px] font-medium text-ink-faint">Afficher :</span>
        <button
          v-for="f in KIND_FILTERS"
          :key="f.kind"
          type="button"
          class="rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors cursor-pointer"
          :class="
            hiddenKinds.has(f.kind)
              ? 'bg-ink/5 text-ink-faint hover:bg-ink/10'
              : 'bg-lavender-100 text-lavender-700 hover:bg-lavender-200'
          "
          @click="toggleKindFilter(f.kind)"
        >
          {{ f.label }}
        </button>
      </div>

      <div v-if="loading" class="mt-5 flex aspect-[16/10] w-full items-center justify-center rounded-2xl bg-white shadow-soft ring-1 ring-ink/[0.08]">
        <p class="text-[13px] text-ink-faint">Chargement…</p>
      </div>
      <VisionBoardCanvas v-else class="mt-5" :items="filteredItems" />
    </template>
  </div>
</template>
