<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useStore } from '@/store/useStore'
import { useUiState } from '@/composables/useUiState'
import { useFolderColor } from '@/composables/useFolderColor'
import { useAuth } from '@/composables/useAuth'
import { useProfile } from '@/composables/useProfile'
import { usePanels } from '@/composables/usePanels'
import { useItemLinkDrag } from '@/composables/useItemLinkDrag'
import IconHome from '@/icons/IconHome.vue'
import IconInbox from '@/icons/IconInbox.vue'
import IconSun from '@/icons/IconSun.vue'
import IconListCheck from '@/icons/IconListCheck.vue'
import IconKanban from '@/icons/IconKanban.vue'
import IconVisionBoard from '@/icons/IconVisionBoard.vue'
import IconArchive from '@/icons/IconArchive.vue'
import IconArchiveBox from '@/icons/IconArchiveBox.vue'
import IconFolderPlus from '@/icons/IconFolderPlus.vue'
import IconSettings from '@/icons/IconSettings.vue'
import IconSprout from '@/icons/IconSprout.vue'
import IconReport from '@/icons/IconReport.vue'
import IconBook from '@/icons/IconBook.vue'
import IconTimeGrid from '@/icons/IconTimeGrid.vue'
import IconLogout from '@/icons/IconLogout.vue'
import IconPanelLeft from '@/icons/IconPanelLeft.vue'
import NookSwitcher from '@/components/nooks/NookSwitcher.vue'

const { folders, inboxItems, allOpenTasks, folderStats } = useStore()
const itemDrag = useItemLinkDrag()

/* --------------------------- Recevoir une tâche ou une note glissée --- */

/**
 * Les mêmes cibles que les cartes de l'accueil, mais présentes sur *toutes*
 * les pages : c'est ce qui permet de ranger une tâche depuis l'Inbox ou
 * « À faire », où aucune carte de dossier n'est affichée. Le menu liste aussi
 * les dossiers masqués de l'accueil — masquer n'est qu'un réglage de la
 * grille, pas une mise à l'écart du dossier.
 */
const dropFolderId = ref<string | null>(null)

function onFolderDragOver(folderId: string, e: DragEvent) {
  if (!itemDrag.acceptsFolder(folderId)) return
  // C'est le `preventDefault` du survol qui déclare la cible : sans lui, le
  // navigateur refuse le dépôt.
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dropFolderId.value = folderId
}

function onFolderDrop(folderId: string) {
  dropFolderId.value = null
  const folder = folders.value.find((f) => f.id === folderId)
  if (folder) itemDrag.dropOnFolder(folder.id, folder.name)
}
const { openQuickCreate } = useUiState()
const auth = useAuth()
const profile = useProfile()
const router = useRouter()
const route = useRoute()
const panels = usePanels()

// En tiroir mobile, le contenu reste toujours déplié — replier en bande
// d'icônes n'a de sens que pour gagner de la largeur sur un grand écran,
// pas dans un tiroir qui prend de toute façon toute la largeur voulue.
const collapsed = computed(() => panels.state.sidebar && !panels.state.mobileSidebar)

// Le tiroir mobile se referme dès qu'on navigue — sans ça, un lien suivi
// laisserait le menu ouvert par-dessus la page qu'on vient d'atteindre.
watch(
  () => route.fullPath,
  () => panels.closeMobileSidebar(),
)

const menuOpen = ref(false)
const menuRoot = ref<HTMLElement | null>(null)

function onDocClick(e: MouseEvent) {
  if (menuRoot.value && !menuRoot.value.contains(e.target as Node)) menuOpen.value = false
}
onMounted(() => window.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => window.removeEventListener('mousedown', onDocClick))

async function onLogout() {
  menuOpen.value = false
  await auth.logout()
  router.push('/login')
}

/**
 * Le menu par sections. « Mes dossiers », plus bas, en est la quatrième — d'où
 * les mêmes intitulés en capitales et le même trait de séparation en mode
 * icônes.
 *
 * L'accueil n'a pas d'intitulé : c'est le point d'entrée, pas une catégorie.
 */
interface NavItem {
  to: string
  label: string
  icon: Component
  /** Pastille de comptage, quand la vue en porte une. */
  countKey?: 'inbox' | 'todo'
}

