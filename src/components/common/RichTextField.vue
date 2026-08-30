<script setup lang="ts">
/**
 * Champ de saisie multiligne avec la mise en forme de la documentation.
 *
 * Mêmes marqueurs, mêmes raccourcis, mêmes fonctions (`toggleMark`,
 * `insertLink`, `applyTextColor`) que les blocs de doc — le texte reste du
 * texte brut en base, et se rend partout ailleurs avec `RichText`.
 *
 * Pas de menu « / » ni de blocs : une note garde l'air d'une note.
 */
import { computed, ref, watch } from 'vue'
import {
  applyTextColor,
  insertLink,
  toggleMark,
  DOC_TEXT_COLORS,
  type DocTextColor,
  type InlineMark,
} from '@/utils/docs'
import IconLink from '@/icons/IconLink.vue'

withDefaults(
  defineProps<{
    placeholder?: string
    rows?: number
  }>(),
  { placeholder: '', rows: 4 },
)

const model = defineModel<string>({ required: true })

const el = ref<HTMLTextAreaElement>()
const focused = ref(false)
const colorOpen = ref(false)

defineExpose({ focus: () => el.value?.focus() })

const MARK_BUTTONS: { mark: InlineMark; label: string; title: string; class: string }[] = [
  { mark: 'bold', label: 'B', title: 'Gras (⌘B)', class: 'font-bold' },
  { mark: 'italic', label: 'I', title: 'Italique (⌘I)', class: 'italic font-serif' },
  { mark: 'underline', label: 'U', title: 'Souligné (⌘U)', class: 'underline' },
  { mark: 'strike', label: 'S', title: 'Barré', class: 'line-through' },
  { mark: 'code', label: '</>', title: 'Code (⌘E)', class: 'font-mono text-[11px]' },
]

/**
 * Repose la sélection après réécriture : `v-model` remplace la valeur, ce qui
 * renvoie le curseur à la fin si on ne le rattrape pas.
 */
function restore(start: number, end: number) {
  void Promise.resolve().then(() => {
    const node = el.value
    if (!node) return
    node.focus({ preventScroll: true })
    node.setSelectionRange(start, end)
  })
}

function applyMark(mark: InlineMark) {
  const node = el.value
  if (!node) return
  const r = toggleMark(node.value, node.selectionStart ?? 0, node.selectionEnd ?? 0, mark)
  model.value = r.text
  restore(r.selectionStart, r.selectionEnd)
}

function applyLink() {
  const node = el.value
  if (!node) return
  const r = insertLink(node.value, node.selectionStart ?? 0, node.selectionEnd ?? 0)
  model.value = r.text
  restore(r.selectionStart, r.selectionEnd)
}

/** `null` retire la couleur en place. */
function applyColor(color: DocTextColor | null) {
  const node = el.value
  if (!node) return
  const r = applyTextColor(node.value, node.selectionStart ?? 0, node.selectionEnd ?? 0, color)
  model.value = r.text
  restore(r.selectionStart, r.selectionEnd)
}

function onKeydown(e: KeyboardEvent) {
  if (!e.metaKey && !e.ctrlKey) return
  const shortcut: Record<string, InlineMark> = { b: 'bold', i: 'italic', u: 'underline', e: 'code' }
  const mark = shortcut[e.key.toLowerCase()]
  if (mark) {
    e.preventDefault()
    applyMark(mark)
    return
  }
  if (e.key.toLowerCase() === 'k') {
    // La recherche globale écoute ⌘K sur window : dans un champ, le raccourci
    // pose un lien, comme dans n'importe quel éditeur.
    e.preventDefault()
    e.stopPropagation()
    applyLink()
  }
}

// La barre ne sert que sur du texte : elle apparaît au focus et s'efface avec.
// Un délai laisse le temps au clic sur un bouton d'arriver — `mousedown.prevent`
// garde le focus, mais le survol de la palette de couleurs sort du textarea.
let blurTimer: number | undefined
function onBlur() {
  blurTimer = window.setTimeout(() => {
    focused.value = false
    colorOpen.value = false
  }, 120)
}
function onFocus() {
  window.clearTimeout(blurTimer)
  focused.value = true
}

watch(model, () => {
  const node = el.value
  if (!node) return
  node.style.height = 'auto'
  node.style.height = `${node.scrollHeight}px`
})

const showBar = computed(() => focused.value)
</script>

<template>
  <div class="rounded-xl border border-line bg-paper transition-colors focus-within:border-lavender-300 focus-within:bg-white">
    <!-- Barre d'outils — la même que la doc, réduite à la mise en forme du
         texte. Elle n'apparaît qu'à la saisie : au repos, le champ reste sobre. -->
    <Transition name="fade-slide">
      <div v-if="showBar" class="flex items-center gap-0.5 border-b border-line px-1.5 py-1">
        <button
          v-for="btn in MARK_BUTTONS"
          :key="btn.mark"
          type="button"
          :title="btn.title"
          class="flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-[13px] text-ink-soft transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
          :class="btn.class"
          @mousedown.prevent="applyMark(btn.mark)"
        >
          {{ btn.label }}
        </button>

        <button
          type="button"
          title="Lien (⌘K)"
          class="flex h-7 w-7 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
          @mousedown.prevent="applyLink"
        >
          <IconLink class="h-3.5 w-3.5" />
        </button>

        <div class="relative">
          <button
            type="button"
            title="Couleur du texte"
            class="flex h-7 w-7 items-center justify-center rounded-lg text-[13px] text-ink-soft transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
            :class="colorOpen ? 'bg-lavender-50 text-ink' : ''"
            @mousedown.prevent="colorOpen = !colorOpen"
          >
            A
          </button>

          <Transition name="pop">
            <div
              v-if="colorOpen"
              class="absolute left-0 top-[calc(100%+0.25rem)] z-30 flex items-center gap-1 rounded-xl bg-white p-1.5 shadow-soft-lg ring-1 ring-ink/[0.08]"
            >
              <!-- Un « A » teinté, comme dans la doc : `doc-color-*` porte une
                   couleur de texte, pas un fond. -->
              <button
                v-for="color in DOC_TEXT_COLORS"
                :key="color.id"
                type="button"
                :title="color.label"
                :aria-label="color.label"
                class="flex h-7 w-7 items-center justify-center rounded-lg text-[14px] font-semibold transition-colors hover:bg-lavender-50 cursor-pointer"
                :class="`doc-color-${color.id}`"
                @mousedown.prevent="applyColor(color.id)"
              >
                A
              </button>
              <span class="mx-0.5 h-5 w-px bg-line" />
              <button
                type="button"
                title="Retirer la couleur"
                aria-label="Retirer la couleur"
                class="flex h-7 w-7 items-center justify-center rounded-lg text-[13px] text-ink-faint transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
                @mousedown.prevent="applyColor(null)"
              >
                ⊘
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>

    <textarea
      ref="el"
      v-model="model"
      :rows="rows"
      :placeholder="placeholder"
      class="w-full resize-none bg-transparent px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none"
      @focus="onFocus"
      @blur="onBlur"
      @keydown="onKeydown"
    />
  </div>
</template>
