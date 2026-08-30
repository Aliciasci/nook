import { computed, reactive } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  loginLoading: boolean
  registerLoading: boolean
  resetLoading: boolean
  error: string | null
}

const state = reactive<AuthState>({
  user: null,
  session: null,
  isLoading: true,
  loginLoading: false,
  registerLoading: false,
  resetLoading: false,
  error: null,
})

let initialized = false
let readyResolve: () => void
export const authReady = new Promise<void>((resolve) => {
  readyResolve = resolve
})

function applySession(session: Session | null) {
  state.session = session
  state.user = session?.user ?? null
}

function init() {
  if (initialized) return
  initialized = true

  supabase.auth.getSession().then(({ data }) => {
    applySession(data.session)
    state.isLoading = false
    readyResolve()
  })

  supabase.auth.onAuthStateChange((_event, session) => {
    applySession(session)
    state.isLoading = false
  })
}

function mapAuthError(message: string): string {
  const known: Record<string, string> = {
    'Invalid login credentials': 'Email ou mot de passe incorrect.',
    'User already registered': 'Un compte existe déjà avec cet email.',
    'Email not confirmed': 'Confirme ton email avant de te connecter — vérifie ta boîte de réception.',
    'Password should be at least 6 characters': 'Le mot de passe doit contenir au moins 6 caractères.',
}
  return known[message] ?? message
}

export function useAuth() {
  init()

  async function login(email: string, password: string): Promise<{ ok: boolean }> {
    state.error = null
    state.loginLoading = true
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        state.error = mapAuthError(error.message)
        return { ok: false }
      }
      applySession(data.session)
      return { ok: true }
    } finally {
      state.loginLoading = false
    }
  }

  async function register(
    input: { displayName: string; email: string; password: string },
  ): Promise<{ ok: boolean; needsEmailConfirmation: boolean }> {
    state.error = null
    state.registerLoading = true
    try {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: { data: { display_name: input.displayName.trim() } },
      })
      if (error) {
        state.error = mapAuthError(error.message)
        return { ok: false, needsEmailConfirmation: false }
      }
      if (data.session) {
        applySession(data.session)
        return { ok: true, needsEmailConfirmation: false }
      }
      // Project has "confirm email" on: no session until the user clicks the
      // email link, so there's nothing to auto-login with yet.
      return { ok: true, needsEmailConfirmation: true }
    } finally {
      state.registerLoading = false
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    applySession(null)
  }

  async function resetPassword(email: string): Promise<{ ok: boolean }> {
    state.error = null
    state.resetLoading = true
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) {
        state.error = mapAuthError(error.message)
        return { ok: false }
      }
      return { ok: true }
    } finally {
      state.resetLoading = false
    }
  }

  async function updatePassword(newPassword: string): Promise<{ ok: boolean }> {
    state.error = null
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      state.error = mapAuthError(error.message)
      return { ok: false }
    }
    return { ok: true }
  }

  function clearError() {
    state.error = null
  }

  return {
    state,
    user: computed(() => state.user),
    session: computed(() => state.session),
    isAuthenticated: computed(() => Boolean(state.user)),
    isLoading: computed(() => state.isLoading),
    login,
    register,
    logout,
    resetPassword,
    updatePassword,
    clearError,
  }
}
