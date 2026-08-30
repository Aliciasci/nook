<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { Item, ItemType } from '@/types'
import { useStore } from '@/store/useStore'
import type { LinkDraft } from '@/components/common/linkDraft'
import { useFolderColor } from '@/composables/useFolderColor'
import IconLink from '@/icons/IconLink.vue'
import IconNote from '@/icons/IconNote.vue'
import IconListCheck from '@/icons/IconListCheck.vue'
import IconPlus from '@/icons/IconPlus.vue'
import IconX from '@/icons/IconX.vue'

const props = withDefaults(
  defineProps<{
    /** `null` pendant une création : le panneau met alors ses ajouts en attente. */
    itemId: string | null
    itemType: ItemType
    draft: LinkDraft
    /**
     * Les lignes mènent-elles quelque part ? Pendant une création, non : il n'y
     * a pas de destination qui ne fasse pas perdre la saisie en cours, et un
     * bouton qui ne fait rien vaut moins qu'un simple libellé.
     */
    navigable?: boolean
  }>(),
  { navigable: true },
)

const emit = defineEmits<{
  'update:draft': [draft: LinkDraft]
  /** Un lien cliqué : au modal d'aller ouvrir cet item. */
  open: [item: Item]
}>()

const { items, getItem, getFolder, linkedItems, linkItems, unlinkItems, addLinkedNote } = useStore()

type Mode = 'idle' | 'note' | 'pick'
const mode = ref<Mode>('idle')
const noteTitle = ref('')
const query = ref('')
const noteInput = ref<HTMLInputElement>()
const queryInput = ref<HTMLInputElement>()

/** Le modal peut basculer d'un item à l'autre sans se fermer. */
watch(
  () => props.itemId,
  () => {
    mode.value = 'idle'
    noteTitle.value = ''
    query.value = ''
  },
)

interface Row {
  key: string
  type: ItemType
  title: string
  /** Vrai pour une note pas encore créée — elle le sera avec l'item porteur. */
  pending: boolean
  item: Item | null
  remove: () => void
}

const rows = computed<Row[]>(() => {
  if (props.itemId) {
    const id = props.itemId
    return linkedItems(id).map((item) => ({
      key: item.id,
      type: item.type,
      title: item.title,
      pending: false,
      item,
      remove: () => unlinkItems(id, item.id),
    }))
  }

  const existing: Row[] = props.draft.linkIds.flatMap((linkId) => {
    const item = getItem(linkId)
    if (!item) return []
    return [
      {
        key: linkId,
        type: item.type,
        title: item.title,
        pending: false,
        item: null,
        remove: () => patchDraft({ linkIds: props.draft.linkIds.filter((x) => x !== linkId) }),
      },
    ]
  })

  const created: Row[] = props.draft.newNoteTitles.map((title, index) => ({
    key: `new-${index}`,
    type: 'note' as const,
    title,
    pending: true,
    item: null,
    remove: () =>
      patchDraft({ newNoteTitles: props.draft.newNoteTitles.filter((_, i) => i !== index) }),
  }))

  return [...created, ...existing]
})

function patchDraft(patch: Partial<LinkDraft>) {
  emit('update:draft', { ...props.draft, ...patch })
}

/**
 * Ce qu'on peut lier : tout sauf l'item lui-même et ce qui l'est déjà. Sans
 * recherche, l'autre type passe devant — d'une tâche, c'est une note qu'on
 * vient chercher.
 */
const candidates = computed(() => {
  const q = query.value.trim().toLowerCase()
  const excluded = new Set<string>(props.itemId ? [props.itemId] : [])
  for (const row of rows.value) excluded.add(row.item?.id ?? row.key)

  const preferred: ItemType = props.itemType === 'task' ? 'note' : 'task'
  return items.value
    .filter((it) => !excluded.has(it.id) && (!q || it.title.toLowerCase().includes(q)))
    .sort((a, b) => (a.type === b.type ? 0 : a.type === preferred ? -1 : 1))
    .slice(0, 8)
})

function openMode(next: Mode) {
  mode.value = mode.value === next ? 'idle' : next
  if (mode.value === 'note') nextTick(() => noteInput.value?.focus())
  if (mode.value === 'pick') nextTick(() => queryInput.value?.focus())
}

function submitNote() {
  const title = noteTitle.value.trim()
  if (!title) return
  if (props.itemId) addLinkedNote(props.itemId, { title })
  else patchDraft({ newNoteTitles: [...props.draft.newNoteTitles, title] })
  noteTitle.value = ''
  // On reste dans le champ : une tâche a souvent plusieurs notes à poser.
  nextTick(() => noteInput.value?.focus())
}

