// État partagé des pages de documentation.
//
// Contrairement à `useStore`, les pages ne sont pas chargées à l'ouverture de
// l'app : `ensureLoaded()` déclenche la requête à la première utilisation (la
// vue Documentation, ou la recherche globale).
//
// Les blocs sont modifiés directement dans l'état réactif puis sauvegardés en
// différé : taper dans un bloc ne doit pas produire une requête par frappe.
import { computed, reactive, watch } from 'vue'
import type { DocBlock, DocPage, DocPageFont, DocPageNode, DocVideo } from '@/types'
import { onBeforeNookSwitch, useNooks } from '@/composables/useNooks'
import { useToast } from '@/composables/useToast'
import { normalizeTitle, pagePlainText, searchExcerpt, wikiLinksIn, type DocSearchHit } from '@/utils/docs'
import * as docsApi from '@/services/docs'

interface DocsState {
  pages: DocPage[]
  isLoading: boolean
  loaded: boolean
  /** Nombre de sauvegardes en cours ou en attente. */
  pendingCount: number
  hasSaveError: boolean
}

const state = reactive<DocsState>({
  pages: [],
  isLoading: false,
  loaded: false,
  pendingCount: 0,
  hasSaveError: false,
})

function genId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/* ------------------------------------------------------------ Chargement --- */

let loadToken = 0
let loadPromise: Promise<void> | null = null

async function load(): Promise<void> {
  const token = ++loadToken
  state.isLoading = true
  try {
    const pages = await docsApi.listPages()
    if (token !== loadToken) return
    state.pages = pages
    state.loaded = true
  } catch {
    if (token !== loadToken) return
    loadPromise = null // autorise une nouvelle tentative
    useToast().error('Impossible de charger la documentation. Vérifie ta connexion et réessaie.')
  } finally {
    if (token === loadToken) state.isLoading = false
  }
}

function ensureLoaded(): Promise<void> {
  if (state.loaded) return Promise.resolve()
  if (!loadPromise) loadPromise = load()
  return loadPromise
}

function reset() {
  loadToken++
  loadPromise = null
  pending.clear()
  for (const timer of timers.values()) window.clearTimeout(timer)
  timers.clear()
  state.pages = []
  state.loaded = false
  state.isLoading = false
  state.pendingCount = 0
  state.hasSaveError = false
}

const nooks = useNooks()

// Pas de `immediate` ici, contrairement à `useStore` : au démarrage il n'y a
// rien à vider, et rien à charger tant que personne n'a ouvert la
// documentation. Seul un *changement* de nook — ou de compte, qui en est un —
// doit repartir de zéro.
let lastNookId: string | null = nooks.activeId.value
watch(nooks.activeId, (nookId) => {
  if (nookId === lastNookId) return
  lastNookId = nookId
  reset()
})

// Les blocs en cours d'écriture partent avant la bascule : `reset()` les
// jetterait, et une écriture différée qui survit au changement viserait la
// bonne page mais dans l'ancien nook.
onBeforeNookSwitch(() => flushAll())

/* ---------------------------------------------------------- Sauvegarde --- */

const SAVE_DELAY_MS = 700

const pending = new Map<string, docsApi.DocPagePatch>()
const timers = new Map<string, number>()

function refreshPendingCount() {
  // Une page peut avoir un patch en attente *et* un minuteur : on compte les
  // pages concernées, pas les entrées.
  state.pendingCount = new Set([...pending.keys(), ...timers.keys()]).size
}

function queueSave(id: string, patch: docsApi.DocPagePatch, delay = SAVE_DELAY_MS) {
  pending.set(id, { ...(pending.get(id) ?? {}), ...patch })
  const existing = timers.get(id)
  if (existing) window.clearTimeout(existing)
  timers.set(
    id,
    window.setTimeout(() => {
      timers.delete(id)
      void flushPage(id)
    }, delay),
  )
  refreshPendingCount()
}

