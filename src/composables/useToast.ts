import { reactive } from 'vue'

export interface Toast {
  id: string
  message: string
  tone: 'error' | 'info'
}

const state = reactive<{ toasts: Toast[] }>({ toasts: [] })

function genId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function useToast() {
  function push(message: string, tone: Toast['tone'] = 'info', durationMs = 4000) {
    const id = genId()
    state.toasts.push({ id, message, tone })
    window.setTimeout(() => {
      const idx = state.toasts.findIndex((t) => t.id === id)
      if (idx !== -1) state.toasts.splice(idx, 1)
    }, durationMs)
  }

  function error(message: string) {
    push(message, 'error')
  }

  function dismiss(id: string) {
    const idx = state.toasts.findIndex((t) => t.id === id)
    if (idx !== -1) state.toasts.splice(idx, 1)
  }

  return { state, push, error, dismiss }
}
