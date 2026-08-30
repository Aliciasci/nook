<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import AuthCard from '@/components/auth/AuthCard.vue'

const email = ref('')
const password = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)

const auth = useAuth()
const router = useRouter()
const route = useRoute()

async function onSubmit() {
  error.value = null
  if (!email.value.trim() || !password.value) {
    error.value = 'Renseigne ton email et ton mot de passe.'
    return
  }
  submitting.value = true
  try {
    const { ok } = await auth.login(email.value.trim(), password.value)
    if (!ok) {
      error.value = auth.state.error ?? 'Une erreur est survenue.'
      return
    }
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.push(redirect)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthCard title="Content de te revoir" subtitle="Connecte-toi pour retrouver ton espace.">
    <form class="flex flex-col gap-3.5" @submit.prevent="onSubmit">
      <label class="block">
        <span class="text-[12px] font-medium text-ink-soft">Email</span>
        <input
          v-model="email"
          type="email"
          autocomplete="email"
          placeholder="toi@exemple.com"
          class="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-lavender-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-lavender-100"
        />
      </label>

      <label class="block">
        <div class="flex items-center justify-between">
          <span class="text-[12px] font-medium text-ink-soft">Mot de passe</span>
          <RouterLink to="/forgot-password" class="text-[12px] font-medium text-lavender-600 hover:underline">
            Mot de passe oublié ?
          </RouterLink>
        </div>
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
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
        {{ submitting ? 'Connexion…' : 'Se connecter' }}
      </button>
    </form>

    <template #footer>
      Pas encore de compte ?
      <RouterLink to="/register" class="font-medium text-lavender-600 hover:underline">Créer un compte</RouterLink>
    </template>
  </AuthCard>
</template>
