<script setup lang="ts">
// Section Documentation : arborescence à gauche, page au centre, sommaire à
// droite. Les pages sont chargées à la première visite seulement.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useDocs } from '@/store/useDocs'
import { usePanels } from '@/composables/usePanels'
import { useToast } from '@/composables/useToast'
import { buildToc, docFileName, treeToMarkdown } from '@/utils/docs'
import { downloadFile } from '@/utils/report'
import DocTree from '@/components/docs/DocTree.vue'
import DocPageEditor from '@/components/docs/DocPageEditor.vue'
import DocToc from '@/components/docs/DocToc.vue'
import CrossNookNotice from '@/components/nooks/CrossNookNotice.vue'
import Modal from '@/components/common/Modal.vue'
import IconPlus from '@/icons/IconPlus.vue'
import IconX from '@/icons/IconX.vue'
import IconPanelLeft from '@/icons/IconPanelLeft.vue'

const docs = useDocs()
const panels = usePanels()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const expanded = ref(new Set<string>())

const currentId = computed(() => (typeof route.params.id === 'string' ? route.params.id : null))
const currentPage = computed(() => docs.getPage(currentId.value))
const toc = computed(() => (currentPage.value ? buildToc(currentPage.value) : []))

onMounted(() => {
  void docs.ensureLoaded()
  window.addEventListener('beforeunload', onBeforeUnload)
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  void docs.flushAll()
})

/** Une page en cours de frappe ne doit pas partir avec l'onglet. */
function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!docs.hasPendingSaves.value) return
  e.preventDefault()
  e.returnValue = ''
}

// Changer de page enregistre immédiatement ce qui était en attente : sinon
// une modification faite juste avant le clic partirait plusieurs centaines de
// millisecondes plus tard, alors que l'éditeur affiche déjà autre chose.
onBeforeRouteLeave(() => {
  void docs.flushAll()
})
watch(currentId, () => void docs.flushAll())

/** Déplie la branche menant à la page ouverte. */
watch(
  [currentId, () => docs.pages.value.length],
  () => {
    let page = docs.getPage(currentId.value)
    while (page?.parentId) {
      expanded.value.add(page.parentId)
      page = docs.getPage(page.parentId)
    }
  },
  { immediate: true },
)

function toggle(id: string) {
  if (expanded.value.has(id)) expanded.value.delete(id)
  else expanded.value.add(id)
}

/* -------------------------------------------------------- Actions --- */

function createPage(parentId: string | null = null) {
  const page = docs.createPage({ parentId })
  if (parentId) expanded.value.add(parentId)
  void router.push(`/docs/${page.id}`)
}

function exportPage(id: string) {
  const node = docs.flatTree.value.find((n) => n.id === id)
  if (!node) return
  downloadFile(treeToMarkdown([node]), docFileName(node.title), 'text/markdown;charset=utf-8')
}

function exportAll() {
  if (!docs.tree.value.length) return
  downloadFile(treeToMarkdown(docs.tree.value), 'documentation.md', 'text/markdown;charset=utf-8')
}

/* ------------------------------------------------------ Suppression --- */

const pendingDeleteId = ref<string | null>(null)
const pendingDelete = computed(() => docs.getPage(pendingDeleteId.value))
const pendingDeleteCount = computed(() =>
  pendingDeleteId.value ? docs.descendantIds(pendingDeleteId.value).length : 0,
)

function confirmDelete() {
  const id = pendingDeleteId.value
  pendingDeleteId.value = null
  if (!id) return
  const removedIds = new Set([id, ...docs.descendantIds(id)])
  docs.removePage(id)
  if (currentId.value && removedIds.has(currentId.value)) void router.push('/docs')
}

/* -------------------------------------------------------- Déplacement --- */

const movingId = ref<string | null>(null)
const movingPage = computed(() => docs.getPage(movingId.value))
const moveTargets = computed(() => {
  const id = movingId.value
  if (!id) return []
  return docs.flatTree.value.filter((node) => node.id !== id && docs.canMoveTo(id, node.id))
})

function moveTo(parentId: string | null) {
  const id = movingId.value
  movingId.value = null
  if (!id) return
  docs.movePage(id, parentId)
  if (parentId) expanded.value.add(parentId)
  toast.push('Page déplacée.')
}

</script>

