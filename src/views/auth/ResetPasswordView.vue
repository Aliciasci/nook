<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import AuthCard from '@/components/auth/AuthCard.vue'

const password = ref('')
const confirmPassword = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)
const done = ref(false)

const auth = useAuth()
const router = useRouter()

async function onSubmit() {
  error.value = null
  if (password.value.length < 6) {
    error.value = 'Le mot de passe doit contenir au moins 6 caractères.'
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = 'Les mots de passe ne correspondent pas.'
    return
  }
  submitting.value = true
  try {
    const { ok } = await auth.updatePassword(password.value)
    if (!ok) {
      error.value = auth.state.error ?? 'Une erreur est survenue.'
      return
    }
    done.value = true
    window.setTimeout(() => router.push('/'), 1500)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthCard title="Choisis un nouveau mot de passe">
    <div v-if="done" class="flex flex-col items-center gap-3 py-2 text-center">
      <span class="text-3xl">✨</span>
      <p class="text-[13.5px] text-ink">Mot de passe mis à jour — redirection…</p>
    </div>

    <div v-else-if="!auth.isAuthenticated.value" class="flex flex-col items-center gap-3 py-2 text-center">
      <p class="text-[13.5px] text-ink-soft">
        Ce lien n'est plus valide ou a expiré. Redemande un email de réinitialisation.
      </p>
      <RouterLink
        to="/forgot-password"
        class="mt-1 rounded-xl bg-lavender-500 px-3.5 py-2 text-[12.5px] font-medium text-white shadow-soft hover:bg-lavender-600"
      >
        Redemander un lien
      </RouterLink>
    </div>

    <form v-else class="flex flex-col gap-3.5" @submit.prevent="onSubmit">
      <label class="block">
        <span class="text-[12px] font-medium text-ink-soft">Nouveau mot de passe</span>
        <input
          v-model="password"
          type="password"
          autocomplete="new-password"
          placeholder="Au moins 6 caractères"
          class="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-lavender-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-lavender-100"
        />
      </label>

      <label class="block">
        <span class="text-[12px] font-medium text-ink-soft">Confirmer le mot de passe</span>
        <input
          v-model="confirmPassword"
          type="password"
          autocomplete="new-password"
          placeholder="••••••••"
          class="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-lavender-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-lavender-100"
        />
      </label>

      <p v-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-[12.5px] font-medium text-rose-600">{{ error }}</p>

      <button
        type="submit"
        :disabled="submitting"
        class="mt-1.5 rounded-xl bg-lavender-500 px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-soft transition-all hover:bg-lavender-600 hover:shadow-soft-lg active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
      >
        {{ submitting ? 'Enregistrement…' : 'Enregistrer' }}
      </button>
    </form>
  </AuthCard>
</template>
