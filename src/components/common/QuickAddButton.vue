<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useUiState } from '@/composables/useUiState'
import IconPlus from '@/icons/IconPlus.vue'
import IconListCheck from '@/icons/IconListCheck.vue'
import IconNote from '@/icons/IconNote.vue'
import IconFolderPlus from '@/icons/IconFolderPlus.vue'

const props = defineProps<{ folderId?: string | null }>()

const { openQuickCreate } = useUiState()
const isOpen = ref(false)
const root = ref<HTMLElement>()

const options = [
  { mode: 'task' as const, label: 'Nouvelle tâche', icon: IconListCheck },
  { mode: 'note' as const, label: 'Nouvelle note', icon: IconNote },
  { mode: 'folder' as const, label: 'Nouveau dossier', icon: IconFolderPlus },
]

function pick(mode: 'task' | 'note' | 'folder') {
  isOpen.value = false
  openQuickCreate(mode, mode === 'folder' ? null : props.folderId ?? null)
}

function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) isOpen.value = false
}
onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex items-center gap-1.5 rounded-xl bg-lavender-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-soft transition-all hover:bg-lavender-600 hover:shadow-soft-lg active:scale-[0.97] cursor-pointer"
      @click="isOpen = !isOpen"
    >
      <IconPlus class="h-4 w-4" />
      Nouveau
    </button>

    <Transition name="pop">
      <div
        v-if="isOpen"
        class="absolute right-0 z-20 mt-2 w-52 rounded-2xl bg-white p-1.5 shadow-soft-lg ring-1 ring-ink/5"
      >
        <button
          v-for="opt in options"
          :key="opt.mode"
          type="button"
          class="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13.5px] font-medium text-ink-soft transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
          @click="pick(opt.mode)"
        >
          <component :is="opt.icon" class="h-[17px] w-[17px] text-lavender-500" />
          {{ opt.label }}
        </button>
      </div>
    </Transition>
  </div>
</template>
