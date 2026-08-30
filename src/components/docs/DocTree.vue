<script setup lang="ts">
// Arborescence des pages.
//
// Rendue à plat plutôt qu'en composant récursif : `flatten` produit déjà les
// pages dans l'ordre d'affichage avec leur profondeur, ce qui garde l'état du
// menu et du renommage dans une seule instance.
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { DocPageNode } from '@/types'
import IconPlus from '@/icons/IconPlus.vue'
import IconMoreHorizontal from '@/icons/IconMoreHorizontal.vue'

const props = defineProps<{
  nodes: DocPageNode[]
  currentId: string | null
  expanded: Set<string>
}>()

const emit = defineEmits<{
  toggle: [id: string]
  select: [id: string]
  createChild: [parentId: string]
  rename: [payload: { id: string; title: string }]
  move: [id: string]
  export: [id: string]
  remove: [id: string]
  reorder: [payload: { id: string; delta: -1 | 1 }]
}>()

/** Pages visibles : on saute les descendants des nœuds repliés. */
const visible = computed(() => {
  const out: DocPageNode[] = []
  const walk = (nodes: DocPageNode[]) => {
    for (const node of nodes) {
      out.push(node)
      if (node.children.length && props.expanded.has(node.id)) walk(node.children)
    }
  }
  walk(props.nodes)
  return out
})

/* ------------------------------------------------------- Renommage --- */

const renamingId = ref<string | null>(null)
const renameInput = ref<HTMLInputElement | null>(null)

async function startRename(id: string, title: string) {
  renamingId.value = id
  await nextTick()
  renameInput.value?.focus()
  renameInput.value?.setSelectionRange(0, title.length)
}

function commitRename(id: string, value: string) {
  if (renamingId.value !== id) return
  renamingId.value = null
  const title = value.trim()
  if (title) emit('rename', { id, title })
}

/* ------------------------------------------------------------ Menu --- */

const menu = ref<{ node: DocPageNode; x: number; y: number } | null>(null)

function openMenu(node: DocPageNode, e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  menu.value = { node, x: rect.right, y: rect.bottom + 4 }
}

function closeMenu() {
  menu.value = null
}

function onWindowKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeMenu()
}

onMounted(() => {
  window.addEventListener('mousedown', closeMenu)
  window.addEventListener('resize', closeMenu)
  window.addEventListener('keydown', onWindowKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('mousedown', closeMenu)
  window.removeEventListener('resize', closeMenu)
  window.removeEventListener('keydown', onWindowKeydown)
})

type MenuAction = 'rename' | 'up' | 'down' | 'move' | 'export' | 'remove'

/** Le nœud est relu au moment du clic : le menu est fermé juste avant. */
function runAction(action: MenuAction) {
  const node = menu.value?.node
  closeMenu()
  if (!node) return
  switch (action) {
    case 'rename':
      void startRename(node.id, node.title)
      break
    case 'up':
      emit('reorder', { id: node.id, delta: -1 })
      break
    case 'down':
      emit('reorder', { id: node.id, delta: 1 })
      break
    case 'move':
      emit('move', node.id)
      break
    case 'export':
      emit('export', node.id)
      break
    case 'remove':
      emit('remove', node.id)
      break
  }
}

const menuStyle = computed(() => ({
  left: `${Math.max(8, (menu.value?.x ?? 0) - 208)}px`,
  top: `${menu.value?.y ?? 0}px`,
}))
</script>

<template>
  <div class="flex flex-col gap-0.5">
    <div
      v-for="node in visible"
      :key="node.id"
      class="group/row flex items-center gap-0.5 rounded-lg pr-0.5 transition-colors"
      :class="
        node.id === currentId ? 'bg-lavender-100 text-lavender-700' : 'text-ink-soft hover:bg-lavender-50 hover:text-ink'
      "
      :style="{ paddingLeft: `${node.depth * 12}px` }"
    >
      <button
        type="button"
        class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-faint transition-transform cursor-pointer"
        :class="[node.children.length ? 'hover:text-ink' : 'invisible', expanded.has(node.id) ? 'rotate-90' : '']"
        :aria-label="expanded.has(node.id) ? 'Replier' : 'Déplier'"
        @click.stop="emit('toggle', node.id)"
      >
        <svg viewBox="0 0 16 16" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="m6 3.5 5 4.5-5 4.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <input
        v-if="renamingId === node.id"
        :ref="(el) => (renameInput = el as HTMLInputElement | null)"
        :value="node.title"
        class="min-w-0 flex-1 rounded bg-white px-1.5 py-1 text-[13px] text-ink ring-1 ring-lavender-300 focus:outline-none"
        @keydown.enter.prevent="commitRename(node.id, ($event.target as HTMLInputElement).value)"
        @keydown.esc.prevent="renamingId = null"
        @blur="commitRename(node.id, ($event.target as HTMLInputElement).value)"
      />
      <button
        v-else
        type="button"
        class="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left text-[13px] font-medium cursor-pointer"
        @click="emit('select', node.id)"
        @dblclick="startRename(node.id, node.title)"
      >
        <span v-if="node.icon" class="shrink-0 text-[13px]">{{ node.icon }}</span>
        <span class="truncate">{{ node.title }}</span>
      </button>

      <button
        type="button"
        title="Nouvelle sous-page"
        aria-label="Nouvelle sous-page"
        class="shrink-0 rounded p-1 text-ink-faint opacity-0 transition-opacity hover:bg-white hover:text-ink group-hover/row:opacity-100 cursor-pointer"
        @click.stop="emit('createChild', node.id)"
      >
        <IconPlus class="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Actions"
        aria-label="Actions sur la page"
        class="shrink-0 rounded p-1 text-ink-faint opacity-0 transition-opacity hover:bg-white hover:text-ink group-hover/row:opacity-100 cursor-pointer"
        @click.stop="openMenu(node, $event)"
        @mousedown.stop
      >
        <IconMoreHorizontal class="h-3.5 w-3.5" />
      </button>
    </div>
  </div>

  <Teleport to="body">
    <Transition name="pop">
      <div
        v-if="menu"
        class="fixed z-50 w-52 rounded-xl bg-white p-1.5 shadow-soft-lg ring-1 ring-ink/[0.08]"
        :style="menuStyle"
        @mousedown.stop
      >
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink-soft transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
          @click="runAction('rename')"
        >
          Renommer
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink-soft transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
          @click="runAction('up')"
        >
          Monter
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink-soft transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
          @click="runAction('down')"
        >
          Descendre
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink-soft transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
          @click="runAction('move')"
        >
          Déplacer vers…
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink-soft transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
          @click="runAction('export')"
        >
          Exporter en .md
        </button>
        <div class="my-1 h-px bg-line" />
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-rose-500 transition-colors hover:bg-rose-50 cursor-pointer"
          @click="runAction('remove')"
        >
          Supprimer
        </button>
      </div>
    </Transition>
  </Teleport>
</template>