interface NavSection {
  /** `null` = section sans intitulé. */
  label: string | null
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    label: null,
    items: [{ to: '/', label: 'Accueil', icon: IconHome }],
  },
  {
    label: 'Ma journée',
    items: [
      { to: '/today', label: "Aujourd'hui", icon: IconSun },
      { to: '/planning', label: 'Planning', icon: IconTimeGrid },
    ],
  },
  {
    label: 'Mes tâches',
    items: [
      { to: '/inbox', label: 'Inbox', icon: IconInbox, countKey: 'inbox' },
      { to: '/todo', label: 'À faire', icon: IconListCheck, countKey: 'todo' },
      { to: '/kanban', label: 'Kanban', icon: IconKanban },
      { to: '/done', label: 'Terminées', icon: IconArchive },
      { to: '/archive', label: 'Archive', icon: IconArchiveBox },
    ],
  },
  {
    label: 'Mon nook',
    items: [
      { to: '/docs', label: 'Documentation', icon: IconBook },
      { to: '/mon-espace', label: 'Mon espace', icon: IconSprout },
      { to: '/vision-board', label: 'Vision board', icon: IconVisionBoard },
      { to: '/rapport', label: 'Rapport', icon: IconReport },
    ],
  },
]

function navCount(key?: 'inbox' | 'todo') {
  if (key === 'inbox') return inboxItems.value.length
  if (key === 'todo') return allOpenTasks.value.length
  return undefined
}
</script>

