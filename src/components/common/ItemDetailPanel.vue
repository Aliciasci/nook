<script setup lang="ts">
/**
 * Le détail d'une tâche ou d'une note, en lecture.
 *
 * Cliquer une note liée fait basculer le modal sur cette note — il ne se
 * referme jamais entre deux.
 *
 * « Modifier » bascule le contenu du modal en formulaire, au même endroit :
 * jamais deux calques empilés pour un seul item. C'est aussi pour ça
 * qu'Échap et le clic sur le fond passent par `requestClose`, qui ramène à la
 * lecture quand on édite au lieu de tout refermer d'un coup.
 */
import { computed, nextTick, ref, watch } from 'vue'
import type { Item, Priority } from '@/types'
import { useStore } from '@/store/useStore'
import { useUiState } from '@/composables/useUiState'
import { useFolderColor } from '@/composables/useFolderColor'
import { useFocusSession } from '@/composables/useFocusSession'
import Modal from '@/components/common/Modal.vue'
import Checkbox from '@/components/common/Checkbox.vue'
import ItemFormFields from '@/components/common/ItemFormFields.vue'
import RichText from '@/components/common/RichText.vue'
import { emptyLinkDraft, type LinkDraft } from '@/components/common/linkDraft'
import IconX from '@/icons/IconX.vue'
import IconPencil from '@/icons/IconPencil.vue'
import IconTarget from '@/icons/IconTarget.vue'
import IconNote from '@/icons/IconNote.vue'
import IconListCheck from '@/icons/IconListCheck.vue'
import IconCalendar from '@/icons/IconCalendar.vue'
import IconLink from '@/icons/IconLink.vue'

const { getItem, getFolder, linkedItems, toggleTaskDone, updateItem } = useStore()
const { state, closeItemDetail, setDetailEditing, openItemDetail } = useUiState()
const { openFocus } = useFocusSession()

/** Résolu depuis le store : un item supprimé referme le panneau de lui-même. */
const item = computed<Item | undefined>(() => getItem(state.detailItemId))
const isOpen = computed(() => Boolean(item.value))

const folder = computed(() => (item.value ? getFolder(item.value.folderId) : undefined))
const palette = computed(() => (folder.value ? useFolderColor(folder.value.color) : null))

const links = computed(() => (item.value ? linkedItems(item.value.id) : []))
const linkedNotes = computed(() => links.value.filter((i) => i.type === 'note'))
const linkedTasks = computed(() => links.value.filter((i) => i.type === 'task'))

const editing = computed(() => state.detailEditing && Boolean(item.value))

/* ------------------------------------------------------- Formulaire --- */

const form = ref({
  title: '',
  content: '',
  folderId: null as string | null,
  priority: null as Priority | null,
  dueDate: '',
})
const linkDraft = ref<LinkDraft>(emptyLinkDraft())
const fields = ref<InstanceType<typeof ItemFormFields>>()

/** Recopie l'item dans le formulaire — à l'entrée en édition, et si l'on
 *  bascule sur un autre item alors qu'on éditait déjà. */
watch(
  [() => state.detailEditing, () => state.detailItemId],
  ([isEditing]) => {
    if (!isEditing || !item.value) return
    form.value = {
      title: item.value.title,
      content: item.value.content ?? '',
      folderId: item.value.folderId,
      priority: item.value.priority ?? null,
      dueDate: item.value.dueDate ?? '',
    }
    linkDraft.value = emptyLinkDraft()
    void nextTick(() => fields.value?.focusTitle())
  },
  { immediate: true },
)

function save() {
  const value = form.value.title.trim()
  if (!value || !item.value) return
  const patch =
    item.value.type === 'task'
      ? {
          title: value,
          content: form.value.content.trim() || null,
          folderId: form.value.folderId,
          priority: form.value.priority,
          dueDate: form.value.dueDate || null,
        }
      : {
          title: value,
          content: form.value.content.trim() || null,
          folderId: form.value.folderId,
        }
  updateItem(item.value.id, patch)
  setDetailEditing(false)
}

