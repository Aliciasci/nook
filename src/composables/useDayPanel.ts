import { reactive, watch } from 'vue'

const STORAGE_KEY = 'nook:daypanel:v1'

function loadOpen(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw !== null) return JSON.parse(raw) === true
  } catch {
    // fall through to default
  }
  return true
}

const state = reactive({ isOpen: loadOpen() })

watch(
  () => state.isOpen,
  (value) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  },
)

export function useDayPanel() {
  function open() {
    state.isOpen = true
  }
  function close() {
    state.isOpen = false
  }
  return { state, open, close }
}
