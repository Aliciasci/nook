<script setup lang="ts">
// Un bloc d'une page de documentation.
//
// Deux états : au repos le texte est *rendu* (gras, code inline, liens), et
// dès qu'on clique dedans il redevient un textarea contenant le texte source.
// `formatInline` fournit la correspondance rendu → source qui permet de
// replacer le curseur exactement là où le clic a eu lieu.
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { DocBlock, DocBlockBackground, DocBlockType } from '@/types'
import {
  applyTextColor,
  escapeHtml,
  formatInline,
  insertLink,
  toggleMark,
  type DocTextColor,
  type InlineMark,
  type InlineRender,
} from '@/utils/docs'
import SlashMenu from './SlashMenu.vue'
import { CODE_LANGUAGES, SLASH_COMMANDS, type SlashCommand } from './slashCommands'

const props = defineProps<{
  block: DocBlock
  active: boolean
  /** Rang dans la liste numérotée en cours, 1-indexé. */
  ordinal: number
}>()

const emit = defineEmits<{
  update: [Partial<DocBlock>]
  split: [{ before: string; after: string }]
  mergeUp: [string]
  insertAfter: [DocBlockType]
  nav: [dir: 'up' | 'down']
  activate: [caret: number | 'end']
  blur: []
  remove: []
  wiki: [title: string]
  dragstart: [e: DragEvent]
  dragend: []
}>()

const rootEl = ref<HTMLElement>()
const renderedEl = ref<HTMLElement>()

// Le textarea est retrouvé par requête plutôt que par `ref` : changer de type
// de bloc fait basculer le `v-if` d'une branche à l'autre, ce qui remplace
// l'élément et invaliderait une référence directe au mauvais moment.
function textareaEl(): HTMLTextAreaElement | null {
  return rootEl.value?.querySelector('textarea') ?? null
}

/* ------------------------------------------------------------- Rendu --- */

const rendered = computed<InlineRender>(() => {
  if (props.block.type === 'code') {
    // Pas de formatage inline dans du code : le rendu est le texte source,
    // donc la correspondance est l'identité.
    const text = props.block.text
    return { html: escapeHtml(text), plain: text, map: Array.from({ length: text.length + 1 }, (_, i) => i) }
  }
  return formatInline(props.block.text)
})

const isEmpty = computed(() => props.block.text.trim() === '')

const PLACEHOLDERS: Partial<Record<DocBlockType, string>> = {
  heading1: 'Titre',
  heading2: 'Sous-titre',
  heading3: 'Titre de niveau 3',
  code: 'Colle ton code ici',
  bulleted: 'Élément de liste',
  numbered: 'Élément de liste',
  quote: 'Citation',
  callout: 'Note à mettre en avant',
}
const placeholder = computed(() => PLACEHOLDERS[props.block.type] ?? 'Écris, ou tape / pour insérer un bloc')

const TEXT_CLASS: Record<DocBlockType, string> = {
  heading1: 'font-display text-[23px] font-medium tracking-tight text-ink',
  heading2: 'font-display text-[18.5px] font-medium tracking-tight text-ink',
  heading3: 'text-[15.5px] font-semibold text-ink',
  paragraph: 'text-[14.5px] leading-[1.75] text-ink',
  code: 'font-mono text-[12.75px] leading-[1.6] text-paper',
  bulleted: 'text-[14.5px] leading-[1.75] text-ink',
  numbered: 'text-[14.5px] leading-[1.75] text-ink',
  quote: 'text-[14.5px] italic leading-[1.75] text-ink-soft',
  callout: 'text-[14px] leading-[1.7] text-ink',
  divider: '',
}
const textClass = computed(() => TEXT_CLASS[props.block.type])

const isListLike = computed(() => props.block.type === 'bulleted' || props.block.type === 'numbered')

/* -------------------------------------------------------- Textarea --- */

