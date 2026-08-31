import { computed, reactive, watch } from 'vue'
import type { Folder, FolderColor, Item, ItemLink, ItemStatus, Priority } from '@/types'
import { useGarden } from '@/composables/useGarden'
import { useNooks } from '@/composables/useNooks'
import { useToast } from '@/composables/useToast'
import * as foldersApi from '@/services/folders'
import * as itemsApi from '@/services/items'
import * as linksApi from '@/services/itemLinks'

interface StoredData {
  folders: Folder[]
  items: Item[]
  links: ItemLink[]
  isLoading: boolean
  loaded: boolean
}

const state = reactive<StoredData>({ folders: [], items: [], links: [], isLoading: true, loaded: false })

function genId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

const FOLDER_ICONS = ['📘', '📗', '💜', '📄', '💡', '👀', '🌿', '🎯', '✨', '📚']
const FOLDER_COLORS: FolderColor[] = ['blue', 'green', 'pink', 'beige', 'lavender', 'peach']

let loadToken = 0

/**
 * Écritures encore en vol, par clé — l'identifiant d'un item, ou
 * `link:<a>:<b>` pour un lien. Le store écrit sans attendre, mais un lien
 * référence deux items : sa clé étrangère est refusée s'il double la création
 * de la tâche qu'il désigne. Les opérations liées s'attendent donc ici.
 */
const pendingWrites = new Map<string, Promise<void>>()

/** La promesse passée ne doit jamais rejeter : elle est partagée, pas reprise. */
function trackWrite(key: string, promise: Promise<void>): Promise<void> {
  const tracked = promise.finally(() => {
    if (pendingWrites.get(key) === tracked) pendingWrites.delete(key)
  })
  pendingWrites.set(key, tracked)
  return tracked
}

function written(key: string): Promise<void> {
  return pendingWrites.get(key) ?? Promise.resolve()
}

function linkKey(itemId: string, linkedItemId: string): string {
  return `link:${itemId}:${linkedItemId}`
}

async function load() {
  const token = ++loadToken
  state.isLoading = true
  try {
    const [folders, items, links] = await Promise.all([
      foldersApi.listFolders(),
      itemsApi.listItems(),
      linksApi.listItemLinks(),
    ])
    if (token !== loadToken) return // a newer load (or a reset) superseded this one
    state.folders = folders
    state.items = items
    state.links = links
  } catch {
    if (token !== loadToken) return
    useToast().error("Impossible de charger tes données. Vérifie ta connexion et réessaie.")
  } finally {
    if (token === loadToken) {
      state.isLoading = false
      state.loaded = true
    }
  }
}

function reset() {
  loadToken++ // invalidate any in-flight load for the previous user
  state.folders = []
  state.items = []
  state.links = []
  state.isLoading = true
  state.loaded = false
}

// Le nook actif, pas la session : il devient `null` à la déconnexion comme
// avant, et change aussi quand on passe d'un nook à l'autre. Les deux
// méritent exactement le même rechargement complet.
const nooks = useNooks()
watch(
  nooks.activeId,
  (nookId) => {
    if (nookId) void load()
    else reset()
  },
  { immediate: true },
)