<template>
  <!-- Sous `md`, le menu est un tiroir par-dessus le contenu plutôt qu'une
       colonne à côté : sur un écran de téléphone, une colonne fixe de 256px
       ne laisserait presque rien pour le reste. Au-dessus de `md`, ce
       fond n'existe pas et le tiroir n'est jamais fermé. -->
  <div
    v-if="panels.state.mobileSidebar"
    class="fixed inset-0 z-30 bg-ink/30 md:hidden"
    @click="panels.closeMobileSidebar()"
  />

  <aside
    class="fixed inset-y-0 left-0 z-40 flex h-screen w-72 shrink-0 flex-col border-r border-line bg-surface py-5 transition-transform duration-200 md:static md:z-auto md:w-auto md:translate-x-0 md:bg-surface/70 md:transition-[width]"
    :class="[
      panels.state.mobileSidebar ? 'translate-x-0' : '-translate-x-full',
      collapsed ? 'px-4 md:w-[68px] md:px-2.5' : 'px-4 md:w-64',
    ]"
  >
    <div class="flex items-center gap-2" :class="collapsed ? 'justify-center' : 'px-2'">
      <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-lavender-400 shadow-soft">
        <svg viewBox="0 0 20 20" class="h-4 w-4 text-white" fill="none">
          <path d="M3 8.4c0-1.6 1.3-2.9 2.9-2.9h3.1c.7 0 1.4.3 1.9.8l.9.9c.5.5 1.2.8 1.9.8h3.1c1.6 0 2.9 1.3 2.9 2.9v3.5c0 1.6-1.3 2.9-2.9 2.9H5.9C4.3 17.3 3 16 3 14.4V8.4Z" fill="currentColor" />
        </svg>
      </div>
      <span v-if="!collapsed" class="font-display text-lg font-medium tracking-tight text-ink">Nook</span>
      <button
        v-if="!collapsed"
        type="button"
        title="Réduire le menu"
        aria-label="Réduire le menu"
        class="ml-auto rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
        @click="panels.toggleSidebar()"
      >
        <IconPanelLeft class="h-[18px] w-[18px]" />
      </button>
    </div>

    <button
      v-if="collapsed"
      type="button"
      title="Afficher le menu"
      aria-label="Afficher le menu"
      class="mt-3 flex h-9 w-full items-center justify-center rounded-xl text-ink-faint transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
      @click="panels.toggleSidebar()"
    >
      <IconPanelLeft class="h-[18px] w-[18px]" />
    </button>

    <NookSwitcher :collapsed="collapsed" />

    <nav class="mt-5">
      <div v-for="(section, index) in navSections" :key="section.label ?? 'accueil'" :class="index ? 'mt-5' : ''">
        <p
          v-if="section.label && !collapsed"
          class="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint"
        >
          {{ section.label }}
        </p>
        <!-- En mode icônes, l'intitulé ne tient pas : un trait sépare les
             sections, comme au-dessus de « Mes dossiers ». -->
        <div v-else-if="section.label" class="mx-auto mb-2.5 h-px w-6 bg-line" />

        <div class="flex flex-col gap-0.5">
          <RouterLink
            v-for="item in section.items"
            :key="item.to"
            :to="item.to"
            :title="collapsed ? item.label : undefined"
            class="group flex items-center gap-2.5 rounded-xl py-2 text-[13.5px] font-medium text-ink-soft transition-colors hover:bg-lavender-50 hover:text-ink"
            :class="collapsed ? 'justify-center px-0' : 'px-3'"
            active-class="!bg-lavender-100 !text-lavender-700"
            :exact-active-class="item.to === '/' ? '!bg-lavender-100 !text-lavender-700' : ''"
          >
            <component :is="item.icon" class="h-[18px] w-[18px] shrink-0" />
            <span v-if="!collapsed" class="flex-1">{{ item.label }}</span>
            <span
              v-if="!collapsed && navCount(item.countKey)"
              class="rounded-full bg-ink/[0.06] px-1.5 py-0.5 text-[11px] font-semibold text-ink-faint group-[.router-link-active]:bg-lavender-500/15 group-[.router-link-active]:text-lavender-700"
            >
              {{ navCount(item.countKey) }}
            </span>
          </RouterLink>
        </div>
      </div>
    </nav>

    <div v-if="!collapsed" class="mt-7 flex items-center justify-between px-3">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Mes dossiers</span>
    </div>
    <div v-else class="mx-auto mt-6 h-px w-6 bg-line" />

    <nav class="mt-1.5 flex flex-1 flex-col gap-0.5 overflow-y-auto" :class="collapsed ? 'pt-1.5' : ''">
      <RouterLink
        v-for="folder in folders"
        :key="folder.id"
        :to="`/folder/${folder.id}`"
        :title="collapsed ? folder.name : undefined"
        class="flex items-center gap-2.5 rounded-xl py-2 text-[13.5px] font-medium text-ink-soft transition-colors hover:bg-lavender-50 hover:text-ink"
        :class="[
          collapsed ? 'justify-center px-0' : 'px-3',
          dropFolderId === folder.id ? '!bg-lavender-100 !text-lavender-700 ring-2 ring-lavender-400' : '',
        ]"
        active-class="!bg-lavender-100 !text-lavender-700"
        @dragover="onFolderDragOver(folder.id, $event)"
        @dragleave="dropFolderId = null"
        @drop.prevent.stop="onFolderDrop(folder.id)"
      >
        <!-- Replié, l'émoji du dossier identifie mieux qu'une pastille de
             couleur ; on garde la pastille pour les dossiers sans icône. -->
        <span v-if="collapsed && folder.icon" class="text-[15px] leading-none">{{ folder.icon }}</span>
        <span v-else class="h-2.5 w-2.5 shrink-0 rounded-full" :class="useFolderColor(folder.color).solid" />
        <template v-if="!collapsed">
          <span class="flex-1 truncate">{{ folder.name }}</span>
          <span class="text-[11px] font-medium text-ink-faint">
            {{ folderStats(folder.id).tasks + folderStats(folder.id).notes }}
          </span>
        </template>
      </RouterLink>

      <button
        type="button"
        :title="collapsed ? 'Nouveau dossier' : undefined"
        class="mt-1 flex items-center gap-2.5 rounded-xl py-2 text-[13.5px] font-medium text-ink-faint transition-colors hover:bg-lavender-50 hover:text-lavender-600 cursor-pointer"
        :class="collapsed ? 'justify-center px-0' : 'px-3'"
        @click="openQuickCreate('folder')"
      >
        <IconFolderPlus class="h-[18px] w-[18px] shrink-0" />
        <span v-if="!collapsed">Nouveau dossier</span>
      </button>
    </nav>

    <div ref="menuRoot" class="relative mt-3">
      <Transition name="pop">
        <div
          v-if="menuOpen"
          class="absolute bottom-[calc(100%+0.375rem)] left-0 rounded-xl bg-white p-1.5 shadow-soft-lg ring-1 ring-ink/[0.08]"
          :class="collapsed ? 'w-48' : 'w-full'"
        >
          <RouterLink
            to="/settings"
            class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:bg-lavender-50 hover:text-ink"
            @click="menuOpen = false"
          >
            <IconSettings class="h-4 w-4 shrink-0" />
            <span>Paramètres</span>
          </RouterLink>
          <button
            type="button"
            class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-ink-soft transition-colors hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
            @click="onLogout"
          >
            <IconLogout class="h-4 w-4 shrink-0" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </Transition>

      <button
        type="button"
        :title="collapsed ? profile.label.value : undefined"
        class="flex w-full items-center gap-2.5 rounded-xl py-2 text-left transition-colors hover:bg-lavender-50 cursor-pointer"
        :class="collapsed ? 'justify-center px-0' : 'px-2.5'"
        @click="menuOpen = !menuOpen"
      >
        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lavender-200 text-[13px] font-semibold text-lavender-700">
          {{ profile.initial.value }}
        </div>
        <div v-if="!collapsed" class="min-w-0 flex-1 leading-tight">
          <p class="truncate text-[13px] font-semibold text-ink">{{ profile.label.value }}</p>
          <p class="truncate text-[11.5px] text-ink-faint">{{ auth.user.value?.email }}</p>
        </div>
      </button>
    </div>
  </aside>
</template>