function resize() {
  const el = textareaEl()
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

async function focusAt(caret: number | 'start' | 'end') {
  await nextTick()
  const el = textareaEl()
  if (!el) return
  const pos = caret === 'end' ? el.value.length : caret === 'start' ? 0 : Math.min(Math.max(caret, 0), el.value.length)
  el.focus({ preventScroll: true })
  el.setSelectionRange(pos, pos)
  resize()
}

/** Repose la sélection après avoir réécrit le texte du bloc. */
function restoreSelection(start: number, end: number) {
  void nextTick(() => {
    const el = textareaEl()
    if (!el) return
    el.focus({ preventScroll: true })
    el.setSelectionRange(start, end)
    resize()
  })
}

function applyMark(mark: InlineMark) {
  // Le contenu d'un bloc de code est littéral, un séparateur n'a pas de texte.
  if (props.block.type === 'code' || props.block.type === 'divider') return
  const el = textareaEl()
  if (!el) return
  const result = toggleMark(el.value, el.selectionStart ?? 0, el.selectionEnd ?? 0, mark)
  emit('update', { text: result.text })
  restoreSelection(result.selectionStart, result.selectionEnd)
}

function applyLink() {
  if (props.block.type === 'code' || props.block.type === 'divider') return
  const el = textareaEl()
  if (!el) return
  const result = insertLink(el.value, el.selectionStart ?? 0, el.selectionEnd ?? 0)
  emit('update', { text: result.text })
  restoreSelection(result.selectionStart, result.selectionEnd)
}

/** `null` retire la couleur en place. */
function applyColor(color: DocTextColor | null) {
  if (props.block.type === 'code' || props.block.type === 'divider') return
  const el = textareaEl()
  if (!el) return
  const result = applyTextColor(el.value, el.selectionStart ?? 0, el.selectionEnd ?? 0, color)
  emit('update', { text: result.text })
  restoreSelection(result.selectionStart, result.selectionEnd)
}

defineExpose({ focusAt, applyMark, applyLink, applyColor })

watch(
  () => [props.block.text, props.active] as const,
  () => nextTick(resize),
)

/* ---------------------------------------------- Transformer le bloc --- */

// Un séparateur n'a pas de texte : y transformer un bloc effacerait le sien.
// Il s'insère depuis le menu « / », il ne se transforme pas depuis ici.
const TURN_INTO = SLASH_COMMANDS.filter((cmd) => cmd.type !== 'divider')

const turnOpen = ref(false)
const gutterEl = ref<HTMLElement>()

/** Le texte est conservé tel quel : seul le type change. */
function turnInto(type: DocBlockType) {
  turnOpen.value = false
  if (type === props.block.type) return
  emit('update', {
    type,
    ...(type === 'code' && !props.block.language ? { language: 'text' } : {}),
  })
  // Le bloc vient d'être manipulé : on y remet le curseur, même s'il n'était
  // pas en cours d'édition. Changer de type remplace le textarea, donc c'est
  // le parent qui refait le focus une fois la nouvelle branche montée.
  emit('activate', 'end')
}

const BACKGROUNDS: { id: DocBlockBackground; label: string }[] = [
  { id: 'blue', label: 'Bleu' },
  { id: 'green', label: 'Vert' },
  { id: 'pink', label: 'Rose' },
  { id: 'beige', label: 'Beige' },
  { id: 'lavender', label: 'Lavande' },
  { id: 'peach', label: 'Pêche' },
]

// Un bloc de code a déjà son fond sombre, un séparateur n'a rien à colorer.
const canHaveBackground = computed(() => props.block.type !== 'code' && props.block.type !== 'divider')

/** `null` retire le fond. */
function setBackground(background: DocBlockBackground | null) {
  turnOpen.value = false
  emit('update', { background: background ?? undefined })
}

function onTurnOutside(e: MouseEvent) {
  if (!gutterEl.value?.contains(e.target as Node)) turnOpen.value = false
}

// Écouteur posé seulement pendant l'ouverture : il y a un composant par bloc.
watch(turnOpen, (open) => {
  if (open) window.addEventListener('mousedown', onTurnOutside)
  else window.removeEventListener('mousedown', onTurnOutside)
})

onBeforeUnmount(() => window.removeEventListener('mousedown', onTurnOutside))

/* ------------------------------------------------------ Menu « / » --- */

const slashOpen = ref(false)
const slashQuery = ref('')
const slashStart = ref(0)
const slashHighlight = ref(0)
const slashMenu = ref<InstanceType<typeof SlashMenu>>()

function refreshSlash(value: string, caret: number) {
  const before = value.slice(0, caret)
  const match = before.match(/(?:^|\s)\/([^\s/]*)$/)
  if (!match) {
    slashOpen.value = false
    return
  }
  slashOpen.value = true
  slashQuery.value = match[1]
  slashStart.value = caret - match[1].length - 1
  slashHighlight.value = 0
}

function applySlash(cmd: SlashCommand) {
  const el = textareaEl()
  const value = el?.value ?? props.block.text
  const caret = el?.selectionStart ?? value.length
  const text = value.slice(0, slashStart.value) + value.slice(caret)
  slashOpen.value = false

  if (cmd.type === 'divider') {
    emit('update', { type: 'divider', text: '' })
    emit('insertAfter', 'paragraph')
    return
  }
  emit('update', {
    type: cmd.type,
    text,
    ...(cmd.type === 'code' && !props.block.language ? { language: 'text' } : {}),
  })
  void focusAt(slashStart.value)
}

/* ------------------------------------------------- Raccourcis saisie --- */

const SHORTCUTS: { re: RegExp; type: DocBlockType }[] = [
  { re: /^# $/, type: 'heading1' },
  { re: /^## $/, type: 'heading2' },
  { re: /^### $/, type: 'heading3' },
  { re: /^[-*] $/, type: 'bulleted' },
  { re: /^1[.)] $/, type: 'numbered' },
  { re: /^> $/, type: 'quote' },
  { re: /^```$/, type: 'code' },
  { re: /^(---|\*\*\*)$/, type: 'divider' },
]

/** Convertit `## ` en début de bloc en un vrai titre. `true` = déjà traité. */
function applyShortcut(value: string, caret: number): boolean {
  if (props.block.type === 'code') return false
  const before = value.slice(0, caret)
  const shortcut = SHORTCUTS.find((s) => s.re.test(before))
  if (!shortcut) return false

  const rest = value.slice(caret)
  if (shortcut.type === 'divider') {
    emit('update', { type: 'divider', text: '' })
    emit('insertAfter', 'paragraph')
    return true
  }
  emit('update', {
    type: shortcut.type,
    text: rest,
    ...(shortcut.type === 'code' ? { language: props.block.language ?? 'text' } : {}),
  })
  void focusAt(0)
  return true
}

function onInput(e: Event) {
  const el = e.target as HTMLTextAreaElement
  const value = el.value
  const caret = el.selectionStart ?? value.length
  resize()
  if (applyShortcut(value, caret)) return
  emit('update', { text: value })
  refreshSlash(value, caret)
}

/* ------------------------------------------------------- Clavier --- */

function onKeydown(e: KeyboardEvent) {
  const el = e.target as HTMLTextAreaElement
  const { value } = el
  const start = el.selectionStart ?? 0
  const end = el.selectionEnd ?? 0

  if (slashOpen.value) {
    const results = slashMenu.value?.results ?? []
    if (e.key === 'ArrowDown' && results.length) {
      e.preventDefault()
      slashHighlight.value = (slashHighlight.value + 1) % results.length
      return
    }
    if (e.key === 'ArrowUp' && results.length) {
      e.preventDefault()
      slashHighlight.value = (slashHighlight.value - 1 + results.length) % results.length
      return
    }
    if ((e.key === 'Enter' || e.key === 'Tab') && results.length) {
      e.preventDefault()
      const cmd = results[slashHighlight.value]
      if (cmd) applySlash(cmd)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      slashOpen.value = false
      return
    }
  }

  if (e.metaKey || e.ctrlKey) {
    const shortcut: Record<string, InlineMark> = { b: 'bold', i: 'italic', u: 'underline', e: 'code' }
    const mark = shortcut[e.key.toLowerCase()]
    if (mark) {
      e.preventDefault()
      applyMark(mark)
      return
    }
    if (e.key.toLowerCase() === 'k') {
      // La recherche globale écoute ⌘K sur window : dans un bloc, le
      // raccourci sert à poser un lien, comme dans n'importe quel éditeur.
      e.preventDefault()
      e.stopPropagation()
      applyLink()
      return
    }
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    // Dans un bloc de code, Entrée saute une ligne ; ⌘/Ctrl+Entrée en sort.
    if (props.block.type === 'code' && !(e.metaKey || e.ctrlKey)) return
    e.preventDefault()
    if (isListLike.value && value.trim() === '') {
      emit('update', { type: 'paragraph' })
      return
    }
    emit('split', { before: value.slice(0, start), after: value.slice(end) })
    return
  }

  if (e.key === 'Backspace' && start === 0 && end === 0) {
    e.preventDefault()
    if (props.block.type !== 'paragraph') {
      emit('update', { type: 'paragraph' })
      void focusAt(0)
      return
    }
    emit('mergeUp', value)
    return
  }

  if (e.key === 'Tab' && props.block.type === 'code') {
    e.preventDefault()
    emit('update', { text: `${value.slice(0, start)}  ${value.slice(end)}` })
    void focusAt(start + 2)
    return
  }

  if (e.key === 'ArrowUp' && start === end && value.lastIndexOf('\n', start - 1) === -1) {
    e.preventDefault()
    emit('nav', 'up')
    return
  }
  if (e.key === 'ArrowDown' && start === end && value.indexOf('\n', start) === -1) {
    e.preventDefault()
    emit('nav', 'down')
    return
  }

  if (e.key === 'Escape') {
    el.blur()
  }
}

let blurTimer: number | undefined

function onBlur() {
  slashOpen.value = false
  // Changer le type d'un bloc remplace le textarea (les deux branches du
  // `v-if` sont des éléments différents) : le blur qui en découle ne veut pas
  // dire que le curseur a quitté le bloc. On tranche au tick suivant, une
  // fois le focus éventuellement rétabli sur le nouvel élément.
  window.clearTimeout(blurTimer)
  blurTimer = window.setTimeout(() => {
    if (rootEl.value?.contains(document.activeElement)) return
    emit('blur')
  })
}

onBeforeUnmount(() => window.clearTimeout(blurTimer))

/* ----------------------------------------- Clic dans le texte rendu --- */

// `caretPositionFromPoint` est typé par lib.dom ; `caretRangeFromPoint`, la
// variante WebKit/Blink, ne l'est pas.
type CaretDocument = Document & {
  caretRangeFromPoint?(x: number, y: number): Range | null
}

/** Position, dans le texte source, du caractère rendu sous le pointeur. */
function caretFromPoint(e: MouseEvent): number | 'end' {
  const root = renderedEl.value
  if (!root) return 'end'

  const doc = document as CaretDocument
  let node: Node | null = null
  let offset = 0
  if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(e.clientX, e.clientY)
    if (range) {
      node = range.startContainer
      offset = range.startOffset
    }
  } else if (typeof doc.caretPositionFromPoint === 'function') {
    const position = doc.caretPositionFromPoint(e.clientX, e.clientY)
    if (position) {
      node = position.offsetNode
      offset = position.offset
    }
  }
  if (!node || !root.contains(node)) return 'end'

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let plain = 0
  let current = walker.nextNode()
  while (current) {
    if (current === node) return rendered.value.map[plain + offset] ?? props.block.text.length
    plain += current.textContent?.length ?? 0
    current = walker.nextNode()
  }
  return 'end'
}

function onRenderedClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const wiki = target.closest<HTMLElement>('a[data-wiki]')
  if (wiki) {
    e.preventDefault()
    emit('wiki', wiki.dataset.wiki ?? '')
    return
  }
  // Un lien externe s'ouvre normalement ; une sélection en cours n'est pas
  // écrasée par un placement de curseur.
  if (target.closest('a[href]')) return
  if (window.getSelection()?.toString()) return
  emit('activate', caretFromPoint(e))
}

/* ---------------------------------------------------- Bloc de code --- */

const copied = ref(false)
let copyTimer: number | undefined

async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.block.text)
    copied.value = true
    window.clearTimeout(copyTimer)
    copyTimer = window.setTimeout(() => (copied.value = false), 1600)
  } catch {
    /* presse-papiers refusé : rien à faire de plus qu'ignorer */
  }
}
</script>

