<script setup lang="ts">
// Corps d'une page : titre, icône, liste de blocs, et les liens entrants.
//
// Les blocs sont modifiés en place dans l'objet du store, puis `touchBlocks`
// programme la sauvegarde différée. Toutes les opérations clavier (Entrée qui
// scinde, Retour arrière qui fusionne, flèches qui changent de bloc) sont
// pilotées ici : la ligne de bloc se contente de les signaler.
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { DocBlock, DocBlockType, DocPage, DocPageFont } from '@/types'
import { useDocs } from '@/store/useDocs'
import { useToast } from '@/composables/useToast'
import { DOC_TEXT_COLORS, type DocTextColor, type InlineMark } from '@/utils/docs'
import DocBlockRow from './DocBlockRow.vue'
import DocVideoPanel from './DocVideoPanel.vue'
import IconLink from '@/icons/IconLink.vue'

const props = defineProps<{ page: DocPage }>()

const docs = useDocs()
const router = useRouter()
const toast = useToast()

const activeId = ref<string | null>(null)
const titleInput = ref<HTMLInputElement>()

type BlockRow = InstanceType<typeof DocBlockRow>
const rows = new Map<string, BlockRow>()

function setRow(id: string, el: unknown) {
  if (el) rows.set(id, el as BlockRow)
  else rows.delete(id)
}

