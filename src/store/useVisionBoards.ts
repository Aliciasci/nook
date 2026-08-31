import { computed, reactive, watch } from 'vue'
import type { FolderColor, Item, VisionBoard, VisionBoardItem, VisionBoardItemKind } from '@/types'
import { useNooks } from '@/composables/useNooks'
import { useToast } from '@/composables/useToast'
import { CANVAS_ASPECT } from '@/utils/visionBoard'
import * as boardsApi from '@/services/visionBoards'
import * as itemsApi from '@/services/visionBoardItems'
import { removeVisionBoardImage } from '@/services/visionBoardImages'

function genId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `vb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Taille de départ par nature — l'utilisateur redimensionne ensuite librement.
 * L'image n'est pas carrée : une photo Pinterest est le plus souvent portrait,
 * et la carte affiche l'image entière (`object-contain`) plutôt que de la
 * recadrer, donc un départ plus haut que large laisse moins de bandes vides.
 */
const DEFAULT_SIZE: Record<VisionBoardItemKind, { width: number; height: number }> = {
  image: { width: 22, height: 32 },
  note: { width: 24, height: 18 },
  color: { width: 16, height: 16 },
  link: { width: 26, height: 12 },
  // Une zone se veut assez grande pour accueillir plusieurs autres éléments.
  section: { width: 45, height: 40 },
}

interface VisionBoardsState {
  boards: VisionBoard[]
  boardsLoaded: boolean
  isLoadingBoards: boolean
  currentBoardId: string | null
  /** Éléments chargés, par board — un board jamais ouvert n'a pas d'entrée. */
  itemsByBoard: Map<string, VisionBoardItem[]>
  loadedBoardIds: Set<string>
  loadingBoardIds: Set<string>
}

const state = reactive<VisionBoardsState>({
  boards: [],
  boardsLoaded: false,
  isLoadingBoards: true,
  currentBoardId: null,
  itemsByBoard: new Map(),
  loadedBoardIds: new Set(),
  loadingBoardIds: new Set(),
})

let boardsLoadToken = 0

async function loadBoards() {
  const token = ++boardsLoadToken
  state.isLoadingBoards = true
  try {
    const boards = await boardsApi.listVisionBoards()
    if (token !== boardsLoadToken) return
    state.boards = boards
    if (!boards.some((b) => b.id === state.currentBoardId)) {
      state.currentBoardId = boards[0]?.id ?? null
    }
  } catch {
    if (token !== boardsLoadToken) return
    useToast().error('Impossible de charger tes boards. Vérifie ta connexion et réessaie.')
  } finally {
    if (token === boardsLoadToken) {
      state.isLoadingBoards = false
      state.boardsLoaded = true
    }
  }
}

function reset() {
  boardsLoadToken++
  state.boards = []
  state.currentBoardId = null
  state.itemsByBoard = new Map()
  state.loadedBoardIds = new Set()
  state.loadingBoardIds = new Set()
  state.isLoadingBoards = true
  state.boardsLoaded = false
}

// Les vision boards appartiennent au nook, comme le reste.
const nooks = useNooks()
watch(
  nooks.activeId,
  (nookId) => {
    if (nookId) void loadBoards()
    else reset()
  },
  { immediate: true },
)

export function useVisionBoards() {
  const boards = computed(() => state.boards)
  const currentBoardId = computed(() => state.currentBoardId)
  const currentBoard = computed(() => state.boards.find((b) => b.id === state.currentBoardId) ?? null)

  function setCurrentBoard(id: string) {
    if (state.boards.some((b) => b.id === id)) state.currentBoardId = id
  }

  /** Charge les éléments d'un board au premier besoin, puis les garde en mémoire. */
  async function ensureItemsLoaded(boardId: string): Promise<void> {
    if (state.loadedBoardIds.has(boardId) || state.loadingBoardIds.has(boardId)) return
    state.loadingBoardIds.add(boardId)
    try {
      const items = await itemsApi.listVisionBoardItems(boardId)
      state.itemsByBoard.set(boardId, items)
      state.loadedBoardIds.add(boardId)
    } catch {
      useToast().error('Impossible de charger ce board. Vérifie ta connexion et réessaie.')
    } finally {
      state.loadingBoardIds.delete(boardId)
    }
  }

  function itemsForBoard(boardId: string): VisionBoardItem[] {
    return state.itemsByBoard.get(boardId) ?? []
  }

  function isBoardLoading(boardId: string): boolean {
    return state.loadingBoardIds.has(boardId)
  }

  /* ------------------------------------------------------------ Boards --- */

  async function createBoard(name: string): Promise<VisionBoard | null> {
    const board: VisionBoard = {
      id: genId(),
      name: name.trim() || 'Nouveau board',
      position: state.boards.length ? Math.max(...state.boards.map((b) => b.position)) + 1 : 0,
      createdAt: new Date().toISOString(),
    }
    state.boards.push(board)
    state.itemsByBoard.set(board.id, [])
    state.loadedBoardIds.add(board.id)
    try {
      await boardsApi.createVisionBoard(board)
      return board
    } catch {
      const idx = state.boards.findIndex((b) => b.id === board.id)
      if (idx !== -1) state.boards.splice(idx, 1)
      state.itemsByBoard.delete(board.id)
      state.loadedBoardIds.delete(board.id)
      useToast().error("Ce board n'a pas pu être créé.")
      return null
    }
  }

  function renameBoard(id: string, name: string) {
    const board = state.boards.find((b) => b.id === id)
    if (!board) return
    const before = board.name
    board.name = name.trim() || before
    boardsApi.updateVisionBoard(id, { name: board.name }).catch(() => {
      board.name = before
      useToast().error("Ce board n'a pas pu être renommé.")
    })
  }

  /** Même mécanique que `moveFolder` : l'ordre change à l'écran, puis se persiste. */
  function moveBoard(id: string, toIndex: number) {
    const from = state.boards.findIndex((b) => b.id === id)
    const to = Math.max(0, Math.min(toIndex, state.boards.length - 1))
    if (from === -1 || from === to) return

    const snapshot = state.boards.map((b) => ({ id: b.id, position: b.position }))
    const ordered = state.boards.slice()
    ordered.splice(to, 0, ...ordered.splice(from, 1))

    const changed: VisionBoard[] = []
    ordered.forEach((board, index) => {
      if (board.position === index) return
      board.position = index
      changed.push(board)
    })
    state.boards = ordered
    if (!changed.length) return

    Promise.all(changed.map((b) => boardsApi.updateVisionBoard(b.id, { position: b.position }))).catch(() => {
      const previous = new Map(snapshot.map((entry) => [entry.id, entry.position]))
      for (const board of state.boards) {
        const position = previous.get(board.id)
        if (position !== undefined) board.position = position
      }
      state.boards = state.boards
        .slice()
        .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
      useToast().error("L'ordre des boards n'a pas pu être enregistré.")
    })
  }

  async function removeBoard(id: string): Promise<void> {
    const idx = state.boards.findIndex((b) => b.id === id)
    if (idx === -1) return
    const [removed] = state.boards.splice(idx, 1)
    const removedItems = state.itemsByBoard.get(id) ?? []
    state.itemsByBoard.delete(id)
    state.loadedBoardIds.delete(id)
    if (state.currentBoardId === id) state.currentBoardId = state.boards[0]?.id ?? null

    try {
      await boardsApi.deleteVisionBoard(id)
      // Le ménage des images du bucket est indépendant de la suppression en
      // base — la cascade SQL a déjà emporté les lignes, le stockage n'a pas
      // d'équivalent. Best-effort, jamais bloquant.
      for (const item of removedItems) {
        if (item.kind === 'image' && item.imagePath) void removeVisionBoardImage(item.imagePath)
      }
    } catch {
      state.boards.splice(idx, 0, removed)
      state.itemsByBoard.set(id, removedItems)
      state.loadedBoardIds.add(id)
      useToast().error("Ce board n'a pas pu être supprimé.")
    }
  }

  /* -------------------------------------------------------------- Items --- */

  function nextZIndex(boardId: string): number {
    const items = itemsForBoard(boardId)
    return items.length ? Math.max(...items.map((it) => it.zIndex)) + 1 : 1
  }

  /**
   * Taille de départ d'une image, au format réel de la photo plutôt qu'au
   * carré par défaut — sans quoi `object-contain` laisse des bandes vides sur
   * les côtés d'une photo portrait. `x`/`y`/`width`/`height` sont des
   * pourcentages de deux dimensions différentes (largeur puis hauteur du
   * canvas), d'où `CANVAS_ASPECT` pour convertir le ratio pixel de la photo
   * en ratio largeur%/hauteur%. Garde à peu près l'aire du carré par défaut,
   * bornée pour ne jamais donner un ruban trop fin ou une carte énorme.
   */
  function sizeForImage(naturalWidth?: number, naturalHeight?: number): { width: number; height: number } {
    const fallback = DEFAULT_SIZE.image
    if (!naturalWidth || !naturalHeight) return fallback

    const area = fallback.width * fallback.height
    const ratio = naturalWidth / naturalHeight / CANVAS_ASPECT
    const width = Math.min(60, Math.max(12, Math.sqrt(area * ratio)))
    const height = Math.min(60, Math.max(12, area / width))
    return { width, height }
  }

  /** Un point de départ qui cascade légèrement pour ne pas empiler les nouveaux éléments un-pour-un. */
  function nextPosition(boardId: string, size: { width: number; height: number }) {
    const count = itemsForBoard(boardId).length
    const offset = (count * 6) % 40
    return {
      x: Math.min(100 - size.width, 8 + offset),
      y: Math.min(100 - size.height, 8 + offset),
    }
  }

  function pushItem(item: VisionBoardItem) {
    const list = state.itemsByBoard.get(item.boardId)
    if (list) list.push(item)
    else state.itemsByBoard.set(item.boardId, [item])
  }

  function dropItem(id: string): VisionBoardItem | null {
    for (const list of state.itemsByBoard.values()) {
      const idx = list.findIndex((it) => it.id === id)
      if (idx !== -1) return list.splice(idx, 1)[0]
    }
    return null
  }

  function addImageItem(
    boardId: string,
    image: { url: string; path: string; naturalWidth?: number; naturalHeight?: number },
  ): VisionBoardItem {
    const size = sizeForImage(image.naturalWidth, image.naturalHeight)
    const item: VisionBoardItem = {
      id: genId(),
      boardId,
      kind: 'image',
      ...nextPosition(boardId, size),
      ...size,
      zIndex: nextZIndex(boardId),
      color: null,
      text: null,
      imageUrl: image.url,
      imagePath: image.path,
      itemId: null,
      itemTitle: null,
      itemType: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    pushItem(item)
    itemsApi.createVisionBoardItem(item).catch(() => {
      dropItem(item.id)
      void removeVisionBoardImage(image.path)
      useToast().error("Cette image n'a pas pu être ajoutée.")
    })
    return item
  }

  function addNoteItem(boardId: string): VisionBoardItem {
    const size = DEFAULT_SIZE.note
    const item: VisionBoardItem = {
      id: genId(),
      boardId,
      kind: 'note',
      ...nextPosition(boardId, size),
      ...size,
      zIndex: nextZIndex(boardId),
      color: null,
      text: '',
      imageUrl: null,
      imagePath: null,
      itemId: null,
      itemTitle: null,
      itemType: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    pushItem(item)
    itemsApi.createVisionBoardItem(item).catch(() => {
      dropItem(item.id)
      useToast().error("Cette note n'a pas pu être ajoutée.")
    })
    return item
  }

  function addColorItem(boardId: string, color: FolderColor): VisionBoardItem {
    const size = DEFAULT_SIZE.color
    const item: VisionBoardItem = {
      id: genId(),
      boardId,
      kind: 'color',
      ...nextPosition(boardId, size),
      ...size,
      zIndex: nextZIndex(boardId),
      color,
      text: null,
      imageUrl: null,
      imagePath: null,
      itemId: null,
      itemTitle: null,
      itemType: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    pushItem(item)
    itemsApi.createVisionBoardItem(item).catch(() => {
      dropItem(item.id)
      useToast().error("Cette pastille n'a pas pu être ajoutée.")
    })
    return item
  }

  function addLinkItem(boardId: string, target: Item): VisionBoardItem {
    const size = DEFAULT_SIZE.link
    const item: VisionBoardItem = {
      id: genId(),
      boardId,
      kind: 'link',
      ...nextPosition(boardId, size),
      ...size,
      zIndex: nextZIndex(boardId),
      color: null,
      text: null,
      imageUrl: null,
      imagePath: null,
      itemId: target.id,
      itemTitle: target.title,
      itemType: target.type,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    pushItem(item)
    itemsApi.createVisionBoardItem(item).catch(() => {
      dropItem(item.id)
      useToast().error("Cette carte n'a pas pu être ajoutée.")
    })
    return item
  }

  /**
   * Une zone de fond, pour regrouper d'autres éléments visuellement — aucun
   * lien de données entre eux, juste une place commune sur le canvas.
   * `zIndex: 0` plutôt que `nextZIndex` : une section se pose toujours
   * derrière ce qui existe déjà, jamais par-dessus.
   */
  function addSectionItem(boardId: string, title = 'Nouvelle section'): VisionBoardItem {
    const size = DEFAULT_SIZE.section
    const item: VisionBoardItem = {
      id: genId(),
      boardId,
      kind: 'section',
      ...nextPosition(boardId, size),
      ...size,
      zIndex: 0,
      color: null,
      text: title,
      imageUrl: null,
      imagePath: null,
      itemId: null,
      itemTitle: null,
      itemType: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    pushItem(item)
    itemsApi.createVisionBoardItem(item).catch(() => {
      dropItem(item.id)
      useToast().error("Cette section n'a pas pu être ajoutée.")
    })
    return item
  }

  function updateItem(id: string, patch: itemsApi.VisionBoardItemPatch) {
    for (const list of state.itemsByBoard.values()) {
      const item = list.find((it) => it.id === id)
      if (!item) continue
      const before: itemsApi.VisionBoardItemPatch = {}
      for (const key of Object.keys(patch) as (keyof itemsApi.VisionBoardItemPatch)[]) {
        // @ts-expect-error — recopie clé à clé d'un patch partiel homogène
        before[key] = item[key]
      }
      Object.assign(item, patch)
      itemsApi.updateVisionBoardItem(id, patch).catch(() => {
        Object.assign(item, before)
        useToast().error("Cette modification n'a pas pu être enregistrée.")
      })
      return
    }
  }

  /** Passe l'élément au premier plan de son board — no-op s'il y est déjà seul. */
  function bringToFront(item: VisionBoardItem) {
    const others = itemsForBoard(item.boardId).filter((it) => it.id !== item.id)
    const maxOthers = others.length ? Math.max(...others.map((it) => it.zIndex)) : 0
    if (item.zIndex > maxOthers) return
    updateItem(item.id, { zIndex: maxOthers + 1 })
  }

  function removeItem(id: string) {
    const removed = dropItem(id)
    if (!removed) return
    itemsApi
      .deleteVisionBoardItem(id)
      .then(() => {
        // Le ménage du stockage attend la confirmation : le supprimer avant
        // laisserait l'élément restauré (si l'écriture échoue) sans image.
        if (removed.kind === 'image' && removed.imagePath) void removeVisionBoardImage(removed.imagePath)
      })
      .catch(() => {
        pushItem(removed)
        useToast().error("Cet élément n'a pas pu être supprimé.")
      })
  }

  return {
    isLoadingBoards: computed(() => state.isLoadingBoards),
    boardsLoaded: computed(() => state.boardsLoaded),
    boards,
    currentBoardId,
    currentBoard,
    setCurrentBoard,
    ensureItemsLoaded,
    itemsForBoard,
    isBoardLoading,
    createBoard,
    renameBoard,
    moveBoard,
    removeBoard,
    addImageItem,
    addNoteItem,
    addColorItem,
    addLinkItem,
    addSectionItem,
    updateItem,
    bringToFront,
    removeItem,
  }
}