export function useStore() {
  const folders = computed(() => state.folders)
  const items = computed(() => state.items)

  const folderById = computed(() => {
    const map = new Map<string, Folder>()
    for (const f of state.folders) map.set(f.id, f)
    return map
  })

  function getFolder(id: string | null | undefined): Folder | undefined {
    if (!id) return undefined
    return folderById.value.get(id)
  }

  const itemById = computed(() => {
    const map = new Map<string, Item>()
    for (const it of state.items) map.set(it.id, it)
    return map
  })

  function getItem(id: string | null | undefined): Item | undefined {
    if (!id) return undefined
    return itemById.value.get(id)
  }

  /**
   * Les items des vues actives — tout, sauf ce qui est archivé. Un lien ou un
   * bloc de planning qui vise un item archivé continue de le résoudre via
   * `getItem`/`itemById` : seules les listes de travail (Inbox, À faire,
   * Terminées, dossiers…) filtrent dessus.
   */
  const activeItems = computed(() => state.items.filter((it) => !it.archivedAt))

  function folderStats(folderId: string) {
    let tasks = 0
    let notes = 0
    for (const it of activeItems.value) {
      if (it.folderId !== folderId) continue
      if (it.type === 'task') tasks++
      else notes++
    }
    return { tasks, notes }
  }

  function folderTasks(folderId: string, status?: ItemStatus) {
    return activeItems.value.filter(
      (it) => it.folderId === folderId && it.type === 'task' && (status === undefined || it.status === status),
    )
  }

  function folderNotes(folderId: string) {
    return activeItems.value.filter((it) => it.folderId === folderId && it.type === 'note')
  }

  const inboxItems = computed(() =>
    activeItems.value
      .filter((it) => it.folderId === null && it.type === 'task' && it.status !== 'done')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  )

  const quickNotes = computed(() =>
    activeItems.value
      .filter((it) => it.folderId === null && it.type === 'note')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  )

  const todayTasks = computed(() => {
    const today = todayISO()
    const all = activeItems.value.filter((it) => it.type === 'task' && it.status !== 'done' && it.dueDate === today)
    return {
      priority: all.filter((it) => it.priority === 'high'),
      regular: all.filter((it) => it.priority !== 'high'),
      count: all.length,
    }
  })

  const allOpenTasks = computed(() => activeItems.value.filter((it) => it.type === 'task' && it.status !== 'done'))

  /**
   * Les tâches dues un jour donné, rangées comme `todayTasks` — le planning
   * regarde d'autres jours qu'aujourd'hui.
   */
  function tasksDueOn(day: string) {
    const all = activeItems.value.filter((it) => it.type === 'task' && it.status !== 'done' && it.dueDate === day)
    return {
      priority: all.filter((it) => it.priority === 'high'),
      regular: all.filter((it) => it.priority !== 'high'),
      count: all.length,
    }
  }

  const doneTasks = computed(() =>
    activeItems.value
      .filter((it) => it.type === 'task' && it.status === 'done')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  )

  /** Tâches et notes archivées, la plus récemment mise de côté d'abord. */
  const archivedItems = computed(() =>
    state.items.filter((it) => it.archivedAt).sort((a, b) => (b.archivedAt as string).localeCompare(a.archivedAt as string)),
  )

  function addTask(input: {
    title: string
    content?: string | null
    folderId?: string | null
    priority?: Priority | null
    dueDate?: string | null
    status?: ItemStatus
  }): Item {
    const now = new Date().toISOString()
    const item: Item = {
      id: genId(),
      folderId: input.folderId ?? null,
      type: 'task',
      title: input.title.trim(),
      content: input.content ?? null,
      status: input.status ?? 'todo',
      priority: input.priority ?? null,
      dueDate: input.dueDate ?? null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    state.items.unshift(item)
    trackWrite(
      item.id,
      itemsApi.createItem(item).catch(() => {
        const idx = state.items.findIndex((it) => it.id === item.id)
        if (idx !== -1) state.items.splice(idx, 1)
        useToast().error("La création n'a pas pu être sauvegardée.")
      }),
    )
    return item
  }

  function addNote(input: { title: string; content?: string | null; folderId?: string | null }): Item {
    const now = new Date().toISOString()
    const item: Item = {
      id: genId(),
      folderId: input.folderId ?? null,
      type: 'note',
      title: input.title.trim(),
      content: input.content ?? null,
      status: 'todo',
      priority: null,
      dueDate: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    state.items.unshift(item)
    trackWrite(
      item.id,
      itemsApi.createItem(item).catch(() => {
        const idx = state.items.findIndex((it) => it.id === item.id)
        if (idx !== -1) state.items.splice(idx, 1)
        useToast().error("La création n'a pas pu être sauvegardée.")
      }),
    )
    return item
  }

  /* ------------------------------------------------------------- Liens --- */

  /**
   * Les deux sens de chaque lien, indexés par item. La base n'en range qu'un
   * (`itemId` < `linkedItemId`) ; l'affichage a besoin des deux.
   */
  const linksByItem = computed(() => {
    const map = new Map<string, string[]>()
    const push = (from: string, to: string) => {
      const list = map.get(from)
      if (list) list.push(to)
      else map.set(from, [to])
    }
    for (const link of state.links) {
      push(link.itemId, link.linkedItemId)
      push(link.linkedItemId, link.itemId)
    }
    return map
  })

  /** Nombre de liens d'un item, sans résoudre les items eux-mêmes. */
  function linkCount(id: string): number {
    return linksByItem.value.get(id)?.length ?? 0
  }

  /**
   * Items liés à `id`, notes d'abord : sur une tâche, ce sont elles qu'on
   * vient lire. Un lien dont l'autre bout a disparu du store est ignoré.
   */
  function linkedItems(id: string): Item[] {
    const ids = linksByItem.value.get(id)
    if (!ids) return []
    return ids
      .map((linkedId) => itemById.value.get(linkedId))
      .filter((it): it is Item => it !== undefined)
      .sort((a, b) =>
        a.type === b.type ? a.createdAt.localeCompare(b.createdAt) : a.type === 'note' ? -1 : 1,
      )
  }

  function areLinked(a: string, b: string): boolean {
    const [itemId, linkedItemId] = linksApi.orderPair(a, b)
    return state.links.some((l) => l.itemId === itemId && l.linkedItemId === linkedItemId)
  }

  function linkItems(a: string, b: string) {
    if (a === b || areLinked(a, b)) return
    const [itemId, linkedItemId] = linksApi.orderPair(a, b)
    const link: ItemLink = { itemId, linkedItemId, createdAt: new Date().toISOString() }
    state.links.push(link)

    function dropLink() {
      const idx = state.links.findIndex((l) => l.itemId === itemId && l.linkedItemId === linkedItemId)
      if (idx !== -1) state.links.splice(idx, 1)
    }

    // Une tâche et sa note viennent souvent d'être créées : le lien part une
    // fois les deux écrits. Si l'une n'a pas pris, elle a déjà disparu du
    // store — et prévenu —, alors le lien s'efface sans second message.
    trackWrite(
      linkKey(itemId, linkedItemId),
      Promise.all([written(itemId), written(linkedItemId)]).then(() => {
        const bothExist = state.items.some((it) => it.id === itemId) && state.items.some((it) => it.id === linkedItemId)
        if (!bothExist) {
          dropLink()
          return
        }
        return linksApi.createItemLink(link).catch(() => {
          dropLink()
          useToast().error("Le lien n'a pas pu être enregistré.")
        })
      }),
    )
  }

  function unlinkItems(a: string, b: string) {
    const [itemId, linkedItemId] = linksApi.orderPair(a, b)
    const idx = state.links.findIndex((l) => l.itemId === itemId && l.linkedItemId === linkedItemId)
    if (idx === -1) return
    const [removed] = state.links.splice(idx, 1)

    // Un lien défait dans la foulée de sa pose doit laisser l'insertion
    // arriver la première, sinon la suppression ne trouve rien à supprimer.
    void written(linkKey(itemId, linkedItemId)).then(() =>
      linksApi.deleteItemLink(removed).catch(() => {
        state.links.splice(idx, 0, removed)
        useToast().error("Le lien n'a pas pu être supprimé.")
      }),
    )
  }

  /**
   * Note créée pour un item existant : elle atterrit dans le dossier de cet
   * item, puis les deux sont liés.
   */
  function addLinkedNote(itemId: string, input: { title: string; content?: string | null }): Item | undefined {
    const target = itemById.value.get(itemId)
    if (!target) return undefined
    const note = addNote({ title: input.title, content: input.content ?? null, folderId: target.folderId })
    linkItems(itemId, note.id)
    return note
  }

  function addFolder(input: { name: string; color?: FolderColor; icon?: string }): Folder {
    const usedColors = new Set(state.folders.map((f) => f.color))
    const color =
      input.color ?? FOLDER_COLORS.find((c) => !usedColors.has(c)) ?? FOLDER_COLORS[state.folders.length % FOLDER_COLORS.length]
    const folder: Folder = {
      id: genId(),
      name: input.name.trim(),
      icon: input.icon ?? FOLDER_ICONS[state.folders.length % FOLDER_ICONS.length],
      color,
      // Un nouveau dossier se range en dernier.
      position: state.folders.length ? Math.max(...state.folders.map((f) => f.position)) + 1 : 0,
      createdAt: new Date().toISOString(),
    }
    state.folders.push(folder)
    foldersApi.createFolder(folder).catch(() => {
      const idx = state.folders.findIndex((f) => f.id === folder.id)
      if (idx !== -1) state.folders.splice(idx, 1)
      useToast().error("Le dossier n'a pas pu être créé.")
    })
    return folder
  }

  function updateItem(id: string, patch: Partial<Omit<Item, 'id' | 'createdAt'>>) {
    const item = state.items.find((it) => it.id === id)
    if (!item) return
    const snapshot = { ...item }
    Object.assign(item, patch, { updatedAt: new Date().toISOString() })
    itemsApi.updateItem(id, patch).catch(() => {
      const current = state.items.find((it) => it.id === id)
      if (current) Object.assign(current, snapshot)
      useToast().error("La modification n'a pas pu être sauvegardée.")
    })
  }

  function updateFolder(id: string, patch: Partial<Pick<Folder, 'name' | 'icon' | 'color'>>) {
    const folder = state.folders.find((f) => f.id === id)
    if (!folder) return
    const snapshot = { ...folder }
    Object.assign(folder, patch)
    foldersApi.updateFolder(id, patch).catch(() => {
      const current = state.folders.find((f) => f.id === id)
      if (current) Object.assign(current, snapshot)
      useToast().error("La modification du dossier n'a pas pu être sauvegardée.")
    })
  }

  /**
   * Range un dossier au rang `toIndex` — l'ordre affiché est celui du tableau,
   * donc c'est lui qu'on déplace, puis on renumérote tout le monde. Plus
   * simple à raisonner qu'un échange de positions, et ils sont peu nombreux.
   */
  function moveFolder(id: string, toIndex: number) {
    const from = state.folders.findIndex((f) => f.id === id)
    const to = Math.max(0, Math.min(toIndex, state.folders.length - 1))
    if (from === -1 || from === to) return

    const snapshot = state.folders.map((folder) => ({ id: folder.id, position: folder.position }))
    const ordered = state.folders.slice()
    ordered.splice(to, 0, ...ordered.splice(from, 1))

    const changed: Folder[] = []
    ordered.forEach((folder, index) => {
      if (folder.position === index) return
      folder.position = index
      changed.push(folder)
    })
    state.folders = ordered
    if (!changed.length) return

    // Un seul échec remet tout l'ordre d'avant : un rangement à moitié
    // enregistré serait plus déroutant qu'un rangement refusé.
    Promise.all(changed.map((folder) => foldersApi.updateFolder(folder.id, { position: folder.position }))).catch(
      () => {
        const previous = new Map(snapshot.map((entry) => [entry.id, entry.position]))
        for (const folder of state.folders) {
          const position = previous.get(folder.id)
          if (position !== undefined) folder.position = position
        }
        state.folders = state.folders
          .slice()
          .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
        useToast().error("L'ordre des dossiers n'a pas pu être enregistré.")
      },
    )
  }

  function toggleTaskDone(id: string) {
    const item = state.items.find((it) => it.id === id)
    if (!item) return
    const wasDone = item.status === 'done'
    item.status = wasDone ? 'todo' : 'done'
    item.updatedAt = new Date().toISOString()

    itemsApi.updateItem(id, { status: item.status }).catch(() => {
      const current = state.items.find((it) => it.id === id)
      if (current) current.status = wasDone ? 'done' : 'todo'
      useToast().error("Impossible d'enregistrer cette modification, réessaie.")
    })

    // Only reward completing a task, never un-completing one — the garden
    // never loses progress.
    if (!wasDone && item.type === 'task') {
      const today = new Date().toISOString().slice(0, 10)
      const remainingPriorityToday = state.items.some(
        (it) => it.type === 'task' && it.status !== 'done' && it.priority === 'high' && it.dueDate === today,
      )
      const wasLastPriorityToday = item.priority === 'high' && item.dueDate === today && !remainingPriorityToday
      useGarden().notifyTaskCompleted(wasLastPriorityToday)
    }
  }

  function moveItemToFolder(id: string, folderId: string | null) {
    updateItem(id, { folderId })
  }

  /**
   * Met de côté, sans toucher à `status` : une tâche en cours archivée le
   * reste, elle ne devient pas « faite » pour autant.
   */
  function archiveItem(id: string) {
    updateItem(id, { archivedAt: new Date().toISOString() })
  }

  function unarchiveItem(id: string) {
    updateItem(id, { archivedAt: null })
  }

  function removeItem(id: string) {
    const idx = state.items.findIndex((it) => it.id === id)
    if (idx === -1) return
    const [removed] = state.items.splice(idx, 1)
    // La base coupe les liens en cascade ; le store fait pareil, sinon ils
    // pointeraient dans le vide jusqu'au prochain chargement.
    const droppedLinks = state.links.filter((l) => l.itemId === id || l.linkedItemId === id)
    if (droppedLinks.length) {
      state.links = state.links.filter((l) => l.itemId !== id && l.linkedItemId !== id)
    }
    itemsApi.deleteItem(id).catch(() => {
      state.items.splice(idx, 0, removed)
      state.links.push(...droppedLinks)
      useToast().error("La suppression n'a pas pu être effectuée.")
    })
  }

  function removeFolder(id: string) {
    const affected = state.items.filter((it) => it.folderId === id).map((it) => it.id)
    for (const it of state.items) {
      if (it.folderId === id) it.folderId = null
    }
    const idx = state.folders.findIndex((f) => f.id === id)
    if (idx === -1) return
    const [removed] = state.folders.splice(idx, 1)
    foldersApi.deleteFolder(id).catch(() => {
      state.folders.splice(idx, 0, removed)
      for (const it of state.items) {
        if (affected.includes(it.id)) it.folderId = id
      }
      useToast().error("Le dossier n'a pas pu être supprimé.")
    })
  }

  function search(query: string) {
    const q = query.trim().toLowerCase()
    if (!q) return { tasks: [] as Item[], notes: [] as Item[], folders: [] as Folder[] }
    return {
      tasks: activeItems.value.filter((it) => it.type === 'task' && it.title.toLowerCase().includes(q)),
      notes: activeItems.value.filter((it) => it.type === 'note' && it.title.toLowerCase().includes(q)),
      folders: state.folders.filter((f) => f.name.toLowerCase().includes(q)),
    }
  }

  return {
    isLoading: computed(() => state.isLoading),
    loaded: computed(() => state.loaded),
    folders,
    items,
    getFolder,
    getItem,
    folderStats,
    folderTasks,
    folderNotes,
    inboxItems,
    quickNotes,
    todayTasks,
    allOpenTasks,
    tasksDueOn,
    doneTasks,
    archivedItems,
    addTask,
    addNote,
    addLinkedNote,
    addFolder,
    linkCount,
    linkedItems,
    areLinked,
    linkItems,
    unlinkItems,
    updateItem,
    updateFolder,
    moveFolder,
    toggleTaskDone,
    moveItemToFolder,
    archiveItem,
    unarchiveItem,
    removeItem,
    removeFolder,
    search,
    reload: load,
  }
}
