<script setup lang="ts">
import { computed } from 'vue'
import type { Item, Priority } from '@/types'
import { useStore } from '@/store/useStore'
import { useFolderColor } from '@/composables/useFolderColor'
import { useUiState } from '@/composables/useUiState'
import MoveToFolderMenu from '@/components/common/MoveToFolderMenu.vue'
import IconCalendar from '@/icons/IconCalendar.vue'

const props = defineProps<{ item: Item; dragging: boolean }>()
const emit = defineEmits<{ click: []; dragstart: []; dragend: [] }>()

const { getFolder } = useStore()
const { openEditItem } = useUiState()

const folder = computed(() => getFolder(props.item.folderId))

/** Mêmes teintes que `TaskRow` : la lecture de l'importance reste la même partout. */
const PRIORITY_STYLES: Record<Priority, { label: string; pill: string; dot: string }> = {
  low: { label: 'Basse', pill: 'bg-ink/5 text-ink-faint', dot: 'bg-ink-faint/70' },
  medium: { label: 'Normale', pill: 'bg-folder-beige/60 text-folder-beige-ink', dot: 'bg-folder-beige-ink/70' },
  high: { label: 'Haute', pill: 'bg-rose-50 text-rose-500', dot: 'bg-rose-400' },
}
const priorityInfo = computed(() => (props.item.priority ? PRIORITY_STYLES[props.item.priority] : null))

const dueInfo = computed(() => {
  if (!props.item.dueDate) return null
  const today = new Date().toISOString().slice(0, 10)
  const isToday = props.item.dueDate === today
  const isPast = props.item.dueDate < today && !isToday
  const d = new Date(props.item.dueDate + 'T00:00:00')
  return {
    label: isToday ? "Aujourd'hui" : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    isToday,
    isPast,
  }
})

function onDragStart(e: DragEvent) {
  e.dataTransfer?.setData('text/plain', props.item.id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  emit('dragstart')
}
</script>

<template>
  <div
    class="group flex cursor-pointer flex-col gap-2.5 rounded-xl bg-white p-3 shadow-soft ring-1 ring-ink/[0.08] transition-opacity"
    :class="dragging ? 'opacity-40' : ''"
    draggable="true"
    @dragstart="onDragStart"
    @dragend="emit('dragend')"
    @click="emit('click')"
  >
    <div class="flex items-start justify-between gap-1.5">
      <p
        class="min-w-0 flex-1 text-[13.5px] leading-snug"
        :class="item.status === 'done' ? 'text-ink-faint line-through' : 'text-ink'"
      >
        {{ item.title }}
      </p>
      <MoveToFolderMenu :item-id="item.id" :folder-id="item.folderId" :archived="item.archivedAt !== null" @edit="openEditItem(item)" />
    </div>

    <div v-if="priorityInfo || folder || dueInfo" class="flex flex-wrap items-center gap-1.5">
      <span
        v-if="priorityInfo"
        class="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
        :class="priorityInfo.pill"
      >
        <span class="h-1.5 w-1.5 rounded-full" :class="priorityInfo.dot" />
        {{ priorityInfo.label }}
      </span>
      <span
        v-if="folder"
        class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
        :class="[useFolderColor(folder.color).bgSoft, useFolderColor(folder.color).ink]"
      >
        {{ folder.name }}
      </span>
      <span
        v-if="dueInfo"
        class="ml-auto flex shrink-0 items-center gap-1 text-[11px] font-medium"
        :class="dueInfo.isPast ? 'text-rose-400' : dueInfo.isToday ? 'text-lavender-600' : 'text-ink-faint'"
      >
        <IconCalendar class="h-3 w-3" />
        {{ dueInfo.label }}
      </span>
    </div>
  </div>
</template>
