// Repli des panneaux : menu principal, arborescence de la doc, et les
// panneaux de la colonne de droite de l'accueil.
//
// Même choix que useDayPanel : l'état vit dans localStorage, pas dans
// `user_preferences`. C'est un réglage de fenêtre — on replie parce que
// l'écran est étroit ici et maintenant — pas une préférence de compte à
// synchroniser d'un appareil à l'autre.
import { reactive, watch } from 'vue'

const SIDEBAR_KEY = 'nook:sidebar-collapsed:v1'
const DOCS_TREE_KEY = 'nook:docs-tree-collapsed:v1'
const HOME_PANELS_KEY = 'nook:home-panels-collapsed:v1'

/** Les panneaux repliables de la colonne de droite de l'accueil. */
export type HomePanelId = 'today' | 'notes' | 'todo'

function load(key: string): boolean {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'false') === true
  } catch {
    return false
  }
}

/**
 * Un objet plutôt qu'une clé par panneau : ajouter un panneau repliable ne
 * demande alors qu'un identifiant. Seuls les `true` sont retenus — un panneau
 * absent est déplié, ce qui est l'état de départ.
 */
function loadHomePanels(): Partial<Record<HomePanelId, boolean>> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(HOME_PANELS_KEY) ?? '{}')
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const out: Partial<Record<HomePanelId, boolean>> = {}
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (value === true) out[key as HomePanelId] = true
    }
    return out
  } catch {
    return {}
  }
}

const state = reactive({
  /** `true` = replié. Déplié par défaut. */
  sidebar: load(SIDEBAR_KEY),
  docsTree: load(DOCS_TREE_KEY),
  /**
   * Le menu principal en tiroir, sous le point de rupture `md` — écran de
   * fenêtre, pas préférence : toujours fermé au chargement, jamais persisté.
   * Indépendant du repli en bande d'icônes ci-dessus, qui reste un réglage de
   * grand écran.
   */
  mobileSidebar: false,
  /** Par identifiant de panneau ; `true` = replié sur sa seule ligne de titre. */
  homePanels: loadHomePanels() as Partial<Record<HomePanelId, boolean>>,
})

watch(
  () => state.sidebar,
  (value) => localStorage.setItem(SIDEBAR_KEY, JSON.stringify(value)),
)
watch(
  () => state.docsTree,
  (value) => localStorage.setItem(DOCS_TREE_KEY, JSON.stringify(value)),
)
watch(
  () => state.homePanels,
  (value) => localStorage.setItem(HOME_PANELS_KEY, JSON.stringify(value)),
  { deep: true },
)

export function usePanels() {
  function toggleSidebar() {
    state.sidebar = !state.sidebar
  }
  function toggleDocsTree() {
    state.docsTree = !state.docsTree
  }
  function isPanelCollapsed(id: HomePanelId): boolean {
    return state.homePanels[id] === true
  }
  function togglePanel(id: HomePanelId) {
    // Supprimé plutôt que mis à `false` : ce qui n'est pas replié n'a pas à
    // laisser de trace dans le stockage.
    if (state.homePanels[id]) delete state.homePanels[id]
    else state.homePanels[id] = true
  }
  function openMobileSidebar() {
    state.mobileSidebar = true
  }
  function closeMobileSidebar() {
    state.mobileSidebar = false
  }
  return {
    state,
    toggleSidebar,
    toggleDocsTree,
    isPanelCollapsed,
    togglePanel,
    openMobileSidebar,
    closeMobileSidebar,
  }
}
