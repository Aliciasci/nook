<script setup lang="ts">
import { useStore } from '@/store/useStore'
import { useSelection } from '@/composables/useSelection'
import InlineQuickAdd from '@/components/common/InlineQuickAdd.vue'
import MoveToFolderMenu from '@/components/common/MoveToFolderMenu.vue'
import Checkbox from '@/components/common/Checkbox.vue'
import SelectModeToggle from '@/components/common/SelectModeToggle.vue'
import IconNote from '@/icons/IconNote.vue'

const { quickNotes } = useStore()
const selection = useSelection('home-notes')

function onRowClick(id: string) {
  if (selection.state.isSelecting) selection.toggle(id)
}
</script>

<template>
  <div class="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/[0.08]">
    <div class="flex items-center justify-between">
      <h2 class="font-display text-[15px] font-medium text-ink">Notes rapides</h2>
      <SelectModeToggle v-if="quickNotes.length" scope="home-notes" />
    </div>

    <div class="mt-3">
      <InlineQuickAdd type="note" placeholder="Écrire une note…" />
    </div>

    <div v-if="quickNotes.length" class="mt-3 flex flex-col gap-1">
      <div
        v-for="n in quickNotes"
        :key="n.id"
        class="group flex min-h-11 items-start gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-lavender-50/60"
        :class="{
          'cursor-pointer': selection.state.isSelecting,
          'bg-lavender-50/60 ring-1 ring-lavender-200': selection.state.isSelecting && selection.isSelected(n.id),
        }"
        @click="onRowClick(n.id)"
      >
        <Checkbox
          v-if="selection.state.isSelecting"
          class="mt-0.5"
          :model-value="selection.isSelected(n.id)"
          @update:model-value="selection.toggle(n.id)"
        />
        <IconNote v-else class="mt-0.5 h-3.5 w-3.5 shrink-0 text-lavender-400" />
        <p class="min-w-0 flex-1 text-[13px] leading-snug text-ink-soft">{{ n.title }}</p>
        <MoveToFolderMenu
          v-if="!selection.state.isSelecting"
          :item-id="n.id"
          :folder-id="n.folderId"
          :archived="n.archivedAt !== null"
        />
      </div>
    </div>
  </div>
</template>
