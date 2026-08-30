import { computed, reactive } from 'vue'

interface ScopeState {
  isSelecting: boolean
  selectedIds: Set<string>
}

const scopes = new Map<string, ScopeState>()
const active = reactive<{ key: string | null }>({ key: null })

function ensureScope(key: string): ScopeState {
  let scope = scopes.get(key)
  if (!scope) {
    scope = reactive({ isSelecting: false, selectedIds: new Set<string>() })
    scopes.set(key, scope)
  }
  return scope
}

function deactivateScope(key: string) {
  const scope = scopes.get(key)
  if (!scope) return
  scope.isSelecting = false
  scope.selectedIds.clear()
}

/** Ends selection mode everywhere, regardless of scope (used on route change). */
export function clearAllSelections() {
  for (const key of scopes.keys()) deactivateScope(key)
  active.key = null
}

/**
 * Selection mode is scoped per list (e.g. "home-inbox", "home-notes", "todo")
 * so turning it on in one widget never bleeds into another. Only one scope
 * can be actively selecting at a time — starting a new one clears the last.
 */
export function useSelection(scopeKey = 'default') {
  const scope = ensureScope(scopeKey)

  function toggleSelecting() {
    if (scope.isSelecting) {
      clear()
      return
    }
    if (active.key && active.key !== scopeKey) deactivateScope(active.key)
    scope.isSelecting = true
    active.key = scopeKey
  }

  function clear() {
    scope.isSelecting = false
    scope.selectedIds.clear()
    if (active.key === scopeKey) active.key = null
  }

  function toggle(id: string) {
    if (scope.selectedIds.has(id)) scope.selectedIds.delete(id)
    else scope.selectedIds.add(id)
  }

  function isSelected(id: string) {
    return scope.selectedIds.has(id)
  }

  const count = computed(() => scope.selectedIds.size)

  return { state: scope, toggleSelecting, clear, toggle, isSelected, count }
}

/** Read-only view of whichever scope is currently active, for the floating action bar. */
export function useActiveSelection() {
  const selectedIds = computed(() => (active.key ? ensureScope(active.key).selectedIds : new Set<string>()))
  const count = computed(() => selectedIds.value.size)

  function clear() {
    if (active.key) deactivateScope(active.key)
    active.key = null
  }

  return { selectedIds, count, clear }
}