async function flushPage(id: string): Promise<void> {
  const timer = timers.get(id)
  if (timer) {
    window.clearTimeout(timer)
    timers.delete(id)
  }
  const patch = pending.get(id)
  if (!patch) {
    refreshPendingCount()
    return
  }
  pending.delete(id)
  refreshPendingCount()

  try {
    await docsApi.updatePage(id, patch)
    if (pending.size === 0 && timers.size === 0) state.hasSaveError = false
  } catch {
    // Le patch échoué repart en attente, mais toute modification arrivée
    // entre-temps reste prioritaire.
    pending.set(id, { ...patch, ...(pending.get(id) ?? {}) })
    state.hasSaveError = true
    refreshPendingCount()
    useToast().error("Tes modifications n'ont pas pu être enregistrées. Elles seront réessayées.")
  }
}

/** À appeler avant de quitter la vue : force l'envoi de tout ce qui traîne. */
async function flushAll(): Promise<void> {
  const ids = new Set([...pending.keys(), ...timers.keys()])
  await Promise.all([...ids].map((id) => flushPage(id)))
}

/* ------------------------------------------------------ Arborescence --- */

function sortSiblings(a: DocPage, b: DocPage): number {
  return a.position - b.position || a.createdAt.localeCompare(b.createdAt)
}

function buildTree(pages: DocPage[]): DocPageNode[] {
  const byParent = new Map<string | null, DocPage[]>()
  for (const page of pages) {
    const siblings = byParent.get(page.parentId) ?? []
    siblings.push(page)
    byParent.set(page.parentId, siblings)
  }

  // Une page dont le parent a disparu remonte à la racine plutôt que de
  // devenir invisible.
  const known = new Set(pages.map((p) => p.id))
  const roots = [...(byParent.get(null) ?? [])]
  for (const page of pages) {
    if (page.parentId !== null && !known.has(page.parentId)) roots.push(page)
  }

  // `seen` garde-fou : une boucle de parents (impossible via l'app, mais la
  // base ne l'interdit qu'au premier niveau) ne doit pas figer le rendu.
  const seen = new Set<string>()
  function toNodes(list: DocPage[], depth: number): DocPageNode[] {
    const nodes: DocPageNode[] = []
    for (const page of list.slice().sort(sortSiblings)) {
      if (seen.has(page.id)) continue
      seen.add(page.id)
      nodes.push({ ...page, depth, children: toNodes(byParent.get(page.id) ?? [], depth + 1) })
    }
    return nodes
  }

  return toNodes(roots, 0)
}

/* ---------------------------------------------------------------- API --- */

