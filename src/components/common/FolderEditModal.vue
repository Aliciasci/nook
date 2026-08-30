<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Modal from '@/components/common/Modal.vue'
import { useStore } from '@/store/useStore'
import { useUiState } from '@/composables/useUiState'
import { useFolderColor } from '@/composables/useFolderColor'
import type { FolderColor } from '@/types'
import IconX from '@/icons/IconX.vue'

const { getFolder, updateFolder } = useStore()
const { state, closeEditFolder } = useUiState()

const colorOptions: FolderColor[] = ['lavender', 'blue', 'green', 'pink', 'beige', 'peach']
const emojiOptions = [
  '📘', '📗', '📙', '📕', '💜', '💙', '💚', '🧡',
  '💡', '👀', '📄', '📁', '🗂️', '✅', '🎯', '✨',
  '📚', '🌿', '🍀', '🎨', '🛠️', '💻', '📈', '🔒',
  '💰', '🧾', '📌', '🚀',
]

const folder = computed(() => getFolder(state.editFolderId))
const isOpen = computed(() => state.editFolderId !== null)

const color = ref<FolderColor>('lavender')
const icon = ref('📁')

watch(
  () => state.editFolderId,
  (id) => {
    if (!id) return
    const f = getFolder(id)
    if (!f) return
    color.value = f.color
    icon.value = f.icon ?? '📁'
  },
)

function save() {
  if (!state.editFolderId) return
  updateFolder(state.editFolderId, { color: color.value, icon: icon.value })
  closeEditFolder()
}
</script>

<template>
  <Modal :open="isOpen" @close="closeEditFolder">
    <div v-if="folder" class="rounded-2xl bg-white p-5 shadow-soft-lg ring-1 ring-ink/5">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="font-display text-[15px] font-medium text-ink">Modifier « {{ folder.name }} »</h2>
        <button
          type="button"
          class="rounded-full p-1 text-ink-faint transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
          @click="closeEditFolder"
        >
          <IconX class="h-4 w-4" />
        </button>
      </div>

      <div class="flex items-center justify-center">
        <div
          class="flex h-16 w-16 items-center justify-center rounded-2xl text-[30px] shadow-folder transition-colors"
          :class="useFolderColor(color).bg"
        >
          {{ icon }}
        </div>
      </div>

      <p class="mt-5 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Couleur</p>
      <div class="mt-2 flex gap-2.5">
        <button
          v-for="c in colorOptions"
          :key="c"
          type="button"
          class="h-8 w-8 rounded-full border-2 transition-transform cursor-pointer"
          :class="[useFolderColor(c).bg, color === c ? 'scale-110 border-ink/30' : 'border-transparent']"
          @click="color = c"
        />
      </div>

      <p class="mt-5 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Icône</p>
      <div class="mt-2 grid grid-cols-7 gap-1.5">
        <button
          v-for="e in emojiOptions"
          :key="e"
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-xl text-[18px] transition-colors cursor-pointer"
          :class="icon === e ? 'bg-lavender-100 ring-2 ring-lavender-300' : 'hover:bg-paper'"
          @click="icon = e"
        >
          {{ e }}
        </button>
      </div>

      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-xl px-3.5 py-2 text-[13px] font-medium text-ink-faint hover:bg-lavender-50 cursor-pointer"
          @click="closeEditFolder"
        >
          Annuler
        </button>
        <button
          type="button"
          class="rounded-xl bg-lavender-500 px-4 py-2 text-[13px] font-medium text-white shadow-soft transition-colors hover:bg-lavender-600 cursor-pointer"
          @click="save"
        >
          Enregistrer
        </button>
      </div>
    </div>
  </Modal>
</template>
