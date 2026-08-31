<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useStore } from '@/store/useStore'
import { useFolderColor } from '@/composables/useFolderColor'
import IconMoreHorizontal from '@/icons/IconMoreHorizontal.vue'
import IconArrowRight from '@/icons/IconArrowRight.vue'
import IconTrash from '@/icons/IconTrash.vue'
import IconPencil from '@/icons/IconPencil.vue'
import IconArchiveBox from '@/icons/IconArchiveBox.vue'

const props = withDefaults(defineProps<{ itemId: string; folderId: string | null; archived?: boolean }>(), {
  archived: false,
})
const emit = defineEmits<{ edit: [] }>()

const { folders, moveItemToFolder, archiveItem, unarchiveItem, removeItem } = useStore()
const isOpen = ref(false)
const root = ref<HTMLElement>()

function edit() {
  isOpen.value = false
  emit('edit')
}

function move(id: string | null) {
  moveItemToFolder(props.itemId, id)
  isOpen.value = false
}

function toggleArchive() {
  if (props.archived) unarchiveItem(props.itemId)
  else archiveItem(props.itemId)
  isOpen.value = false
}

function remove() {
  removeItem(props.itemId)
  isOpen.value = false
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
      class="rounded-lg p-1.5 text-ink-faint opacity-0 transition-all hover:bg-lavender-100 hover:text-lavender-700 group-hover:opacity-100 cursor-pointer"
      :class="{ '!opacity-100 bg-lavender-100 text-lavender-700': isOpen }"
      @click.stop="isOpen = !isOpen"
    >
      <IconMoreHorizontal class="h-4 w-4" />
    </button>

    <Transition name="pop">
      <div
        v-if="isOpen"
        class="absolute right-0 z-20 mt-1 w-52 rounded-2xl bg-white p-1.5 shadow-soft-lg ring-1 ring-ink/5"
      >
        <button
          type="button"
          class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-ink-soft hover:bg-lavender-50 cursor-pointer"
          @click.stop="edit"
        >
          <IconPencil class="h-3.5 w-3.5 text-ink-faint" />
          Modifier
        </button>

        <div class="my-1 h-px bg-line" />

        <p class="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Déplacer vers…</p>
        <button
          v-if="folderId !== null"
          type="button"
          class="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] text-ink-soft hover:bg-lavender-50 cursor-pointer"
          @click.stop="move(null)"
        >
          <IconArrowRight class="h-3.5 w-3.5 text-ink-faint" />
          Inbox
        </button>
        <button
          v-for="f in folders.filter((f) => f.id !== folderId)"
          :key="f.id"
          type="button"
          class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] text-ink-soft hover:bg-lavender-50 cursor-pointer"
          @click.stop="move(f.id)"
        >
          <span class="h-2 w-2 rounded-full" :class="useFolderColor(f.color).bg" />
          {{ f.name }}
        </button>

        <div class="my-1 h-px bg-line" />

        <button
          type="button"
          class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] text-ink-soft hover:bg-lavender-50 cursor-pointer"
          @click.stop="toggleArchive"
        >
          <IconArchiveBox class="h-3.5 w-3.5 text-ink-faint" />
          {{ archived ? 'Désarchiver' : 'Archiver' }}
        </button>

        <div class="my-1 h-px bg-line" />

        <button
          type="button"
          class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-rose-500 hover:bg-rose-50 cursor-pointer"
          @click.stop="remove"
        >
          <IconTrash class="h-3.5 w-3.5" />
          Supprimer
        </button>
      </div>
    </Transition>
  </div>
</template>