export function useDocs() {
  const pages = computed(() => state.pages)
  const tree = computed(() => buildTree(state.pages))

  /** Toutes les pages à plat, dans l'ordre de l'arborescence. */
  const flatTree = computed(() => {
    const out: DocPageNode[] = []
    const walk = (nodes: DocPageNode[]) => {
      for (const node of nodes) {
        out.push(node)
        walk(node.children)
      }
    }
    walk(tree.value)
    return out
  })

  function getPage(id: string | null | undefined): DocPage | undefined {
    if (!id) return undefined
    return state.pages.find((p) => p.id === id)
  }

  function findByTitle(title: string): DocPage | undefined {
    const wanted = normalizeTitle(title)
    return state.pages.find((p) => normalizeTitle(p.title) === wanted)
  }

  function childrenOf(parentId: string | null): DocPage[] {
    return state.pages.filter((p) => p.parentId === parentId).sort(sortSiblings)
  }

  function descendantIds(id: string): string[] {
    const out: string[] = []
    const walk = (parentId: string) => {
      for (const page of state.pages) {
        if (page.parentId !== parentId) continue
        out.push(page.id)
        walk(page.id)
      }
    }
    walk(id)
    return out
  }

  function createPage(input: { title?: string; parentId?: string | null; blocks?: DocBlock[] } = {}): DocPage {
    const parentId = input.parentId ?? null
    const siblings = childrenOf(parentId)
    const now = new Date().toISOString()
    const page: DocPage = {
      id: genId(),
      parentId,
      title: input.title?.trim() || 'Sans titre',
      icon: null,
      position: siblings.length ? Math.max(...siblings.map((s) => s.position)) + 1 : 0,
      font: 'sans',
      blocks: input.blocks ?? [],
      videos: [],
      createdAt: now,
      updatedAt: now,
    }
    state.pages.push(page)
    docsApi
      .createPage({
        id: page.id,
        title: page.title,
        parentId: page.parentId,
        position: page.position,
        icon: page.icon,
        font: page.font,
        blocks: page.blocks,
        videos: page.videos,
      })
      .catch(() => {
        const idx = state.pages.findIndex((p) => p.id === page.id)
        if (idx !== -1) state.pages.splice(idx, 1)
        useToast().error("La page n'a pas pu être créée.")
      })
    return page
  }

  function renamePage(id: string, title: string) {
    const page = getPage(id)
    if (!page) return
    page.title = title
    page.updatedAt = new Date().toISOString()
    queueSave(id, { title }, 500)
  }

  function setIcon(id: string, icon: string | null) {
    const page = getPage(id)
    if (!page) return
    page.icon = icon
    queueSave(id, { icon }, 0)
  }

  function setFont(id: string, font: DocPageFont) {
    const page = getPage(id)
    if (!page) return
    page.font = font
    queueSave(id, { font }, 0)
  }

  /** Enregistre les blocs de la page tels qu'ils sont actuellement en mémoire. */
  function touchBlocks(id: string) {
    const page = getPage(id)
    if (!page) return
    page.updatedAt = new Date().toISOString()
    queueSave(id, { blocks: JSON.parse(JSON.stringify(page.blocks)) as DocBlock[] })
  }

  /* ------------------------------------------------------------ Vidéos --- */

  // La liste part en entier à chaque fois, comme les blocs : elle est courte,
  // et un patch partiel sur du jsonb ne vaut pas la complication.
  function queueVideos(page: DocPage, delay?: number) {
    page.updatedAt = new Date().toISOString()
    queueSave(page.id, { videos: JSON.parse(JSON.stringify(page.videos)) as DocVideo[] }, delay)
  }

  /** Ignore une vidéo déjà présente — c'est la même page, le même cours. */
  function addVideo(id: string, input: { videoId: string; title: string; seconds?: number }): DocVideo | undefined {
    const page = getPage(id)
    if (!page || page.videos.some((v) => v.videoId === input.videoId)) return undefined
    const video: DocVideo = {
      id: genId(),
      videoId: input.videoId,
      title: input.title,
      seconds: Math.max(0, Math.floor(input.seconds ?? 0)),
      duration: 0,
      addedAt: new Date().toISOString(),
    }
    page.videos.push(video)
    queueVideos(page, 0)
    return video
  }

  function removeVideo(id: string, videoId: string) {
    const page = getPage(id)
    if (!page) return
    const index = page.videos.findIndex((v) => v.id === videoId)
    if (index === -1) return
    page.videos.splice(index, 1)
    queueVideos(page, 0)
  }

  function renameVideo(id: string, videoId: string, title: string) {
    const page = getPage(id)
    const video = page?.videos.find((v) => v.id === videoId)
    if (!page || !video) return
    video.title = title
    queueVideos(page, 500)
  }

  /**
   * Repère de lecture. Appelé pendant la lecture, donc temporisé : deux
   * relevés rapprochés ne font qu'une écriture. `immediate` sert au dernier
   * relevé — pause, fermeture du lecteur — qu'il ne faut pas perdre.
   */
  function setVideoTime(id: string, videoId: string, seconds: number, immediate = false) {
    const page = getPage(id)
    const video = page?.videos.find((v) => v.id === videoId)
    if (!page || !video) return
    const next = Math.max(0, Math.floor(seconds))
    if (video.seconds === next) return
    video.seconds = next
    queueVideos(page, immediate ? 0 : 1500)
  }

  /** Relevée au premier lancement : le lecteur est le seul à la connaître. */
  function setVideoDuration(id: string, videoId: string, duration: number) {
    const page = getPage(id)
    const video = page?.videos.find((v) => v.id === videoId)
    if (!page || !video) return
    const next = Math.max(0, Math.floor(duration))
    if (video.duration === next) return
    video.duration = next
    queueVideos(page, 1500)
  }

  /** `false` si la cible est la page elle-même ou l'une de ses descendantes. */
  function canMoveTo(id: string, parentId: string | null): boolean {
    if (parentId === null) return true
    if (parentId === id) return false
    return !descendantIds(id).includes(parentId)
  }

  function movePage(id: string, parentId: string | null) {
    const page = getPage(id)
    if (!page || !canMoveTo(id, parentId)) return
    const siblings = childrenOf(parentId).filter((p) => p.id !== id)
    const position = siblings.length ? Math.max(...siblings.map((s) => s.position)) + 1 : 0
    page.parentId = parentId
    page.position = position
    queueSave(id, { parentId, position }, 0)
  }

  /** Décale la page d'un cran parmi ses sœurs (`-1` = vers le haut). */
  function reorderPage(id: string, delta: -1 | 1) {
    const page = getPage(id)
    if (!page) return
    const siblings = childrenOf(page.parentId)
    const index = siblings.findIndex((p) => p.id === id)
    const target = index + delta
    if (index === -1 || target < 0 || target >= siblings.length) return

    siblings.splice(target, 0, ...siblings.splice(index, 1))
    // Renumérotation complète de la fratrie : plus simple à raisonner qu'un
    // échange de positions, et le nombre de sœurs reste petit.
    siblings.forEach((sibling, i) => {
      if (sibling.position === i) return
      sibling.position = i
      queueSave(sibling.id, { position: i }, 0)
    })
  }

  function removePage(id: string) {
    const ids = new Set([id, ...descendantIds(id)])
    const snapshot = state.pages.filter((p) => ids.has(p.id))
    if (!snapshot.length) return
    state.pages = state.pages.filter((p) => !ids.has(p.id))
    for (const pageId of ids) {
      pending.delete(pageId)
      const timer = timers.get(pageId)
      if (timer) window.clearTimeout(timer)
      timers.delete(pageId)
    }
    refreshPendingCount()

    docsApi.deletePage(id).catch(() => {
      state.pages.push(...snapshot)
      useToast().error("La page n'a pas pu être supprimée.")
    })
  }

  /* ------------------------------------------------------- Liens & recherche --- */

  /** Pages qui citent `[[titre de cette page]]`. */
  function backlinksTo(id: string): DocPage[] {
    const page = getPage(id)
    if (!page) return []
    const wanted = normalizeTitle(page.title)
    if (!wanted) return []
    return state.pages.filter(
      (candidate) =>
        candidate.id !== id && wikiLinksIn(candidate).some((title) => normalizeTitle(title) === wanted),
    )
  }

  function searchPages(query: string): DocSearchHit[] {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const hits: DocSearchHit[] = []
    for (const page of state.pages) {
      const matchedTitle = page.title.toLowerCase().includes(q)
      const body = pagePlainText(page)
      const matchedBody = body.toLowerCase().includes(q)
      if (!matchedTitle && !matchedBody) continue
      hits.push({
        page,
        matchedTitle,
        excerpt: matchedBody ? searchExcerpt(body, q) : searchExcerpt(body, body.slice(0, 1)),
      })
    }
    // Les correspondances de titre d'abord : ce sont les plus attendues.
    return hits.sort((a, b) => Number(b.matchedTitle) - Number(a.matchedTitle))
  }

  return {
    state,
    isLoading: computed(() => state.isLoading),
    loaded: computed(() => state.loaded),
    pages,
    tree,
    flatTree,
    saveStatus: computed<'saved' | 'saving' | 'error'>(() =>
      state.hasSaveError ? 'error' : state.pendingCount > 0 ? 'saving' : 'saved',
    ),
    hasPendingSaves: computed(() => state.pendingCount > 0),
    ensureLoaded,
    getPage,
    findByTitle,
    childrenOf,
    descendantIds,
    createPage,
    renamePage,
    setIcon,
    setFont,
    touchBlocks,
    addVideo,
    removeVideo,
    renameVideo,
    setVideoTime,
    setVideoDuration,
    canMoveTo,
    movePage,
    reorderPage,
    removePage,
    backlinksTo,
    searchPages,
    flushAll,
  }
}
