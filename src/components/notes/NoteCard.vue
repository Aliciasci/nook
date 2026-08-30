<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Item } from '@/types'
import { useStore } from '@/store/useStore'
import { useFolderColor } from '@/composables/useFolderColor'
import { useUiState } from '@/composables/useUiState'
import { useSelection } from '@/composables/useSelection'
import { useItemLinkDrag } from '@/composables/useItemLinkDrag'
import MoveToFolderMenu from '@/components/common/MoveToFolderMenu.vue'
import Checkbox from '@/components/common/Checkbox.vue'
import RichText from '@/components/common/RichText.vue'
import IconLink from '@/icons/IconLink.vue'
import IconNote from '@/icons/IconNote.vue'

const props = withDefaults(
  defineProps<{ item: Item; showFolder?: boolean; selectionScope?: string }>(),
  { showFolder: true, selectionScope: 'default' },
)

const { getFolder, linkCount, linkedItems } = useStore()
const { openEditItem, openItemDetail } = useUiState()
const selection = useSelection(props.selectionScope)
const linkDrag = useItemLinkDrag()
const folder = computed(() => getFolder(props.item.folderId))

/** La carte est survolée par un élément qu'elle peut accueillir. */
const dropTarget = ref(false)

function onDragOver(e: DragEvent) {
  if (!linkDrag.accepts(props.item)) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'link'
  dropTarget.value = true
}

function onDrop() {
  dropTarget.value = false
  linkDrag.drop(props.item)
}

/** Pastille des liens : combien, et lesquels en infobulle. */
const links = computed(() => {
  const count = linkCount(props.item.id)
  if (!count) return null
  return {
    count,
    title: `Liée à ${linkedItems(props.item.id).map((it) => it.title).join(' · ')}`,
  }
})

function onCardClick() {
  if (selection.state.isSelecting) selection.toggle(props.item.id)
  else openItemDetail(props.item)
}

function onLinksClick() {
  if (selection.state.isSelecting) selection.toggle(props.item.id)
  else openItemDetail(props.item)
}
</script>

<template>
  <div
    class="group flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-soft ring-1 transition-all hover:-translate-y-0.5 hover:shadow-soft-lg"
    :class="[
      dropTarget ? 'ring-2 ring-lavender-400 bg-lavender-50/40' : 'ring-ink/[0.08]',
      selection.state.isSelecting ? 'cursor-pointer' : '',
      selection.state.isSelecting && selection.isSelected(item.id) ? 'ring-lavender-300' : '',
      linkDrag.isDragging.value && !dropTarget ? 'opacity-60' : '',
    ]"
    :draggable="!selection.state.isSelecting"
    @dragstart="linkDrag.start(item, $event)"
    @dragend="linkDrag.end(); dropTarget = false"
    @dragover="onDragOver"
    @dragleave="dropTarget = false"
    @drop.prevent="onDrop"
    @click="onCardClick"
  >
    <div class="flex min-h-7 items-start justify-between gap-2">
      <div class="flex flex-1 items-start gap-2 min-w-0">
        <Checkbox
          v-if="selection.state.isSelecting"
          class="mt-0.5"
          :model-value="selection.isSelected(item.id)"
          @update:model-value="selection.toggle(item.id)"
        />
        <IconNote v-else class="mt-0.5 h-3.5 w-3.5 shrink-0 text-lavender-400" />
        <p class="min-w-0 truncate text-[13.5px] font-medium text-ink" :title="item.title">{{ item.title }}</p>
      </div>
      <MoveToFolderMenu
        v-if="!selection.state.isSelecting"
        :item-id="item.id"
        :folder-id="item.folderId"
        @edit="openEditItem(item)"
      />
    </div>

    <RichText :text="item.content" :clamp="3" class="text-[12.5px] leading-relaxed text-ink-soft" />

    <div v-if="links || (showFolder && folder)" class="mt-1 flex flex-wrap items-center gap-1.5">
      <button
        v-if="links"
        type="button"
        class="flex w-fit items-center gap-1 rounded-full bg-lavender-50 px-2 py-0.5 text-[10.5px] font-medium text-lavender-600 transition-colors hover:bg-lavender-100 cursor-pointer"
        :title="links.title"
        @click.stop="onLinksClick"
      >
        <IconLink class="h-3 w-3" />
        {{ links.count }}
      </button>
      <span
        v-if="showFolder && folder"
        class="w-fit rounded-full px-2 py-0.5 text-[10.5px] font-medium"
        :class="[useFolderColor(folder.color).bgSoft, useFolderColor(folder.color).ink]"
      >
        {{ folder.name }}
      </span>
    </div>
  </div>
</template>
