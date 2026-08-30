// Repli des panneaux latéraux : menu principal et arborescence de la doc.
//
// Même choix que useDayPanel : l'état vit dans localStorage, pas dans
// `user_preferences`. C'est un réglage de fenêtre — on replie parce que
// l'écran est étroit ici et maintenant — pas une préférence de compte à
// synchroniser d'un appareil à l'autre.
import { reactive, watch } from 'vue'

const SIDEBAR_KEY = 'nook:sidebar-collapsed:v1'
const DOCS_TREE_KEY = 'nook:docs-tree-collapsed:v1'

function load(key: string): boolean {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'false') === true
  } catch {
    return false
  }
}

const state = reactive({
  /** `true` = replié. Déplié par défaut. */
  sidebar: load(SIDEBAR_KEY),
  docsTree: load(DOCS_TREE_KEY),
})

watch(
  () => state.sidebar,
  (value) => localStorage.setItem(SIDEBAR_KEY, JSON.stringify(value)),
)
watch(
  () => state.docsTree,
  (value) => localStorage.setItem(DOCS_TREE_KEY, JSON.stringify(value)),
)

export function usePanels() {
  function toggleSidebar() {
    state.sidebar = !state.sidebar
  }
  function toggleDocsTree() {
    state.docsTree = !state.docsTree
  }
  return { state, toggleSidebar, toggleDocsTree }
}
