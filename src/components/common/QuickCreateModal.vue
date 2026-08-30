<script setup lang="ts">
/**
 * La création — d'une tâche, d'une note ou d'un dossier.
 *
 * Ce modal ne modifie plus rien : « Modifier » ouvre le panneau de détail en
 * formulaire, au même endroit que la lecture. Un modal par-dessus un panneau
 * faisait deux calques pour un seul item, et les deux se disputaient la touche
 * Échap.
 */
import { computed, nextTick, ref, watch } from 'vue'
import Modal from '@/components/common/Modal.vue'
import ItemFormFields from '@/components/common/ItemFormFields.vue'
import { emptyLinkDraft, type LinkDraft } from '@/components/common/linkDraft'
import { useStore } from '@/store/useStore'
import { useUiState } from '@/composables/useUiState'
import { useFolderColor } from '@/composables/useFolderColor'
import type { FolderColor, Item, ItemType, Priority } from '@/types'
import IconX from '@/icons/IconX.vue'

const { addTask, addNote, addLinkedNote, addFolder, linkItems } = useStore()
const { state, closeQuickCreate } = useUiState()

const title = ref('')
const content = ref('')
const folderId = ref<string | null>(null)
const priority = ref<Priority | null>(null)
const dueDate = ref('')
const folderColor = ref<FolderColor>('lavender')
const linkDraft = ref<LinkDraft>(emptyLinkDraft())
const folderNameInput = ref<HTMLInputElement>()

const colorOptions: FolderColor[] = ['lavender', 'blue', 'green', 'pink', 'beige', 'peach']

const isFolder = computed(() => state.quickCreateMode === 'folder')

/** Le formulaire d'item n'est monté que pour une tâche ou une note. */
// La comparaison porte sur `quickCreateMode` et non sur `isFolder` : c'est
// elle qui restreint le type au couple tâche/note.
const itemType = computed<ItemType>(() =>
  state.quickCreateMode === 'folder' ? 'task' : state.quickCreateMode,
)

const heading = computed(() => {
  if (state.quickCreateMode === 'task') return 'Nouvelle tâche'
  if (state.quickCreateMode === 'note') return 'Nouvelle note'
  return 'Nouveau dossier'
})

watch(
  () => state.quickCreateOpen,
  (open) => {
    if (!open) return
    title.value = ''
    content.value = ''
    folderId.value = state.quickCreateFolderId
    priority.value = null
    dueDate.value = ''
    folderColor.value = 'lavender'
    linkDraft.value = emptyLinkDraft()
    // `ItemFormFields` prend le focus lui-même ; le champ du dossier est local
    // à ce modal.
    if (isFolder.value) void nextTick(() => folderNameInput.value?.focus())
  },
)

/** Les liens demandés pendant la création, posés une fois l'item en place. */
function applyLinkDraft(item: Item) {
  for (const id of linkDraft.value.linkIds) linkItems(item.id, id)
  for (const noteTitle of linkDraft.value.newNoteTitles) addLinkedNote(item.id, { title: noteTitle })
}

function submit() {
  const value = title.value.trim()
  if (!value) return

  if (state.quickCreateMode === 'task') {
    applyLinkDraft(
      addTask({
        title: value,
        content: content.value.trim() || null,
        folderId: folderId.value,
        priority: priority.value,
        dueDate: dueDate.value || null,
      }),
    )
  } else if (state.quickCreateMode === 'note') {
    applyLinkDraft(addNote({ title: value, content: content.value.trim() || null, folderId: folderId.value }))
  } else {
    addFolder({ name: value, color: folderColor.value })
  }
  closeQuickCreate()
}
</script>

<template>
  <Modal :open="state.quickCreateOpen" @close="closeQuickCreate">
    <form class="rounded-2xl bg-white p-5 shadow-soft-lg ring-1 ring-ink/5" @submit.prevent="submit">
      <div class="mb-3.5 flex items-center justify-between">
        <h2 class="font-display text-[15px] font-medium text-ink">{{ heading }}</h2>
        <button
          type="button"
          class="rounded-full p-1 text-ink-faint transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
          @click="closeQuickCreate"
        >
          <IconX class="h-4 w-4" />
        </button>
      </div>

      <ItemFormFields
        v-if="!isFolder"
        v-model:title="title"
        v-model:content="content"
        v-model:folder-id="folderId"
        v-model:priority="priority"
        v-model:due-date="dueDate"
        v-model:draft="linkDraft"
        :type="itemType"
        :item-id="null"
        autofocus
        :navigable="false"
        @submit="submit"
      />

      <template v-else>
        <input
          ref="folderNameInput"
          v-model="title"
          type="text"
          placeholder="Nom du dossier"
          class="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:border-lavender-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-lavender-100"
        />
        <div class="mt-3 flex gap-2">
          <button
            v-for="c in colorOptions"
            :key="c"
            type="button"
            class="h-7 w-7 rounded-full border-2 transition-transform cursor-pointer"
            :class="[useFolderColor(c).bg, folderColor === c ? 'scale-110 border-ink/30' : 'border-transparent']"
            @click="folderColor = c"
          />
        </div>
      </template>

      <div class="mt-4 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-xl px-3.5 py-2 text-[13px] font-medium text-ink-faint hover:bg-lavender-50 cursor-pointer"
          @click="closeQuickCreate"
        >
          Annuler
        </button>
        <button
          type="submit"
          class="rounded-xl bg-lavender-500 px-4 py-2 text-[13px] font-medium text-white shadow-soft transition-colors hover:bg-lavender-600 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          :disabled="!title.trim()"
        >
          Créer
        </button>
      </div>
    </form>
  </Modal>
</template>
