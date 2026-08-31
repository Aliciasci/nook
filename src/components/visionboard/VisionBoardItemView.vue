<script lang="ts">
/** Quel bord (ou coin) tire le geste de redimensionnement. */
export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
</script>

<script setup lang="ts">
/**
 * Un élément posé sur le board — image, note, pastille de couleur, carte-lien
 * ou section.
 *
 * Le corps de la carte est la seule poignée de déplacement, comme
 * `TimeBlockCard` : aucune action ne vit dessus en clic direct, elle passe par
 * un petit bouton qui arrête sa propre propagation. Ça évite d'avoir à
 * distinguer un clic d'un glisser — le corps ne fait jamais qu'une seule chose.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { FolderColor, VisionBoardItem } from '@/types'
import { useVisionBoards } from '@/store/useVisionBoards'
import { useStore } from '@/store/useStore'
import { useUiState } from '@/composables/useUiState'
import { useFolderColor } from '@/composables/useFolderColor'
import RichText from '@/components/common/RichText.vue'
import RichTextField from '@/components/common/RichTextField.vue'
import IconTrash from '@/icons/IconTrash.vue'
import IconPencil from '@/icons/IconPencil.vue'
import IconArrowRight from '@/icons/IconArrowRight.vue'
import IconListCheck from '@/icons/IconListCheck.vue'
import IconNote from '@/icons/IconNote.vue'

const props = defineProps<{ item: VisionBoardItem; active: boolean }>()
const emit = defineEmits<{
  moveStart: [item: VisionBoardItem, e: PointerEvent]
  resizeStart: [item: VisionBoardItem, handle: ResizeHandle, e: PointerEvent]
}>()

/** Redimensionnable des quatre côtés et des quatre coins — pas seulement en
 *  l'étirant depuis un coin, pour pouvoir agrandir juste le côté qui manque
 *  de place. */
const RESIZE_HANDLES: { handle: ResizeHandle; position: string; cursor: string }[] = [
  { handle: 'n', position: 'inset-x-2 top-0 h-1.5', cursor: 'cursor-ns-resize' },
  { handle: 's', position: 'inset-x-2 bottom-0 h-1.5', cursor: 'cursor-ns-resize' },
  { handle: 'e', position: 'inset-y-2 right-0 w-1.5', cursor: 'cursor-ew-resize' },
  { handle: 'w', position: 'inset-y-2 left-0 w-1.5', cursor: 'cursor-ew-resize' },
  { handle: 'nw', position: 'left-0 top-0 h-3 w-3', cursor: 'cursor-nwse-resize' },
  { handle: 'ne', position: 'right-0 top-0 h-3 w-3', cursor: 'cursor-nesw-resize' },
  { handle: 'sw', position: 'left-0 bottom-0 h-3 w-3', cursor: 'cursor-nesw-resize' },
  { handle: 'se', position: 'right-0 bottom-0 h-3 w-3', cursor: 'cursor-nwse-resize' },
]

const board = useVisionBoards()
const { getItem } = useStore()
const { openItemDetail } = useUiState()

const linkedItem = computed(() => (props.item.kind === 'link' ? getItem(props.item.itemId) : undefined))
/** Le titre vivant tant que la cible existe, sinon l'étiquette gardée à l'épinglage. */
const linkedTitle = computed(() => linkedItem.value?.title ?? props.item.itemTitle ?? '')
const linkedType = computed(() => linkedItem.value?.type ?? props.item.itemType)

/**
 * Toujours au premier plan au clic, sauf une section : elle reste en fond en
 * permanence (`zIndex: 0` posé à sa création), sans quoi la déplacer la
 * ferait passer devant les photos qu'elle est censée regrouper.
 */
function onBodyPointerDown(e: PointerEvent) {
  if (props.item.kind !== 'section') board.bringToFront(props.item)
  emit('moveStart', props.item, e)
}

function openLink() {
  if (linkedItem.value) openItemDetail(linkedItem.value)
}

/** Une carte pleine (image, note, lien) sur fond blanc ; une section reste une
 *  zone en pointillés — teintée si on lui a donné une couleur, transparente
 *  sinon — pour ne jamais cacher ce qu'elle regroupe. */
