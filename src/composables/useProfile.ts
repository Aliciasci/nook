import { computed, reactive, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { getProfile } from '@/services/profiles'

interface ProfileState {
  displayName: string | null
  avatarUrl: string | null
  loaded: boolean
}

const state = reactive<ProfileState>({ displayName: null, avatarUrl: null, loaded: false })

let loadToken = 0

async function load() {
  const token = ++loadToken
  try {
    const row = await getProfile()
    if (token !== loadToken) return
    state.displayName = row?.display_name ?? null
    state.avatarUrl = row?.avatar_url ?? null
  } catch {
    // Non-critical for app usability — the sidebar falls back to the email.
  } finally {
    if (token === loadToken) state.loaded = true
  }
}

function reset() {
  loadToken++
  state.displayName = null
  state.avatarUrl = null
  state.loaded = false
}

const auth = useAuth()
watch(
  auth.session,
  (session) => {
    if (session) void load()
    else reset()
  },
  { immediate: true },
)

export function useProfile() {
  const label = computed(() => state.displayName || auth.user.value?.email?.split('@')[0] || 'Toi')
  const initial = computed(() => label.value.charAt(0).toUpperCase())

  return { state, label, initial }
}