function genId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `blk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const blocks = computed(() => props.page.blocks)

function touch() {
  docs.touchBlocks(props.page.id)
}

async function activate(id: string, caret: number | 'start' | 'end' = 'end') {
  activeId.value = id
  await nextTick()
  rows.get(id)?.focusAt(caret)
}

/* ------------------------------------------------ Barre d'outils --- */

const MARK_BUTTONS: { mark: InlineMark; label: string; title: string; class: string }[] = [
  { mark: 'bold', label: 'B', title: 'Gras (⌘B)', class: 'font-bold' },
  { mark: 'italic', label: 'I', title: 'Italique (⌘I)', class: 'italic font-serif' },
  { mark: 'underline', label: 'U', title: 'Souligné (⌘U)', class: 'underline' },
  { mark: 'strike', label: 'S', title: 'Barré', class: 'line-through' },
  { mark: 'code', label: '</>', title: 'Code (⌘E)', class: 'font-mono text-[11px]' },
]

const FONTS: { id: DocPageFont; label: string; title: string; class: string }[] = [
  { id: 'sans', label: 'Aa', title: 'Sans serif', class: 'font-sans' },
  { id: 'serif', label: 'Aa', title: 'Serif', class: 'font-display' },
  { id: 'mono', label: 'Aa', title: 'Monospace', class: 'font-mono' },
]

/** Un style ne s'applique qu'à un bloc en cours d'édition. */
const canFormat = computed(() => {
  if (!activeId.value) return false
  const block = blocks.value.find((b) => b.id === activeId.value)
  return Boolean(block) && block!.type !== 'code' && block!.type !== 'divider'
})

function applyMark(mark: InlineMark) {
  if (!activeId.value) return
  rows.get(activeId.value)?.applyMark(mark)
}

function applyLink() {
  if (!activeId.value) return
  rows.get(activeId.value)?.applyLink()
}

/* La palette reste ouverte tant qu'on colore : enchaîner deux teintes sur la
   même sélection est le geste courant. `mousedown.prevent` partout, sinon le
   bloc perdrait le focus et la sélection avec lui. */
const colorPickerOpen = ref(false)
const colorPickerRoot = ref<HTMLElement>()

function applyColor(color: DocTextColor | null) {
  if (!activeId.value) return
  rows.get(activeId.value)?.applyColor(color)
}

const saveLabel = computed(() => {
  if (docs.saveStatus.value === 'error') return 'Non enregistré'
  if (docs.saveStatus.value === 'saving') return 'Enregistrement…'
  return 'Enregistré'
})

/* ------------------------------------------------- Titre et icône --- */

// Rangées par famille : la liste est longue, et une grille d'un seul tenant
// obligerait à la parcourir en entier pour retrouver une icône.
const ICON_GROUPS: { label: string; icons: string[] }[] = [
  {
    label: 'Documents',
    icons: [
      '📄', '📃', '📑', '📘', '📗', '📙', '📕', '📓',
      '📔', '📒', '📚', '📖', '🗂️', '🗃️', '🗄️', '📋',
      '📝', '✏️', '🖊️', '🖍️', '📌', '📍', '🔖', '🏷️',
    ],
  },
  {
    label: 'Code et outils',
    icons: [
      '💻', '🖥️', '⌨️', '🖱️', '💾', '💿', '🖨️', '🔌',
      '🔋', '🧰', '🛠️', '🔧', '🔨', '⚙️', '🧪', '🧫',
      '🔬', '🔭', '🧲', '⚗️', '🪛', '🧱', '📡', '🛰️',
    ],
  },
  {
    label: 'Travail',
    icons: [
      '📈', '📉', '📊', '🗓️', '📅', '⏰', '⏱️', '⌛',
      '🕰️', '📎', '🖇️', '📁', '📂', '💼', '🗒️', '✅',
      '☑️', '🔒', '🔓', '🔑', '🗝️', '🚀', '🎯', '🏁',
    ],
  },
  {
    label: 'Symboles',
    icons: [
      '⭐', '🌟', '✨', '💡', '⚡', '🔥', '❄️', '💧',
      '♻️', '✔️', '❌', '❓', '❗', '⚠️', '🚧', '🔔',
      '💬', '💭', '🗯️', '➡️', '⬅️', '⬆️', '⬇️', '🔁',
      '🔀', '➕', '➖', '🔍', '🔎', '🧭', '🗺️', '🧩',
    ],
  },
  {
    label: 'Nature',
    icons: [
      '🌿', '🍀', '🌱', '🌳', '🌲', '🌴', '🌵', '🌾',
      '🍁', '🍂', '🌸', '🌼', '🌻', '🌷', '🌹', '💐',
      '🌊', '⛰️', '🌋', '🏔️', '🌙', '☀️', '☁️', '🌈',
    ],
  },
  {
    label: 'Animaux',
    icons: [
      '🐶', '🐱', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁',
      '🐮', '🐷', '🐸', '🐵', '🦉', '🦅', '🐧', '🐦',
      '🦆', '🐢', '🐍', '🐙', '🐬', '🐳', '🦋', '🐝',
    ],
  },
  {
    label: 'Nourriture',
    icons: [
      '☕', '🍵', '🧃', '🍺', '🍷', '🥐', '🍞', '🧀',
      '🍎', '🍌', '🍓', '🍇', '🍕', '🍔', '🍟', '🍣',
      '🍜', '🍫', '🍪', '🎂', '🍰', '🍯', '🥑', '🌮',
    ],
  },
  {
    label: 'Visages',
    icons: [
      '😀', '😄', '😉', '🙂', '😊', '😍', '🤩', '🤔',
      '🧐', '😴', '🥳', '😅', '😭', '😤', '🤯', '🫠',
      '👀', '👋', '👍', '👏', '🙏', '💪', '🧠', '🫶',
    ],
  },
  {
    label: 'Loisirs',
    icons: [
      '🎵', '🎶', '🎧', '🎤', '🎬', '🎮', '🕹️', '🎲',
      '🃏', '🎨', '🖌️', '📷', '📺', '📻', '🏀', '⚽',
      '🏓', '🎳', '🏆', '🥇', '🎁', '🎉', '🎈', '🪁',
    ],
  },
  {
    label: 'Lieux',
    icons: [
      '🏠', '🏡', '🏢', '🏫', '🏥', '🏰', '🗽', '🗼',
      '⛺', '🚗', '🚕', '🚌', '🚲', '🛴', '✈️', '🚂',
      '🛳️', '⛵', '🚦', '🛣️', '🌍', '🌎', '🌏', '🧳',
    ],
  },
]

const ALL_ICONS = ICON_GROUPS.flatMap((group) => group.icons)

const iconPickerOpen = ref(false)
const iconPickerRoot = ref<HTMLElement>()

/**
 * Tirage au sort. L'icône déjà posée est écartée du tirage : sans ça, un clic
 * sur deux ne changerait rien à l'écran et donnerait l'impression d'un bouton
 * cassé. La palette reste ouverte, pour pouvoir relancer.
 */
function chooseRandomIcon() {
  const pool = ALL_ICONS.filter((icon) => icon !== props.page.icon)
  const icon = pool[Math.floor(Math.random() * pool.length)]
  if (icon) docs.setIcon(props.page.id, icon)
}

function onDocumentMousedown(e: MouseEvent) {
  const target = e.target as Node
  if (iconPickerOpen.value && !iconPickerRoot.value?.contains(target)) iconPickerOpen.value = false
  if (colorPickerOpen.value && !colorPickerRoot.value?.contains(target)) colorPickerOpen.value = false
}
onMounted(() => window.addEventListener('mousedown', onDocumentMousedown))
onBeforeUnmount(() => window.removeEventListener('mousedown', onDocumentMousedown))

function chooseIcon(icon: string | null) {
  docs.setIcon(props.page.id, icon)
  iconPickerOpen.value = false
}

function onTitleInput(e: Event) {
  docs.renamePage(props.page.id, (e.target as HTMLInputElement).value)
}

function onTitleKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter' && e.key !== 'ArrowDown') return
  e.preventDefault()
  const first = blocks.value[0]
  if (first) void activate(first.id, 'start')
  else appendBlock()
}

/* ------------------------------------------------ Opérations blocs --- */

function newBlock(type: DocBlockType = 'paragraph', text = ''): DocBlock {
  return { id: genId(), type, text, ...(type === 'code' ? { language: 'text' } : {}) }
}

function appendBlock(type: DocBlockType = 'paragraph') {
  const block = newBlock(type)
  blocks.value.push(block)
  touch()
  void activate(block.id, 'start')
}

/** Clic dans le vide sous le dernier bloc. */
function onCanvasClick() {
  const last = blocks.value[blocks.value.length - 1]
  if (last && last.type !== 'divider' && last.text === '') {
    void activate(last.id, 'end')
    return
  }
  appendBlock()
}

function updateBlock(index: number, patch: Partial<DocBlock>) {
  const block = blocks.value[index]
  if (!block) return
  Object.assign(block, patch)
  // `language` n'a de sens que sur un bloc de code.
  if (patch.type && patch.type !== 'code') delete block.language
  // Un bloc de code a déjà son fond, un séparateur n'a pas de contenu à
  // colorer : dans les deux cas la clé disparaît plutôt que de traîner sans
  // effet et de resurgir à la transformation suivante. `undefined` la retire
  // aussi — c'est ainsi qu'on enlève un fond.
  if (!block.background || patch.type === 'code' || patch.type === 'divider') delete block.background
  touch()
}

function splitBlock(index: number, payload: { before: string; after: string }) {
  const block = blocks.value[index]
  if (!block) return
  block.text = payload.before
  // Une liste ou une citation se poursuit ; un titre retombe en paragraphe.
  const continues = block.type === 'bulleted' || block.type === 'numbered' || block.type === 'quote'
  const next = newBlock(continues ? block.type : 'paragraph', payload.after)
  blocks.value.splice(index + 1, 0, next)
  touch()
  void activate(next.id, 'start')
}

function mergeUp(index: number, text: string) {
  if (index === 0) return
  const previous = blocks.value[index - 1]
  if (!previous) return

  // Retour arrière juste après un séparateur : c'est lui qu'on supprime.
  if (previous.type === 'divider') {
    blocks.value.splice(index - 1, 1)
    touch()
    return
  }

  const caret = previous.text.length
  previous.text += text
  blocks.value.splice(index, 1)
  touch()
  void activate(previous.id, caret)
}

function insertAfter(index: number, type: DocBlockType) {
  const block = newBlock(type)
  blocks.value.splice(index + 1, 0, block)
  touch()
  void activate(block.id, 'start')
}

function removeBlock(index: number) {
  const [removed] = blocks.value.splice(index, 1)
  if (!removed) return
  touch()
  const target = blocks.value[index - 1] ?? blocks.value[index]
  if (target) void activate(target.id, 'end')
}

function navigate(index: number, dir: 'up' | 'down') {
  const step = dir === 'up' ? -1 : 1
  for (let i = index + step; i >= 0 && i < blocks.value.length; i += step) {
    const candidate = blocks.value[i]
    if (candidate.type === 'divider') continue
    void activate(candidate.id, dir === 'up' ? 'end' : 'start')
    return
  }
  if (dir === 'up') titleInput.value?.focus()
}

/**
 * Marge haute de chaque bloc. Un titre a besoin d'air au-dessus, les éléments
 * d'une même liste doivent rester groupés — et le premier bloc ne décolle pas
 * du titre de la page.
 */
const SPACING: Record<DocBlockType, string> = {
  heading1: 'mt-7',
  heading2: 'mt-6',
  heading3: 'mt-5',
  paragraph: 'mt-2.5',
  code: 'mt-3',
  bulleted: 'mt-0.5',
  numbered: 'mt-0.5',
  quote: 'mt-3',
  callout: 'mt-3',
  divider: 'mt-2',
}

function spacingFor(index: number): string {
  if (index === 0) return ''
  const block = blocks.value[index]
  const previous = blocks.value[index - 1]
  // Deux éléments de même nature (deux puces, deux lignes de citation) se
  // suivent sans écart supplémentaire.
  if (previous && previous.type === block.type && (block.type === 'bulleted' || block.type === 'numbered')) {
    return 'mt-0.5'
  }
  return SPACING[block.type]
}

/** Numéro affiché par les blocs d'une liste numérotée qui se suivent. */
const ordinals = computed(() => {
  let counter = 0
  return blocks.value.map((block) => {
    if (block.type !== 'numbered') {
      counter = 0
      return 0
    }
    counter += 1
    return counter
  })
})

/* ----------------------------------------------------- Liens wiki --- */

function openWiki(title: string) {
  const target = docs.findByTitle(title)
  if (target) {
    void router.push(`/docs/${target.id}`)
    return
  }
  const created = docs.createPage({ title, parentId: props.page.id })
  toast.push(`Page « ${created.title} » créée.`)
  void router.push(`/docs/${created.id}`)
}

const backlinks = computed(() => docs.backlinksTo(props.page.id))

/* ------------------------------------------- Déplacement des blocs --- */

const dragIndex = ref<number | null>(null)
const dropIndex = ref<number | null>(null)

function onDragStart(index: number, e: DragEvent) {
  dragIndex.value = index
  // Firefox n'amorce pas un glisser sans données attachées.
  e.dataTransfer?.setData('text/plain', blocks.value[index]?.id ?? '')
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(index: number, e: DragEvent) {
  if (dragIndex.value === null) return
  e.preventDefault()
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  dropIndex.value = e.clientY < rect.top + rect.height / 2 ? index : index + 1
}

function onDrop() {
  const from = dragIndex.value
  let to = dropIndex.value
  dragIndex.value = null
  dropIndex.value = null
  if (from === null || to === null) return
  if (to > from) to -= 1
  if (to === from) return
  const [moved] = blocks.value.splice(from, 1)
  blocks.value.splice(to, 0, moved)
  touch()
}

function onDragEnd() {
  dragIndex.value = null
  dropIndex.value = null
}
</script>

<template>
  <div class="pb-2" :data-doc-font="page.font">
    <!-- Barre d'outils -->
    <div class="mb-4 flex flex-wrap items-center gap-1 border-b border-line pb-3">
      <button
        v-for="btn in MARK_BUTTONS"
        :key="btn.mark"
        type="button"
        :title="btn.title"
        :aria-label="btn.title"
        :disabled="!canFormat"
        class="flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-[13px] text-ink-soft transition-colors hover:bg-lavender-50 hover:text-ink disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-ink-soft cursor-pointer"
        :class="btn.class"
        @mousedown.prevent="applyMark(btn.mark)"
      >
        {{ btn.label }}
      </button>
      <button
        type="button"
        title="Lien (⌘K)"
        aria-label="Lien"
        :disabled="!canFormat"
        class="flex h-7 w-7 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-lavender-50 hover:text-ink disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-ink-soft cursor-pointer"
        @mousedown.prevent="applyLink"
      >
        <IconLink class="h-3.5 w-3.5" />
      </button>

      <!-- Couleur du texte -->
      <div ref="colorPickerRoot" class="relative">
        <button
          type="button"
          title="Couleur du texte"
          aria-label="Couleur du texte"
          :aria-expanded="colorPickerOpen"
          :disabled="!canFormat"
          class="flex h-7 w-7 flex-col items-center justify-center gap-[3px] rounded-lg text-ink-soft transition-colors hover:bg-lavender-50 hover:text-ink disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent cursor-pointer"
          :class="colorPickerOpen && canFormat ? 'bg-lavender-50 text-ink' : ''"
          @mousedown.prevent="colorPickerOpen = !colorPickerOpen"
        >
          <span class="text-[12.5px] font-semibold leading-none">A</span>
          <span class="doc-color-bar h-[3px] w-4 rounded-full" />
        </button>

        <Transition name="pop">
          <div
            v-if="colorPickerOpen && canFormat"
            class="absolute left-0 top-full z-30 mt-1 w-[152px] rounded-xl bg-white p-2 shadow-soft-lg ring-1 ring-ink/[0.08]"
          >
            <div class="grid grid-cols-3 gap-1">
              <button
                v-for="color in DOC_TEXT_COLORS"
                :key="color.id"
                type="button"
                :title="color.label"
                :aria-label="color.label"
                class="flex h-9 items-center justify-center rounded-lg text-[15px] font-semibold transition-colors hover:bg-lavender-50 cursor-pointer"
                :class="`doc-color-${color.id}`"
                @mousedown.prevent="applyColor(color.id)"
              >
                A
              </button>
            </div>
            <button
              type="button"
              class="mt-1.5 w-full rounded-lg px-2 py-1.5 text-left text-[12.5px] text-ink-faint transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
              @mousedown.prevent="applyColor(null)"
            >
              Retirer la couleur
            </button>
          </div>
        </Transition>
      </div>

      <div class="mx-1.5 h-4 w-px bg-line" />

      <!-- Police de la page -->
      <div class="flex items-center gap-0.5 rounded-lg bg-paper p-0.5">
        <button
          v-for="font in FONTS"
          :key="font.id"
          type="button"
          :title="`Police : ${font.title}`"
          :aria-label="`Police : ${font.title}`"
          class="h-6 rounded-md px-2 text-[12.5px] transition-colors cursor-pointer"
          :class="[
            font.class,
            page.font === font.id ? 'bg-white text-ink shadow-soft' : 'text-ink-faint hover:text-ink-soft',
          ]"
          @mousedown.prevent="docs.setFont(page.id, font.id)"
        >
          {{ font.label }}
        </button>
      </div>

      <span
        class="ml-auto text-[11.5px]"
        :class="docs.saveStatus.value === 'error' ? 'text-rose-500' : 'text-ink-faint'"
      >
        {{ saveLabel }}
      </span>
    </div>

    <!-- Icône + titre -->
    <div ref="iconPickerRoot" class="relative">
      <button
        type="button"
        class="rounded-xl px-2 py-1 text-[30px] leading-none transition-colors hover:bg-lavender-50 cursor-pointer"
        :title="page.icon ? 'Changer l’icône' : 'Ajouter une icône'"
        @click="iconPickerOpen = !iconPickerOpen"
      >
        <span v-if="page.icon">{{ page.icon }}</span>
        <span v-else class="text-[13px] font-medium text-ink-faint">+ Icône</span>
      </button>

      <Transition name="pop">
        <div
          v-if="iconPickerOpen"
          class="absolute left-0 top-full z-30 mt-1 w-[268px] rounded-xl bg-white p-2 shadow-soft-lg ring-1 ring-ink/[0.08]"
        >
          <div class="max-h-[292px] overflow-y-auto pr-0.5">
            <div v-for="group in ICON_GROUPS" :key="group.label" class="mb-1.5 last:mb-0">
              <p class="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                {{ group.label }}
              </p>
              <div class="grid grid-cols-8 gap-1">
                <button
                  v-for="icon in group.icons"
                  :key="icon"
                  type="button"
                  class="flex h-8 w-8 items-center justify-center rounded-lg text-[17px] transition-colors hover:bg-lavender-50 cursor-pointer"
                  :class="page.icon === icon ? 'bg-lavender-100 ring-2 ring-lavender-300' : ''"
                  @click="chooseIcon(icon)"
                >
                  {{ icon }}
                </button>
              </div>
            </div>
          </div>

          <div class="mt-1.5 flex items-center gap-1 border-t border-line pt-1.5">
            <button
              type="button"
              title="Tirer une icône au hasard"
              class="rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
              @click="chooseRandomIcon"
            >
              🎲 Au hasard
            </button>
            <button
              type="button"
              class="ml-auto rounded-lg px-2 py-1.5 text-[12.5px] text-ink-faint transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
              @click="chooseIcon(null)"
            >
              Retirer
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <input
      ref="titleInput"
      :value="page.title"
      placeholder="Sans titre"
      class="doc-text mt-1 w-full bg-transparent font-display text-[30px] font-medium tracking-tight text-ink placeholder:text-ink-faint/60 focus:outline-none"
      @input="onTitleInput"
      @keydown="onTitleKeydown"
    />

    <!-- Vidéos de la page -->
    <DocVideoPanel :page="page" />

    <!-- Blocs -->
    <div class="mt-5" @dragend="onDragEnd" @drop="onDrop">
      <div
        v-for="(block, index) in blocks"
        :id="`doc-block-${block.id}`"
        :key="block.id"
        class="relative scroll-mt-6"
        :class="[spacingFor(index), dragIndex === index ? 'opacity-40' : '']"
        @dragover="onDragOver(index, $event)"
      >
        <div
          v-if="dropIndex === index && dragIndex !== null"
          class="pointer-events-none absolute -top-px left-6 right-0 h-0.5 rounded-full bg-lavender-400"
        />
        <DocBlockRow
          :ref="(el) => setRow(block.id, el)"
          :block="block"
          :active="activeId === block.id"
          :ordinal="ordinals[index]"
          @update="updateBlock(index, $event)"
          @split="splitBlock(index, $event)"
          @merge-up="mergeUp(index, $event)"
          @insert-after="insertAfter(index, $event)"
          @remove="removeBlock(index)"
          @nav="navigate(index, $event)"
          @activate="activate(block.id, $event)"
          @blur="activeId === block.id && (activeId = null)"
          @wiki="openWiki"
          @dragstart="onDragStart(index, $event)"
          @dragend="onDragEnd"
        />
        <div
          v-if="dropIndex === index + 1 && dragIndex !== null"
          class="pointer-events-none absolute -bottom-px left-6 right-0 h-0.5 rounded-full bg-lavender-400"
        />
      </div>
    </div>

    <!-- Zone de clic pour continuer à écrire -->
    <div
      class="min-h-[140px] cursor-text"
      :class="blocks.length ? 'mt-1' : 'mt-3'"
      @click="onCanvasClick"
    >
      <p v-if="!blocks.length" class="pl-7 text-[14.5px] text-ink-faint/70">
        Clique ici pour commencer à écrire. Tape « / » pour insérer un titre, du code ou une liste.
      </p>
    </div>

    <!-- Liens entrants -->
    <div v-if="backlinks.length" class="mt-4 border-t border-line pt-5">
      <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        Pages qui pointent ici ({{ backlinks.length }})
      </p>
      <div class="mt-2 flex flex-wrap gap-2">
        <RouterLink
          v-for="link in backlinks"
          :key="link.id"
          :to="`/docs/${link.id}`"
          class="flex items-center gap-1.5 rounded-xl bg-white px-2.5 py-1.5 text-[13px] text-ink-soft shadow-soft ring-1 ring-ink/[0.08] transition-colors hover:text-ink cursor-pointer"
        >
          <span v-if="link.icon">{{ link.icon }}</span>
          {{ link.title }}
        </RouterLink>
      </div>
    </div>
  </div>
</template>