function pick(item: Item) {
  if (props.itemId) linkItems(props.itemId, item.id)
  else patchDraft({ linkIds: [...props.draft.linkIds, item.id] })
  query.value = ''
  mode.value = 'idle'
}
</script>

<template>
  <div>
    <p class="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Liens</p>

    <ul v-if="rows.length" class="mt-1.5 flex flex-col gap-1">
      <li
        v-for="row in rows"
        :key="row.key"
        class="group flex items-center gap-2 rounded-xl border border-line bg-paper px-2.5 py-1.5"
      >
        <component
          :is="row.type === 'note' ? IconNote : IconListCheck"
          class="h-3.5 w-3.5 shrink-0 text-lavender-400"
        />
        <button
          v-if="row.item && navigable"
          type="button"
          class="min-w-0 flex-1 truncate text-left text-[12.5px] text-ink hover:text-lavender-600 cursor-pointer"
          :title="`Ouvrir « ${row.title} »`"
          @click="emit('open', row.item)"
        >
          {{ row.title }}
        </button>
        <span v-else class="min-w-0 flex-1 truncate text-[12.5px] text-ink" :title="row.title">
          {{ row.title }}
        </span>

        <span
          v-if="row.pending"
          class="shrink-0 rounded-full bg-lavender-50 px-1.5 py-0.5 text-[10.5px] font-medium text-lavender-600"
        >
          à créer
        </span>
        <span
          v-else-if="row.item && getFolder(row.item.folderId)"
          class="shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px] font-medium"
          :class="[
            useFolderColor(getFolder(row.item.folderId)!.color).bgSoft,
            useFolderColor(getFolder(row.item.folderId)!.color).ink,
          ]"
        >
          {{ getFolder(row.item.folderId)!.name }}
        </span>

        <button
          type="button"
          title="Retirer le lien"
          class="shrink-0 rounded-lg p-1 text-ink-faint opacity-0 transition-all hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 cursor-pointer"
          @click="row.remove()"
        >
          <IconX class="h-3.5 w-3.5" />
        </button>
      </li>
    </ul>

    <div class="mt-1.5 flex flex-wrap gap-1.5">
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors cursor-pointer"
        :class="
          mode === 'note'
            ? 'border-lavender-300 bg-lavender-100 text-lavender-700'
            : 'border-line text-ink-faint hover:border-lavender-200 hover:text-lavender-600'
        "
        @click="openMode('note')"
      >
        <IconPlus class="h-3.5 w-3.5" />
        Note liée
      </button>
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors cursor-pointer"
        :class="
          mode === 'pick'
            ? 'border-lavender-300 bg-lavender-100 text-lavender-700'
            : 'border-line text-ink-faint hover:border-lavender-200 hover:text-lavender-600'
        "
        @click="openMode('pick')"
      >
        <IconLink class="h-3.5 w-3.5" />
        Lier un élément
      </button>
    </div>

    <input
      v-if="mode === 'note'"
      ref="noteInput"
      v-model="noteTitle"
      type="text"
      placeholder="Titre de la note, puis Entrée"
      class="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-lavender-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-lavender-100"
      @keydown.enter.prevent="submitNote"
      @keydown.esc.prevent.stop="mode = 'idle'"
    />

    <div v-else-if="mode === 'pick'" class="mt-1.5">
      <input
        ref="queryInput"
        v-model="query"
        type="text"
        placeholder="Chercher une tâche ou une note…"
        class="w-full rounded-xl border border-line bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-lavender-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-lavender-100"
        @keydown.enter.prevent="candidates[0] && pick(candidates[0])"
        @keydown.esc.prevent.stop="mode = 'idle'"
      />
      <ul v-if="candidates.length" class="mt-1 max-h-44 overflow-y-auto rounded-xl border border-line bg-white p-1">
        <li v-for="c in candidates" :key="c.id">
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-lavender-50 cursor-pointer"
            @click="pick(c)"
          >
            <component
              :is="c.type === 'note' ? IconNote : IconListCheck"
              class="h-3.5 w-3.5 shrink-0 text-lavender-400"
            />
            <span class="min-w-0 flex-1 truncate text-[12.5px] text-ink">{{ c.title }}</span>
            <span
              v-if="getFolder(c.folderId)"
              class="shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px] font-medium"
              :class="[
                useFolderColor(getFolder(c.folderId)!.color).bgSoft,
                useFolderColor(getFolder(c.folderId)!.color).ink,
              ]"
            >
              {{ getFolder(c.folderId)!.name }}
            </span>
          </button>
        </li>
      </ul>
      <p v-else class="mt-1 px-1 text-[12px] text-ink-faint">Rien à lier ici.</p>
    </div>
  </div>
</template>