const cardClasses = computed(() => {
  if (props.item.kind === 'section') {
    const fill = props.item.color ? useFolderColor(props.item.color).bgSoft : 'bg-ink/[0.025]'
    return ['border-2 border-dashed border-ink/15', fill, props.active ? 'border-lavender-300' : '']
  }
  const shadow = props.active ? 'shadow-soft-lg' : 'shadow-soft'
  if (props.item.kind === 'color') return [useFolderColor(props.item.color!).bg, 'ring-1 ring-ink/[0.08]', shadow]
  return ['bg-white ring-1 ring-ink/[0.08]', shadow]
})

/* --------------------------------------------------- Couleur (section) --- */

const SECTION_COLOR_OPTIONS: FolderColor[] = ['lavender', 'blue', 'green', 'pink', 'beige', 'peach']

/**
 * Téléportée et positionnée en fixe, comme le menu de `TimeBlockCard` : la
 * carte rogne ce qui dépasse (`overflow-hidden`), un menu posé dedans serait
 * coupé net dès qu'il dépasse d'une petite section.
 */
const colorMenu = ref<{ x: number; y: number } | null>(null)

function openColorMenu(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  colorMenu.value = { x: rect.right, y: rect.bottom + 6 }
}
function closeColorMenu() {
  colorMenu.value = null
}
function setColor(color: FolderColor | null) {
  closeColorMenu()
  board.updateItem(props.item.id, { color })
}

