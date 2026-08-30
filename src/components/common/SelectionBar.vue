<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useStore } from '@/store/useStore'
import { useActiveSelection } from '@/composables/useSelection'
import { useFolderColor } from '@/composables/useFolderColor'
import IconTrash from '@/icons/IconTrash.vue'
import IconArrowRight from '@/icons/IconArrowRight.vue'
import IconX from '@/icons/IconX.vue'

const { folders, moveItemToFolder, removeItem } = useStore()
const selection = useActiveSelection()

const moveMenuOpen = ref(false)
const root = ref<HTMLElement>()

function bulkMove(folderId: string | null) {
  for (const id of selection.selectedIds.value) moveItemToFolder(id, folderId)
  moveMenuOpen.value = false
  selection.clear()
}

function bulkDelete() {
  for (const id of selection.selectedIds.value) removeItem(id)
  selection.clear()
}

function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) moveMenuOpen.value = false
}
onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))
</script>

<template>
  <Transition name="pop">
    <div
      v-if="selection.count.value > 0"
      class="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-ink px-3 py-2.5 text-white shadow-soft-lg"
    >
      <span class="px-1.5 text-[13px] font-medium">
        {{ selection.count.value }} sélectionné{{ selection.count.value > 1 ? 's' : '' }}
      </span>

      <div class="h-5 w-px bg-white/15" />

      <div ref="root" class="relative">
        <button
          type="button"
          class="rounded-xl px-3 py-1.5 text-[12.5px] font-medium text-white/85 transition-colors hover:bg-white/10 cursor-pointer"
          @click="moveMenuOpen = !moveMenuOpen"
        >
          Déplacer vers…
        </button>

        <Transition name="pop">
          <div
            v-if="moveMenuOpen"
            class="absolute bottom-full left-0 z-20 mb-2 w-52 rounded-2xl bg-white p-1.5 text-ink shadow-soft-lg ring-1 ring-ink/5"
          >
            <button
              type="button"
              class="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] text-ink-soft hover:bg-lavender-50 cursor-pointer"
              @click="bulkMove(null)"
            >
              <IconArrowRight class="h-3.5 w-3.5 text-ink-faint" />
              Inbox
            </button>
            <button
              v-for="f in folders"
              :key="f.id"
              type="button"
              class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] text-ink-soft hover:bg-lavender-50 cursor-pointer"
              @click="bulkMove(f.id)"
            >
              <span class="h-2 w-2 rounded-full" :class="useFolderColor(f.color).bg" />
              {{ f.name }}
            </button>
          </div>
        </Transition>
      </div>

      <button
        type="button"
        class="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-medium text-rose-300 transition-colors hover:bg-rose-500/15 cursor-pointer"
        @click="bulkDelete"
      >
        <IconTrash class="h-3.5 w-3.5" />
        Supprimer
      </button>

      <div class="h-5 w-px bg-white/15" />

      <button
        type="button"
        title="Annuler la sélection"
        class="rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
        @click="selection.clear"
      >
        <IconX class="h-3.5 w-3.5" />
      </button>
    </div>
  </Transition>
</template>