<template>
  <div class="flex min-h-full">
    <!-- Arborescence -->
    <div
      v-if="!panels.state.docsTree"
      class="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface/70 px-3 py-6 md:flex"
    >
      <div class="flex items-center gap-1 px-2">
        <span class="flex-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Documentation</span>
        <button
          type="button"
          title="Nouvelle page"
          aria-label="Nouvelle page"
          class="rounded-lg p-1 text-ink-faint transition-colors hover:bg-lavender-50 hover:text-lavender-600 cursor-pointer"
          @click="createPage(null)"
        >
          <IconPlus class="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Réduire l'arborescence"
          aria-label="Réduire l'arborescence"
          class="rounded-lg p-1 text-ink-faint transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
          @click="panels.toggleDocsTree()"
        >
          <IconPanelLeft class="h-4 w-4" />
        </button>
      </div>

      <div class="mt-3 min-h-0 flex-1 overflow-y-auto">
        <DocTree
          :nodes="docs.tree.value"
          :current-id="currentId"
          :expanded="expanded"
          @toggle="toggle"
          @select="router.push(`/docs/${$event}`)"
          @create-child="createPage($event)"
          @rename="docs.renamePage($event.id, $event.title)"
          @reorder="docs.reorderPage($event.id, $event.delta)"
          @move="movingId = $event"
          @export="exportPage"
          @remove="pendingDeleteId = $event"
        />
        <p v-if="!docs.tree.value.length && docs.loaded.value" class="px-2 py-3 text-[12.5px] text-ink-faint">
          Aucune page pour l'instant.
        </p>
      </div>

      <button
        type="button"
        class="mt-2 rounded-xl px-2.5 py-2 text-left text-[12.5px] font-medium text-ink-faint transition-colors hover:bg-lavender-50 hover:text-lavender-600 cursor-pointer"
        @click="exportAll"
      >
        Exporter toute la doc (.md)
      </button>
    </div>

    <!-- Repliée : une bande étroite pour la rouvrir et créer une page -->
    <div
      v-else
      class="sticky top-0 hidden h-screen w-12 shrink-0 flex-col items-center gap-1 border-r border-line bg-surface/70 py-6 md:flex"
    >
      <button
        type="button"
        title="Afficher l'arborescence"
        aria-label="Afficher l'arborescence"
        class="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
        @click="panels.toggleDocsTree()"
      >
        <IconPanelLeft class="h-[18px] w-[18px]" />
      </button>
      <button
        type="button"
        title="Nouvelle page"
        aria-label="Nouvelle page"
        class="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-lavender-50 hover:text-lavender-600 cursor-pointer"
        @click="createPage(null)"
      >
        <IconPlus class="h-[18px] w-[18px]" />
      </button>
    </div>

    <!-- Contenu -->
    <div class="min-w-0 flex-1">
      <div v-if="docs.isLoading.value && !docs.loaded.value" class="mx-auto max-w-[1100px] px-8 py-9">
        <div class="rounded-2xl bg-white p-10 text-center text-[13.5px] text-ink-faint shadow-soft ring-1 ring-ink/[0.08]">
          Chargement de la documentation…
        </div>
      </div>

      <div v-else-if="currentPage" class="mx-auto flex max-w-[1100px] gap-8 px-8 py-9">
        <div class="min-w-0 flex-1">
          <!-- Le contenu vit sur une carte : c'est ce qui le rend lisible
               par-dessus un fond d'écran (background.css givre .bg-white). -->
          <div class="rounded-2xl bg-white px-7 py-6 shadow-soft ring-1 ring-ink/[0.08]">
            <button
              type="button"
              class="mb-2 text-[12.5px] font-medium text-ink-faint transition-colors hover:text-lavender-600 md:hidden cursor-pointer"
              @click="router.push('/docs')"
            >
              ← Toutes les pages
            </button>

            <DocPageEditor :key="currentPage.id" :page="currentPage" />
          </div>
        </div>

        <aside v-if="toc.length > 1" class="hidden w-48 shrink-0 xl:block">
          <DocToc :entries="toc" />
        </aside>
      </div>

      <!-- Une page est demandée mais absente du nook ouvert : elle vit
           peut-être dans un autre. -->
      <CrossNookNotice v-else-if="currentId" kind="doc_page" :id="currentId" :ready="docs.loaded.value" />

      <!-- Aucune page ouverte -->
      <div v-else class="page-sheet mx-auto max-w-2xl px-8 py-9">
        <h1 class="font-display text-[24px] font-medium tracking-tight text-ink">Documentation</h1>
        <p class="mt-1.5 text-[14px] text-ink-soft">
          Des pages libres pour ta doc technique : titres, paragraphes, blocs de code, listes.
        </p>

        <div v-if="docs.tree.value.length" class="mt-6 flex flex-col gap-1.5">
          <RouterLink
            v-for="node in docs.flatTree.value"
            :key="node.id"
            :to="`/docs/${node.id}`"
            class="flex items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-[13.5px] text-ink shadow-soft ring-1 ring-ink/[0.08] transition-colors hover:text-lavender-600 cursor-pointer"
            :style="{ marginLeft: `${node.depth * 14}px` }"
          >
            <span v-if="node.icon">{{ node.icon }}</span>
            <span class="truncate">{{ node.title }}</span>
          </RouterLink>
        </div>

        <div v-else class="mt-6 rounded-2xl bg-white p-10 text-center shadow-soft ring-1 ring-ink/[0.08]">
          <p class="text-[13.5px] text-ink-faint">
            Rien ici pour l'instant. Crée ta première page pour commencer 📄
          </p>
        </div>

        <button
          type="button"
          class="mt-5 flex items-center gap-2 rounded-xl bg-lavender-500 px-4 py-2.5 text-[13px] font-medium text-white shadow-soft transition-colors hover:bg-lavender-600 cursor-pointer"
          @click="createPage(null)"
        >
          <IconPlus class="h-4 w-4" />
          Nouvelle page
        </button>
      </div>
    </div>

    <!-- Déplacer -->
    <Modal :open="movingId !== null" @close="movingId = null">
      <div class="overflow-hidden rounded-2xl bg-white shadow-soft-lg ring-1 ring-ink/5">
        <div class="flex items-center justify-between border-b border-line px-4 py-3.5">
          <h2 class="font-display text-[15px] font-medium text-ink">
            Déplacer « {{ movingPage?.title }} »
          </h2>
          <button
            type="button"
            class="rounded-full p-1 text-ink-faint transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
            @click="movingId = null"
          >
            <IconX class="h-4 w-4" />
          </button>
        </div>
        <div class="max-h-[50vh] overflow-y-auto p-2">
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13.5px] font-medium text-ink transition-colors hover:bg-lavender-50 cursor-pointer"
            @click="moveTo(null)"
          >
            🏠 Racine de la documentation
          </button>
          <button
            v-for="node in moveTargets"
            :key="node.id"
            type="button"
            class="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13.5px] text-ink-soft transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
            :style="{ paddingLeft: `${10 + node.depth * 14}px` }"
            @click="moveTo(node.id)"
          >
            <span v-if="node.icon">{{ node.icon }}</span>
            <span class="truncate">{{ node.title }}</span>
          </button>
        </div>
      </div>
    </Modal>

    <!-- Supprimer -->
    <Modal :open="pendingDeleteId !== null" @close="pendingDeleteId = null">
      <div class="rounded-2xl bg-white p-5 shadow-soft-lg ring-1 ring-ink/5">
        <h2 class="font-display text-[15px] font-medium text-ink">
          Supprimer « {{ pendingDelete?.title }} » ?
        </h2>
        <p class="mt-2 text-[13.5px] text-ink-soft">
          <template v-if="pendingDeleteCount">
            Cette page et ses {{ pendingDeleteCount }} sous-page{{ pendingDeleteCount > 1 ? 's' : '' }} seront
            supprimées définitivement.
          </template>
          <template v-else>Cette page sera supprimée définitivement.</template>
        </p>
        <div class="mt-5 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-xl px-3.5 py-2 text-[13px] font-medium text-ink-faint transition-colors hover:bg-lavender-50 cursor-pointer"
            @click="pendingDeleteId = null"
          >
            Annuler
          </button>
          <button
            type="button"
            class="rounded-xl bg-rose-500 px-4 py-2 text-[13px] font-medium text-white shadow-soft transition-colors hover:bg-rose-600 cursor-pointer"
            @click="confirmDelete"
          >
            Supprimer
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>