function cancel() {
  setDetailEditing(false)
}

/** Les notes dépliées, par identifiant. Repliées par défaut. */
const expanded = ref(new Set<string>())

function toggleNote(id: string) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

// Changer d'item repart de zéro : les dépliages du précédent n'ont plus de sens.
watch(
  () => state.detailItemId,
  () => (expanded.value = new Set()),
)

/**
 * Échap, croix ou clic sur le fond. En formulaire, ça revient à la lecture
 * plutôt que de tout refermer : fermer d'un coup ferait disparaître la saisie
 * sans prévenir.
 */
function requestClose() {
  // Le modal de création peut être ouvert par-dessus (« + Nouvelle note » n'est
  // pas loin) : sa fermeture ne doit pas emporter celui-ci.
  if (state.quickCreateOpen) return
  if (editing.value) cancel()
  else closeItemDetail()
}

const PRIORITY_LABEL = { low: 'Basse', medium: 'Normale', high: 'Haute' } as const

const dueLabel = computed(() => {
  if (!item.value?.dueDate) return null
  const today = new Date().toISOString().slice(0, 10)
  const d = new Date(item.value.dueDate + 'T00:00:00')
  const label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return { label, isToday: item.value.dueDate === today, isPast: item.value.dueDate < today }
})

const createdLabel = computed(() =>
  item.value
    ? new Date(item.value.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '',
)

const statusLabel = computed(() => {
  if (!item.value || item.value.type !== 'task') return null
  if (item.value.status === 'done') return 'Terminée'
  return item.value.status === 'in_progress' ? 'En cours' : 'À faire'
})
</script>

<template>
  <!-- Fond blanc, comme tous les autres modals de l'app. Les blocs internes
       ne portent donc pas de remplissage — du blanc sur du blanc ne se verrait
       pas : ils se détachent par leur contour. La hauteur est bornée pour que
       le contenu défile à l'intérieur plutôt que de déborder de l'écran. -->
  <Modal :open="isOpen" size="lg" @close="requestClose">
    <div
      v-if="item"
      class="flex max-h-[84vh] flex-col overflow-hidden rounded-2xl bg-white shadow-soft-lg ring-1 ring-ink/5"
      role="dialog"
      aria-label="Détail de l'élément"
    >
      <!-- Entête -->
      <div class="flex items-start gap-3 px-5 pb-3 pt-4">
        <span
          class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          :class="palette ? [palette.bg, palette.ink] : 'bg-lavender-100 text-lavender-600'"
        >
          <component :is="item.type === 'note' ? IconNote : IconListCheck" class="h-4 w-4" />
        </span>
        <h2
          class="min-w-0 flex-1 font-display text-[17px] font-medium leading-snug tracking-tight"
          :class="editing ? 'text-ink-faint' : item.status === 'done' ? 'text-ink-faint line-through' : 'text-ink'"
        >
          {{ editing ? 'Modifier' : item.title }}
        </h2>
        <button
          type="button"
          title="Fermer"
          aria-label="Fermer"
          class="rounded-full p-1 text-ink-faint transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
          @click="requestClose"
        >
          <IconX class="h-4 w-4" />
        </button>
      </div>

      <!-- Formulaire — au même endroit que la lecture, jamais par-dessus. -->
      <form v-if="editing" class="flex-1 overflow-y-auto px-5 py-4" @submit.prevent="save">
        <ItemFormFields
          ref="fields"
          v-model:title="form.title"
          v-model:content="form.content"
          v-model:folder-id="form.folderId"
          v-model:priority="form.priority"
          v-model:due-date="form.dueDate"
          v-model:draft="linkDraft"
          :type="item.type"
          :item-id="item.id"
          @open="openItemDetail"
          @submit="save"
        />
      </form>

      <div v-else class="flex-1 overflow-y-auto px-5 pb-5 pt-1">
        <!-- Étiquettes -->
        <div class="flex flex-wrap items-center gap-1.5">
          <span
            v-if="folder"
            class="rounded-full px-2 py-0.5 text-[11.5px] font-medium"
            :class="[palette!.bgSoft, palette!.ink]"
          >
            {{ folder.icon }} {{ folder.name }}
          </span>
          <span v-else class="rounded-full bg-ink/[0.05] px-2 py-0.5 text-[11.5px] font-medium text-ink-faint">
            Inbox
          </span>

          <span
            v-if="statusLabel"
            class="rounded-full px-2 py-0.5 text-[11.5px] font-medium"
            :class="item.status === 'done' ? 'bg-green-50 text-green-700' : 'bg-ink/[0.05] text-ink-faint'"
          >
            {{ statusLabel }}
          </span>

          <span
            v-if="item.priority && item.type === 'task'"
            class="rounded-full px-2 py-0.5 text-[11.5px] font-medium"
            :class="item.priority === 'high' ? 'bg-rose-50 text-rose-500' : 'bg-ink/[0.05] text-ink-faint'"
          >
            Importance {{ PRIORITY_LABEL[item.priority].toLowerCase() }}
          </span>

          <span
            v-if="dueLabel"
            class="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium"
            :class="dueLabel.isPast ? 'bg-rose-50 text-rose-500' : dueLabel.isToday ? 'bg-lavender-100 text-lavender-700' : 'bg-ink/[0.05] text-ink-faint'"
          >
            <IconCalendar class="h-3 w-3" />
            {{ dueLabel.label }}
          </span>
        </div>

        <!-- Description — sur une carte, comme partout ailleurs dans l'app.
             Le texte posé à même le fond flottait sans attache. -->
        <section class="mt-5">
          <p class="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            {{ item.type === 'note' ? 'Contenu' : 'Description' }}
          </p>
          <div class="rounded-2xl p-4 ring-1 ring-ink/[0.08]">
            <RichText
              v-if="item.content?.trim()"
              :text="item.content"
              class="text-[13.5px] leading-relaxed text-ink-soft"
            />
            <p v-else class="text-[13px] leading-relaxed text-ink-faint">
              {{ item.type === 'note' ? 'Cette note est encore vide.' : "Cette tâche n'a pas de description." }}
              <button
                type="button"
                class="font-medium text-lavender-600 hover:underline cursor-pointer"
                @click="setDetailEditing(true)"
              >
                En écrire une&nbsp;?
              </button>
            </p>
          </div>
        </section>

        <!-- Notes liées : le cœur du panneau. Repliées, dépliables sur place. -->
        <section v-if="linkedNotes.length" class="mt-5">
          <p class="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            Notes liées ({{ linkedNotes.length }})
          </p>
          <ul class="flex flex-col gap-1.5">
            <li
              v-for="note in linkedNotes"
              :key="note.id"
              class="overflow-hidden rounded-2xl ring-1 ring-ink/[0.08]"
            >
              <button
                type="button"
                class="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-ink/[0.03] cursor-pointer"
                :aria-expanded="expanded.has(note.id)"
                @click="toggleNote(note.id)"
              >
                <svg
                  viewBox="0 0 20 20"
                  class="h-3 w-3 shrink-0 text-ink-faint transition-transform"
                  :class="expanded.has(note.id) ? 'rotate-90' : ''"
                  fill="none"
                >
                  <path d="m8 5 5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <span class="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{{ note.title }}</span>
              </button>

              <div v-if="expanded.has(note.id)" class="border-t border-line px-3 py-2.5">
                <RichText
                  v-if="note.content?.trim()"
                  :text="note.content"
                  class="text-[12.5px] leading-relaxed text-ink-soft"
                />
                <p v-else class="text-[12.5px] italic text-ink-faint">Cette note est vide.</p>

                <button
                  type="button"
                  class="mt-2.5 text-[11.5px] font-medium text-lavender-600 hover:underline cursor-pointer"
                  @click="openItemDetail(note)"
                >
                  Ouvrir cette note →
                </button>
              </div>
            </li>
          </ul>
        </section>

        <!-- Un lien n'est pas réservé aux notes : deux tâches qui vont
             ensemble se lient aussi. -->
        <section v-if="linkedTasks.length" class="mt-5">
          <p class="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            Tâches liées ({{ linkedTasks.length }})
          </p>
          <ul class="flex flex-col gap-1.5">
            <li
              v-for="task in linkedTasks"
              :key="task.id"
              class="flex items-center gap-2.5 rounded-2xl px-3.5 py-3 ring-1 ring-ink/[0.08]"
            >
              <Checkbox :model-value="task.status === 'done'" @update:model-value="toggleTaskDone(task.id)" />
              <button
                type="button"
                class="min-w-0 flex-1 truncate text-left text-[13px] transition-colors hover:text-lavender-600 cursor-pointer"
                :class="task.status === 'done' ? 'text-ink-faint line-through' : 'text-ink'"
                @click="openItemDetail(task)"
              >
                {{ task.title }}
              </button>
            </li>
          </ul>
        </section>

        <!-- Aucun lien : une invite posée, qui dit le geste le plus court
             plutôt que de constater un vide. -->
        <section v-if="!links.length" class="mt-5">
          <p class="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Liens</p>
          <div
            class="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ink/[0.14] px-4 py-6 text-center"
          >
            <span class="flex h-9 w-9 items-center justify-center rounded-full bg-lavender-100 text-lavender-500">
              <IconLink class="h-4 w-4" />
            </span>
            <p class="text-[12.5px] leading-relaxed text-ink-faint">
              Rien de lié pour l'instant.<br />
              Dépose une note sur cette {{ item.type === 'note' ? 'note' : 'tâche' }}, ou attache-la depuis
              <button
                type="button"
                class="font-medium text-lavender-600 hover:underline cursor-pointer"
                @click="setDetailEditing(true)"
              >
                Modifier
              </button>.
            </p>
          </div>
        </section>

        <p class="mt-6 px-0.5 text-[11.5px] text-ink-faint">
          {{ item.type === 'note' ? 'Note créée' : 'Tâche créée' }} le {{ createdLabel }}.
        </p>
      </div>

      <!-- Actions -->
      <div v-if="editing" class="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">
        <button
          type="button"
          class="rounded-xl px-3.5 py-2 text-[13px] font-medium text-ink-faint transition-colors hover:bg-lavender-50 cursor-pointer"
          @click="cancel"
        >
          Annuler
        </button>
        <button
          type="button"
          :disabled="!form.title.trim()"
          class="rounded-xl bg-lavender-500 px-4 py-2 text-[13px] font-medium text-white shadow-soft transition-colors hover:bg-lavender-600 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          @click="save"
        >
          Enregistrer
        </button>
      </div>

      <div v-else class="flex items-center gap-2 border-t border-line px-5 py-3.5">
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-xl bg-lavender-500 px-3.5 py-2 text-[13px] font-medium text-white shadow-soft transition-colors hover:bg-lavender-600 cursor-pointer"
          @click="setDetailEditing(true)"
        >
          <IconPencil class="h-3.5 w-3.5" />
          Modifier
        </button>

        <button
          v-if="item.type === 'task' && item.status !== 'done'"
          type="button"
          class="flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:border-lavender-300 hover:text-lavender-600 cursor-pointer"
          @click="openFocus(item)"
        >
          <IconTarget class="h-3.5 w-3.5" />
          Focus
        </button>

        <button
          v-if="item.type === 'task'"
          type="button"
          class="ml-auto rounded-xl px-3 py-2 text-[13px] font-medium text-ink-faint transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
          @click="toggleTaskDone(item.id)"
        >
          {{ item.status === 'done' ? 'Rouvrir' : 'Terminer' }}
        </button>
      </div>
    </div>
  </Modal>
</template>