onMounted(() => {
  document.addEventListener('mousedown', closeColorMenu)
  window.addEventListener('scroll', closeColorMenu, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', closeColorMenu)
  window.removeEventListener('scroll', closeColorMenu, true)
})

/* ------------------------------------------------------- Note / section --- */

const editing = ref(false)
const draftText = ref('')
const fieldRef = ref<InstanceType<typeof RichTextField>>()
const sectionInputRef = ref<HTMLInputElement>()

function startEdit() {
  draftText.value = props.item.text ?? ''
  editing.value = true
  void nextTick(() => (fieldRef.value?.focus() ?? sectionInputRef.value?.focus()))
}

function commitEdit() {
  if (!editing.value) return
  editing.value = false
  if (draftText.value !== (props.item.text ?? '')) board.updateItem(props.item.id, { text: draftText.value })
}
</script>

<template>
  <div
    class="group/vb absolute flex h-full w-full flex-col overflow-hidden rounded-xl select-none"
    :class="cardClasses"
    :style="{ cursor: editing ? 'default' : active ? 'grabbing' : 'grab' }"
    @pointerdown="onBodyPointerDown"
  >
    <!-- Image --------------------------------------------------------- -->
    <!-- `object-contain`, jamais `object-cover` : une photo Pinterest est
         souvent portrait, une carte de départ presque carrée — la recadrer
         pour remplir la carte en couperait le haut ou le bas. Redimensionner
         la carte à la main reste possible, ça ne fait qu'ajouter des bandes. -->
    <img v-if="item.kind === 'image'" :src="item.imageUrl!" alt="" class="h-full w-full object-contain" draggable="false" />

    <!-- Note ------------------------------------------------------------ -->
    <template v-else-if="item.kind === 'note'">
      <div v-if="editing" class="h-full p-1" @pointerdown.stop @focusout="commitEdit">
        <RichTextField ref="fieldRef" v-model="draftText" placeholder="Écris ta note…" :rows="3" />
      </div>
      <div v-else class="h-full overflow-hidden p-2.5 text-[12.5px]" :class="useFolderColor(item.color ?? 'beige').bg">
        <RichText v-if="item.text" :text="item.text" />
        <p v-else class="text-ink-faint">Note vide</p>
      </div>
    </template>

    <!-- Carte-lien -------------------------------------------------------- -->
    <div v-else-if="item.kind === 'link'" class="flex h-full flex-col justify-center gap-1.5 bg-white p-3">
      <component
        :is="linkedType === 'note' ? IconNote : IconListCheck"
        class="h-4 w-4 shrink-0"
        :class="linkedItem ? 'text-lavender-500' : 'text-ink-faint'"
      />
      <p
        class="truncate text-[12.5px] font-medium"
        :class="!linkedItem ? 'text-ink-faint italic' : linkedItem.status === 'done' ? 'text-ink-faint line-through' : 'text-ink'"
      >
        {{ linkedTitle || 'Sans titre' }}
      </p>
      <p v-if="!linkedItem" class="text-[10.5px] text-ink-faint">Supprimé du nook</p>
    </div>

    <!-- Section — juste son titre, en haut à gauche de la zone. -->
    <div v-else-if="item.kind === 'section'" class="p-2">
      <div v-if="editing" class="w-fit" @pointerdown.stop @focusout="commitEdit">
        <input
          ref="sectionInputRef"
          v-model="draftText"
          type="text"
          maxlength="60"
          class="rounded-md bg-white px-2 py-1 text-[12.5px] font-semibold text-ink shadow-soft outline-none ring-2 ring-lavender-300"
          @keydown.enter.prevent="commitEdit"
          @keydown.esc.prevent="editing = false"
        />
      </div>
      <p v-else class="w-fit rounded-md px-1 text-[12.5px] font-semibold text-ink-soft">
        {{ item.text || 'Section sans titre' }}
      </p>
    </div>

    <!-- Pastille de couleur : rien de plus que le fond. -->

    <!-- Actions ------------------------------------------------------------ -->
    <div class="pointer-events-none absolute right-1 top-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/vb:opacity-100">
      <button
        v-if="item.kind === 'link' && linkedItem"
        type="button"
        title="Ouvrir"
        class="pointer-events-auto rounded-lg bg-white/90 p-1 text-ink-faint shadow-soft transition-colors hover:bg-lavender-100 hover:text-lavender-700 cursor-pointer"
        @pointerdown.stop
        @click.stop="openLink"
      >
        <IconArrowRight class="h-3 w-3" />
      </button>
      <button
        v-if="item.kind === 'section'"
        type="button"
        title="Couleur de fond"
        class="pointer-events-auto rounded-lg bg-white/90 p-1 shadow-soft transition-colors hover:bg-lavender-100 cursor-pointer"
        @pointerdown.stop
        @mousedown.stop
        @click.stop="openColorMenu"
      >
        <span
          class="block h-3 w-3 rounded-full ring-1 ring-ink/20"
          :class="item.color ? useFolderColor(item.color).bg : 'bg-transparent'"
        />
      </button>
      <button
        v-if="(item.kind === 'note' || item.kind === 'section') && !editing"
        type="button"
        title="Modifier"
        class="pointer-events-auto rounded-lg bg-white/90 p-1 text-ink-faint shadow-soft transition-colors hover:bg-lavender-100 hover:text-lavender-700 cursor-pointer"
        @pointerdown.stop
        @click.stop="startEdit"
      >
        <IconPencil class="h-3 w-3" />
      </button>
      <button
        type="button"
        title="Supprimer"
        class="pointer-events-auto rounded-lg bg-white/90 p-1 text-ink-faint shadow-soft transition-colors hover:bg-rose-50 hover:text-rose-500 cursor-pointer"
        @pointerdown.stop
        @click.stop="board.removeItem(item.id)"
      >
        <IconTrash class="h-3 w-3" />
      </button>
    </div>

    <!-- Poignées de redimensionnement, sur les quatre côtés et les quatre coins. -->
    <div
      v-for="h in RESIZE_HANDLES"
      :key="h.handle"
      class="absolute opacity-0 transition-opacity group-hover/vb:opacity-100"
      :class="[h.position, h.cursor]"
      @pointerdown.stop="emit('resizeStart', item, h.handle, $event)"
    />
  </div>

  <Teleport to="body">
    <Transition name="pop">
      <div
        v-if="colorMenu"
        class="fixed z-50 flex gap-1.5 rounded-xl bg-white p-2 shadow-soft-lg ring-1 ring-ink/[0.08]"
        :style="{ left: `${Math.max(8, colorMenu.x - 200)}px`, top: `${colorMenu.y}px` }"
        @mousedown.stop
        @pointerdown.stop
      >
        <button
          type="button"
          title="Aucune"
          class="h-6 w-6 rounded-full border-2 border-dashed border-ink/25 transition-transform hover:scale-110 cursor-pointer"
          @click="setColor(null)"
        />
        <button
          v-for="c in SECTION_COLOR_OPTIONS"
          :key="c"
          type="button"
          class="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer"
          :class="[useFolderColor(c).bg, item.color === c ? 'border-ink/30' : 'border-transparent']"
          @click="setColor(c)"
        />
      </div>
    </Transition>
  </Teleport>
</template>
