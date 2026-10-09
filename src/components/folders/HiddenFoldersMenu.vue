<script setup lang="ts">
/**
 * Le bouton des dossiers masqués, au-dessus de la grille de l'accueil.
 *
 * Il ne s'affiche que s'il y a quelque chose derrière : un bouton « 0 masqué »
 * serait du décor permanent. Le panneau s'ouvre au survol, comme l'aperçu
 * d'une carte, *et* au clic — sans le clic il n'existerait pas au doigt, et un
 * dossier masqué depuis un téléphone serait introuvable.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from '@/store/useStore'
import { useHiddenFolders } from '@/composables/useHiddenFolders'
import { useFolderColor } from '@/composables/useFolderColor'
import IconChevronLeft from '@/icons/IconChevronLeft.vue'
import IconFolderPlus from '@/icons/IconFolderPlus.vue'

const { folders, folderStats } = useStore()
const { isHidden, hiddenCount, show, showAll } = useHiddenFolders()
const router = useRouter()

/** Dans l'ordre de la grille — c'est celui que l'œil connaît déjà. */
const hidden = computed(() => folders.value.filter((f) => isHidden(f.id)))

const open = ref(false)
/** Ouvert au clic : le panneau reste alors en place quand le pointeur sort. */
const pinned = ref(false)
const root = ref<HTMLElement>()

// Même délai que l'aperçu d'une carte : le panneau ne doit pas surgir quand le
// pointeur ne fait que traverser l'en-tête.
const OPEN_DELAY = 200
let timer: number | undefined

function onEnter() {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => (open.value = true), OPEN_DELAY)
}

function onLeave() {
  window.clearTimeout(timer)
  if (!pinned.value) open.value = false
}

function toggle() {
  window.clearTimeout(timer)
  if (open.value && pinned.value) {
    open.value = false
    pinned.value = false
    return
  }
  open.value = true
  pinned.value = true
}

function close() {
  window.clearTimeout(timer)
  open.value = false
  pinned.value = false
}

function openFolder(id: string) {
  close()
  router.push(`/folder/${id}`)
}

/**
 * Remettre le dernier dossier masqué referme le panneau : il n'aurait plus
 * rien à montrer, et le bouton lui-même disparaît.
 */
function restore(id: string) {
  show(id)
  if (!hidden.value.length) close()
}

function restoreAll() {
  showAll()
  close()
}

function onDocMouseDown(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) close()
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}
onMounted(() => {
  document.addEventListener('mousedown', onDocMouseDown)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocMouseDown)
  document.removeEventListener('keydown', onKeydown)
  window.clearTimeout(timer)
})

function statsLabel(id: string): string {
  const { tasks, notes } = folderStats(id)
  if (tasks && notes) return `${tasks} tâches · ${notes} notes`
  if (tasks) return `${tasks} tâche${tasks > 1 ? 's' : ''}`
  if (notes) return `${notes} note${notes > 1 ? 's' : ''}`
  return 'Vide'
}
</script>

<template>
  <div v-if="hiddenCount" ref="root" class="relative" @mouseenter="onEnter" @mouseleave="onLeave">
    <button
      type="button"
      class="flex items-center gap-1.5 rounded-xl border border-line bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-faint shadow-soft transition-colors hover:border-lavender-300 hover:text-lavender-600 cursor-pointer"
      :class="open ? 'border-lavender-300 text-lavender-600' : ''"
      :aria-expanded="open"
      @click="toggle"
    >
      {{ hiddenCount }} dossier{{ hiddenCount > 1 ? 's' : '' }} masqué{{ hiddenCount > 1 ? 's' : '' }}
      <IconChevronLeft class="h-3.5 w-3.5 transition-transform" :class="open ? 'rotate-90' : '-rotate-90'" />
    </button>

    <!-- Aucune gouttière entre le bouton et le panneau : le survol la traverserait
         et refermerait le panneau au moment d'aller le lire. -->
    <Transition name="pop">
      <div v-if="open" class="absolute right-0 top-full z-30 pt-2">
        <div class="w-72 max-w-[calc(100vw-2rem)] rounded-2xl bg-white p-1.5 shadow-soft-lg ring-1 ring-ink/[0.08]">
          <div
            v-for="folder in hidden"
            :key="folder.id"
            class="group/row flex items-center gap-1"
          >
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-lavender-50 cursor-pointer"
              @click="openFolder(folder.id)"
            >
              <span class="h-2 w-2 shrink-0 rounded-full" :class="useFolderColor(folder.color).solid" />
              <span class="shrink-0 text-[14px] leading-none">{{ folder.icon }}</span>
              <span class="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{{ folder.name }}</span>
              <span class="shrink-0 text-[11px] text-ink-faint">{{ statsLabel(folder.id) }}</span>
            </button>
            <button
              type="button"
              title="Remettre sur l'accueil"
              aria-label="Remettre sur l'accueil"
              class="shrink-0 rounded-lg p-1.5 text-ink-faint opacity-0 transition-all hover:bg-lavender-100 hover:text-lavender-700 group-hover/row:opacity-100 focus-visible:opacity-100 cursor-pointer"
              @click="restore(folder.id)"
            >
              <IconFolderPlus class="h-4 w-4" />
            </button>
          </div>

          <template v-if="hiddenCount > 1">
            <div class="my-1 h-px bg-line" />
            <button
              type="button"
              class="w-full rounded-xl px-3 py-2 text-left text-[12.5px] font-medium text-ink-soft hover:bg-lavender-50 cursor-pointer"
              @click="restoreAll"
            >
              Tout remettre sur l'accueil
            </button>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>
