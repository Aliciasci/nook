<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Item, Priority } from '@/types'
import { useStore } from '@/store/useStore'
import { useFolderColor } from '@/composables/useFolderColor'
import { useUiState } from '@/composables/useUiState'
import { useSelection } from '@/composables/useSelection'
import { useItemLinkDrag } from '@/composables/useItemLinkDrag'
import Checkbox from '@/components/common/Checkbox.vue'
import MoveToFolderMenu from '@/components/common/MoveToFolderMenu.vue'
import IconCalendar from '@/icons/IconCalendar.vue'
import IconLink from '@/icons/IconLink.vue'
import IconTarget from '@/icons/IconTarget.vue'
import { useFocusSession } from '@/composables/useFocusSession'

const props = withDefaults(
  defineProps<{
    item: Item
    showFolder?: boolean
    dateMode?: 'due' | 'created'
    hideDate?: boolean
    selectionScope?: string
  }>(),
  { showFolder: true, dateMode: 'due', hideDate: false, selectionScope: 'default' },
)

const { getFolder, toggleTaskDone, linkCount, linkedItems } = useStore()
const { openFocus } = useFocusSession()
const { openEditItem, openItemDetail } = useUiState()
const selection = useSelection(props.selectionScope)
const linkDrag = useItemLinkDrag()

/** La ligne est survolée par un élément qu'elle peut accueillir. */
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

function onRowClick() {
  // La case à cocher, la pastille de liens, le bouton Focus et le menu ⋯
  // arrêtent déjà leur propre clic : ce gestionnaire ne voit que la ligne.
  if (selection.state.isSelecting) selection.toggle(props.item.id)
  else openItemDetail(props.item)
}

const folder = computed(() => getFolder(props.item.folderId))

/** Pastille des liens : combien, et lesquels en infobulle. */
const links = computed(() => {
  const count = linkCount(props.item.id)
  if (!count) return null
  return {
    count,
    title: `${count === 1 ? 'Lié à' : 'Liés à'} ${linkedItems(props.item.id).map((it) => it.title).join(' · ')}`,
  }
})

/** La pastille mène au détail, où les liens se lisent — pas au formulaire. */
function onLinksClick() {
  if (selection.state.isSelecting) selection.toggle(props.item.id)
  else openItemDetail(props.item)
}

/**
 * Niveau d'importance. Les teintes montent du neutre au rose : c'est la même
 * lecture qu'une échéance dépassée, qui est déjà en rose dans la ligne.
 */
const PRIORITY_STYLES: Record<Priority, { label: string; pill: string; dot: string }> = {
  low: { label: 'Basse', pill: 'bg-ink/5 text-ink-faint', dot: 'bg-ink-faint/70' },
  medium: { label: 'Normale', pill: 'bg-folder-beige/60 text-folder-beige-ink', dot: 'bg-folder-beige-ink/70' },
  high: { label: 'Haute', pill: 'bg-rose-50 text-rose-500', dot: 'bg-rose-400' },
}

/** Rien sur une tâche faite : la ligne est déjà barrée et grisée. */
const priorityInfo = computed(() => {
  if (!props.item.priority || props.item.status === 'done') return null
  return PRIORITY_STYLES[props.item.priority]
})

const dueInfo = computed(() => {
  if (props.dateMode !== 'due' || !props.item.dueDate) return null
  const today = new Date().toISOString().slice(0, 10)
  const isToday = props.item.dueDate === today
  const isPast = props.item.dueDate < today
  const d = new Date(props.item.dueDate + 'T00:00:00')
  const label = isToday
    ? "Aujourd'hui"
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  return { label, isToday, isPast: isPast && !isToday }
})

const createdInfo = computed(() => {
  if (props.dateMode !== 'created') return null
  const today = new Date().toISOString().slice(0, 10)
  const createdDate = props.item.createdAt.slice(0, 10)
  if (createdDate === today) return "Aujourd'hui"
  const days = Math.round((new Date(today).getTime() - new Date(createdDate).getTime()) / 86_400_000)
  if (days === 1) return 'Hier'
  return `Il y a ${days} j`
})
</script>

<template>
  <div
    class="group flex min-h-12 items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors"
    :class="[
      dropTarget ? 'bg-lavender-50 ring-2 ring-lavender-400' : 'hover:bg-lavender-50/60',
      selection.state.isSelecting && selection.isSelected(item.id) ? 'cursor-pointer bg-lavender-50/60 ring-1 ring-lavender-200' : '',
      linkDrag.isDragging.value && !dropTarget ? 'opacity-60' : '',
    ]"
    :draggable="!selection.state.isSelecting"
    @dragstart="linkDrag.start(item, $event)"
    @dragend="linkDrag.end(); dropTarget = false"
    @dragover="onDragOver"
    @dragleave="dropTarget = false"
    @drop.prevent="onDrop"
    @click="onRowClick"
  >
    <Checkbox
      v-if="selection.state.isSelecting"
      :model-value="selection.isSelected(item.id)"
      @update:model-value="selection.toggle(item.id)"
    />
    <Checkbox
      v-else
      :model-value="item.status === 'done'"
      @update:model-value="toggleTaskDone(item.id)"
    />

    <span
      class="min-w-0 flex-1 truncate text-[13.75px]"
      :class="item.status === 'done' ? 'text-ink-faint line-through' : 'text-ink'"
      :title="item.title"
    >
      {{ item.title }}
    </span>

    <span
      v-if="priorityInfo"
      class="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      :class="priorityInfo.pill"
      :title="`Importance ${priorityInfo.label.toLowerCase()}`"
    >
      <span class="h-1.5 w-1.5 rounded-full" :class="priorityInfo.dot" />
      {{ priorityInfo.label }}
    </span>

    <button
      v-if="links"
      type="button"
      class="flex shrink-0 items-center gap-1 rounded-full bg-lavender-50 px-1.5 py-0.5 text-[11px] font-medium text-lavender-600 transition-colors hover:bg-lavender-100 cursor-pointer"
      :title="links.title"
      @click.stop="onLinksClick"
    >
      <IconLink class="h-3 w-3" />
      {{ links.count }}
    </button>

    <span
      v-if="showFolder && folder"
      class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
      :class="[useFolderColor(folder.color).bgSoft, useFolderColor(folder.color).ink]"
    >
      {{ folder.name }}
    </span>

    <span
      v-if="dueInfo && !hideDate"
      class="flex shrink-0 items-center gap-1 text-[11.5px] font-medium"
      :class="dueInfo.isPast ? 'text-rose-400' : dueInfo.isToday ? 'text-lavender-600' : 'text-ink-faint'"
    >
      <IconCalendar class="h-3.5 w-3.5" />
      {{ dueInfo.label }}
    </span>

    <span v-else-if="createdInfo && !hideDate" class="shrink-0 text-[11.5px] font-medium text-ink-faint">
      {{ createdInfo }}
    </span>

    <template v-if="!selection.state.isSelecting">
      <button
        v-if="item.status !== 'done'"
        type="button"
        title="Focus"
        class="rounded-lg p-1.5 text-ink-faint opacity-0 transition-all hover:bg-lavender-100 hover:text-lavender-700 group-hover:opacity-100 cursor-pointer"
        @click.stop="openFocus(item)"
      >
        <IconTarget class="h-4 w-4" />
      </button>

      <MoveToFolderMenu :item-id="item.id" :folder-id="item.folderId" @edit="openEditItem(item)" />
    </template>
  </div>
</template>
