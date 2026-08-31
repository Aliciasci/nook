<script setup lang="ts">
import { ref } from 'vue'
import type { Item, ItemStatus } from '@/types'
import KanbanCard from '@/components/kanban/KanbanCard.vue'
import InlineQuickAdd from '@/components/common/InlineQuickAdd.vue'

const props = defineProps<{ title: string; status: ItemStatus; items: Item[]; draggingId: string | null }>()
const emit = defineEmits<{
  open: [item: Item]
  'drag-start': [id: string]
  'drag-end': []
  drop: []
}>()

/** Survolée par une carte en train d'être glissée — même si elle vient de ce
 *  panneau : le retour visuel doit rester cohérent, y compris pour l'annuler
 *  en la reposant là où elle était. */
const over = ref(false)

function onDragOver(e: DragEvent) {
  if (!props.draggingId) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  over.value = true
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  over.value = false
  emit('drop')
}
</script>

<template>
  <div
    class="flex min-h-[16rem] flex-col rounded-2xl bg-ink/[0.02] p-3 ring-1 ring-ink/[0.06] transition-colors"
    :class="over ? '!bg-lavender-50 !ring-lavender-300' : ''"
    @dragover="onDragOver"
    @dragleave="over = false"
    @drop="onDrop"
  >
    <div class="flex items-center gap-2 px-1 pb-2.5">
      <h2 class="text-[13px] font-semibold text-ink">{{ title }}</h2>
      <span class="rounded-full bg-ink/[0.06] px-1.5 py-0.5 text-[11px] font-semibold text-ink-faint">
        {{ items.length }}
      </span>
    </div>

    <div class="flex flex-1 flex-col gap-2">
      <KanbanCard
        v-for="item in items"
        :key="item.id"
        :item="item"
        :dragging="draggingId === item.id"
        @click="emit('open', item)"
        @dragstart="emit('drag-start', item.id)"
        @dragend="emit('drag-end')"
      />
      <p v-if="!items.length" class="rounded-xl border border-dashed border-ink/10 px-3 py-5 text-center text-[12px] text-ink-faint">
        Rien ici.
      </p>
    </div>

    <div v-if="status !== 'done'" class="mt-2.5">
      <InlineQuickAdd :status="status" placeholder="Ajouter une tâche…" />
    </div>
  </div>
</template>