<template>
  <div ref="rootEl" class="group/block relative flex items-start gap-1">
    <!-- Gouttière : poignée de déplacement, et menu de transformation -->
    <div ref="gutterEl" class="relative flex w-6 shrink-0 justify-center pt-[5px]">
      <button
        type="button"
        draggable="true"
        title="Glisser pour déplacer ce bloc, cliquer pour le transformer ou le colorer"
        aria-label="Déplacer, transformer ou colorer ce bloc"
        aria-haspopup="menu"
        :aria-expanded="turnOpen"
        class="rounded-md px-1 py-0.5 text-ink-faint transition-opacity hover:bg-lavender-50 hover:text-ink-soft group-hover/block:opacity-100 cursor-grab active:cursor-grabbing"
        :class="turnOpen ? 'bg-lavender-50 text-ink-soft opacity-100' : 'opacity-0'"
        @click="turnOpen = !turnOpen"
        @dragstart="emit('dragstart', $event)"
        @dragend="emit('dragend')"
      >
        <svg viewBox="0 0 10 16" class="h-3.5 w-2.5" fill="currentColor" aria-hidden="true">
          <circle cx="2" cy="3" r="1.3" />
          <circle cx="8" cy="3" r="1.3" />
          <circle cx="2" cy="8" r="1.3" />
          <circle cx="8" cy="8" r="1.3" />
          <circle cx="2" cy="13" r="1.3" />
          <circle cx="8" cy="13" r="1.3" />
        </svg>
      </button>

      <Transition name="pop">
        <div
          v-if="turnOpen"
          role="menu"
          class="absolute left-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl bg-white p-1.5 shadow-soft-lg ring-1 ring-ink/[0.08]"
        >
          <p class="px-2 pb-1 pt-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
            Transformer en
          </p>
          <button
            v-for="cmd in TURN_INTO"
            :key="cmd.type"
            type="button"
            role="menuitem"
            class="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors cursor-pointer"
            :class="cmd.type === block.type ? 'bg-lavender-100' : 'hover:bg-lavender-50'"
            @mousedown.prevent="turnInto(cmd.type)"
          >
            <span
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-paper text-[10.5px] font-semibold text-ink-soft"
            >
              {{ cmd.glyph }}
            </span>
            <span class="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{{ cmd.label }}</span>
          </button>

          <div v-if="canHaveBackground" class="mt-1.5 border-t border-line pt-1.5">
            <p class="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
              Fond
            </p>
            <div class="flex items-center gap-1 px-1 pb-0.5">
              <button
                v-for="background in BACKGROUNDS"
                :key="background.id"
                type="button"
                role="menuitem"
                :title="background.label"
                :aria-label="`Fond ${background.label}`"
                class="h-6 w-6 rounded-md transition-transform hover:scale-110 cursor-pointer"
                :class="[
                  `doc-bg-${background.id}`,
                  block.background === background.id ? 'ring-2 ring-lavender-400' : 'ring-1 ring-ink/10',
                ]"
                @mousedown.prevent="setBackground(background.id)"
              />
              <button
                type="button"
                role="menuitem"
                title="Aucun fond"
                aria-label="Aucun fond"
                class="flex h-6 w-6 items-center justify-center rounded-md bg-paper text-[11px] leading-none text-ink-faint transition-transform hover:scale-110 cursor-pointer"
                :class="block.background ? 'ring-1 ring-ink/10' : 'ring-2 ring-lavender-400'"
                @mousedown.prevent="setBackground(null)"
              >
                ⊘
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Séparateur -->
    <div v-if="block.type === 'divider'" class="flex min-w-0 flex-1 items-center gap-2 py-2.5">
      <hr class="h-px flex-1 border-0 bg-line" />
      <button
        type="button"
        class="rounded-md px-1.5 py-0.5 text-[11px] text-ink-faint opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-500 group-hover/block:opacity-100 cursor-pointer"
        @click="emit('remove')"
      >
        Supprimer
      </button>
    </div>

    <!-- Bloc de code -->
    <div v-else-if="block.type === 'code'" class="relative min-w-0 flex-1 py-1">
      <div class="overflow-hidden rounded-xl bg-ink">
        <div class="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
          <select
            :value="block.language ?? 'text'"
            class="rounded-md bg-transparent py-0.5 pr-1 text-[11px] font-medium text-paper/60 focus:outline-none cursor-pointer"
            aria-label="Langage du bloc de code"
            @change="emit('update', { language: ($event.target as HTMLSelectElement).value })"
          >
            <option v-for="lang in CODE_LANGUAGES" :key="lang" :value="lang" class="text-ink">{{ lang }}</option>
          </select>
          <button
            type="button"
            class="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-paper/60 transition-colors hover:bg-white/10 hover:text-paper cursor-pointer"
            @click="copyCode"
          >
            {{ copied ? 'Copié' : 'Copier' }}
          </button>
        </div>
        <textarea
          v-if="active"
          :value="block.text"
          rows="1"
          spellcheck="false"
          :placeholder="placeholder"
          class="block w-full resize-none overflow-hidden bg-transparent px-3.5 py-3 placeholder:text-paper/30 focus:outline-none"
          :class="textClass"
          @input="onInput"
          @keydown="onKeydown"
          @blur="onBlur"
        />
        <pre
          v-else
          ref="renderedEl"
          class="cursor-text overflow-x-auto whitespace-pre px-3.5 py-3"
          :class="textClass"
          @click="onRenderedClick"
        ><span v-if="isEmpty" class="text-paper/30">{{ placeholder }}</span><span v-else v-html="rendered.html" /></pre>
      </div>
    </div>

    <!-- Tous les autres blocs -->
    <div v-else class="relative min-w-0 flex-1">
      <!-- Un encadré a déjà sa boîte ; les autres blocs en gagnent une dès
           qu'ils ont un fond, sinon la couleur collerait au texte. -->
      <div
        class="flex min-w-0 gap-2"
        :class="[
          {
            'border-l-2 border-lavender-200 pl-3': block.type === 'quote',
            'rounded-xl bg-lavender-50 px-3.5 py-2.5': block.type === 'callout',
            'rounded-xl px-3 py-2': Boolean(block.background) && block.type !== 'callout',
          },
          block.background ? `doc-bg-${block.background}` : '',
        ]"
      >
        <span v-if="block.type === 'callout'" class="select-none pt-0.5 text-[14px]" aria-hidden="true">💡</span>
        <span
          v-else-if="block.type === 'bulleted'"
          class="w-3 shrink-0 select-none py-0.5 text-center text-[14.5px] leading-[1.75] text-ink-faint"
          aria-hidden="true"
          >•</span
        >
        <span
          v-else-if="block.type === 'numbered'"
          class="w-4 shrink-0 select-none py-0.5 text-right text-[14.5px] leading-[1.75] text-ink-faint tabular-nums"
          aria-hidden="true"
          >{{ ordinal }}.</span
        >

        <textarea
          v-if="active"
          :value="block.text"
          rows="1"
          :placeholder="placeholder"
          class="doc-text block w-full resize-none overflow-hidden bg-transparent py-0.5 placeholder:text-ink-faint/70 focus:outline-none"
          :class="textClass"
          @input="onInput"
          @keydown="onKeydown"
          @blur="onBlur"
        />
        <div
          v-else
          ref="renderedEl"
          class="doc-rendered doc-text min-w-0 flex-1 cursor-text whitespace-pre-wrap break-words py-0.5"
          :class="textClass"
          @click="onRenderedClick"
        >
          <span v-if="isEmpty" class="text-ink-faint/70">{{ placeholder }}</span>
          <span v-else v-html="rendered.html" />
        </div>
      </div>

      <SlashMenu
        v-if="slashOpen && active"
        ref="slashMenu"
        :query="slashQuery"
        :highlighted="slashHighlight"
        @select="applySlash"
        @update:highlighted="slashHighlight = $event"
        @empty="slashOpen = false"
      />
    </div>
  </div>
</template>
