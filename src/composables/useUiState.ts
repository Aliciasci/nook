import { reactive } from 'vue'
import type { Item, ItemType } from '@/types'

type QuickCreateMode = ItemType | 'folder'

interface UiState {
  quickCreateOpen: boolean
  quickCreateMode: QuickCreateMode
  quickCreateFolderId: string | null
  /** L'item ouvert dans le panneau de détail. */
  detailItemId: string | null
  /** Le panneau est-il en formulaire plutôt qu'en lecture ? */
  detailEditing: boolean
  searchOpen: boolean
  editFolderId: string | null
  themePickerOpen: boolean
}

const state = reactive<UiState>({
  quickCreateOpen: false,
  quickCreateMode: 'task',
  quickCreateFolderId: null,
  detailItemId: null,
  detailEditing: false,
  searchOpen: false,
  editFolderId: null,
  themePickerOpen: false,
})

export function useUiState() {
  /** Le modal ne sert qu'à créer. Modifier se fait dans le panneau de détail. */
  function openQuickCreate(mode: QuickCreateMode = 'task', folderId: string | null = null) {
    state.quickCreateMode = mode
    state.quickCreateFolderId = folderId
    state.quickCreateOpen = true
  }
  function closeQuickCreate() {
    state.quickCreateOpen = false
  }
  /** Ouvre le panneau de détail en lecture. */
  function openItemDetail(item: Item) {
    state.detailItemId = item.id
    state.detailEditing = false
  }
  /**
   * Ouvre le panneau directement en formulaire — c'est ce que fait « Modifier »,
   * dans le menu ⋯ comme dans le panneau lui-même. Il n'y a jamais deux calques
   * empilés : lire et modifier se passent au même endroit.
   */
  function openEditItem(item: Item) {
    state.detailItemId = item.id
    state.detailEditing = true
  }
  function setDetailEditing(editing: boolean) {
    state.detailEditing = editing
  }
  function closeItemDetail() {
    state.detailItemId = null
    state.detailEditing = false
  }
  function openSearch() {
    state.searchOpen = true
  }
  function closeSearch() {
    state.searchOpen = false
  }
  function openEditFolder(folderId: string) {
    state.editFolderId = folderId
  }
  function closeEditFolder() {
    state.editFolderId = null
  }
  function openThemePicker() {
    state.themePickerOpen = true
  }
  function closeThemePicker() {
    state.themePickerOpen = false
  }
  return {
    state,
    openQuickCreate,
    closeQuickCreate,
    openItemDetail,
    openEditItem,
    setDetailEditing,
    closeItemDetail,
    openSearch,
    closeSearch,
    openEditFolder,
    closeEditFolder,
    openThemePicker,
    closeThemePicker,
  }
}
