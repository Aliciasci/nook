<script setup lang="ts">
/**
 * Les champs d'une tâche ou d'une note — titre, description, dossier,
 * échéance, importance, liens.
 *
 * Extraits de `QuickCreateModal` pour qu'il n'existe qu'une seule définition
 * du formulaire : le modal s'en sert pour créer, le panneau de détail pour
 * modifier. Deux copies auraient divergé au premier champ ajouté.
 *
 * Le composant ne connaît ni bouton ni enregistrement : il expose des valeurs,
 * l'appelant décide quoi en faire et quand.
 */
import { nextTick, onMounted, ref } from 'vue'
import type { Item, ItemType, Priority } from '@/types'
import { useStore } from '@/store/useStore'
import LinkedItemsPanel from '@/components/common/LinkedItemsPanel.vue'
import RichTextField from '@/components/common/RichTextField.vue'
import type { LinkDraft } from '@/components/common/linkDraft'

const props = withDefaults(
  defineProps<{
    type: ItemType
    /** `null` pendant une création : les liens demandés partent en attente. */
    itemId?: string | null
    /** Donne le focus au titre à l'affichage. */
    autofocus?: boolean
  }>(),
  { itemId: null, autofocus: false },
)

const emit = defineEmits<{
  /** Un lien cliqué — à l'appelant d'aller ouvrir cet item. */
  open: [item: Item]
  /** Entrée dans le titre : l'appelant valide s'il le souhaite. */
  submit: []
}>()

const title = defineModel<string>('title', { required: true })
const content = defineModel<string>('content', { required: true })
const folderId = defineModel<string | null>('folderId', { required: true })
const priority = defineModel<Priority | null>('priority', { required: true })
const dueDate = defineModel<string>('dueDate', { required: true })
const draft = defineModel<LinkDraft>('draft', { required: true })

const { folders } = useStore()

const titleInput = ref<HTMLInputElement>()
onMounted(() => {
  if (props.autofocus) void nextTick(() => titleInput.value?.focus())
})

defineExpose({ focusTitle: () => titleInput.value?.focus() })

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Basse' },
  { value: 'medium', label: 'Normale' },
  { value: 'high', label: 'Haute' },
]
</script>

<template>
  <div>
    <input
      ref="titleInput"
      v-model="title"
      type="text"
      placeholder="Titre"
      class="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:border-lavender-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-lavender-100"
      @keydown.enter.prevent="emit('submit')"
    />

    <!-- La colonne `content` existe sur tout `Item` : une tâche a droit à sa
         description comme une note à son contenu. Même mise en forme que la
         documentation, sur les deux. -->
    <RichTextField
      v-model="content"
      class="mt-2"
      :rows="type === 'note' ? 5 : 3"
      :placeholder="type === 'task' ? 'Description (optionnel)' : 'Détails (optionnel)'"
    />

    <div class="mt-3 flex flex-wrap items-center gap-1.5">
      <select
        v-model="folderId"
        class="cursor-pointer rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[12.5px] text-ink-soft focus:outline-none focus:ring-2 focus:ring-lavender-100"
      >
        <option :value="null">Sans dossier</option>
        <option v-for="f in folders" :key="f.id" :value="f.id">{{ f.name }}</option>
      </select>

      <input
        v-if="type === 'task'"
        v-model="dueDate"
        type="date"
        class="cursor-pointer rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[12.5px] text-ink-soft focus:outline-none focus:ring-2 focus:ring-lavender-100"
      />
      <button
        v-if="type === 'task' && !dueDate"
        type="button"
        class="rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] text-ink-faint hover:border-lavender-300 hover:text-lavender-600 cursor-pointer"
        @click="dueDate = todayISO()"
      >
        Aujourd'hui
      </button>
    </div>

    <div v-if="type === 'task'" class="mt-2 flex gap-1.5">
      <button
        v-for="p in PRIORITIES"
        :key="p.value"
        type="button"
        class="rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors cursor-pointer"
        :class="
          priority === p.value
            ? 'border-lavender-300 bg-lavender-100 text-lavender-700'
            : 'border-line text-ink-faint hover:border-lavender-200'
        "
        @click="priority = priority === p.value ? null : p.value"
      >
        {{ p.label }}
      </button>
    </div>

    <div class="mt-4 border-t border-line pt-3">
      <LinkedItemsPanel
        v-model:draft="draft"
        :item-id="itemId"
        :item-type="type"
        @open="emit('open', $event)"
      />
    </div>
  </div>
</template>
