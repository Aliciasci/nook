<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import AuthCard from '@/components/auth/AuthCard.vue'

const displayName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)
const needsEmailConfirmation = ref(false)

const auth = useAuth()
const router = useRouter()

async function onSubmit() {
  error.value = null
  if (!displayName.value.trim() || !email.value.trim() || !password.value) {
    error.value = 'Remplis tous les champs.'
    return
  }
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
    const { ok, needsEmailConfirmation: needsConfirm } = await auth.register({
      displayName: displayName.value,
      email: email.value.trim(),
      password: password.value,
    })
    if (!ok) {
      error.value = auth.state.error ?? 'Une erreur est survenue.'
      return
    }
    if (needsConfirm) {
      needsEmailConfirmation.value = true
      return
    }
    router.push('/')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthCard title="Bienvenue dans Nook" subtitle="Crée ton compte pour démarrer ton espace personnel.">
    <div v-if="needsEmailConfirmation" class="flex flex-col items-center gap-3 py-2 text-center">
      <span class="text-3xl">📬</span>
      <p class="text-[13.5px] text-ink">
        Compte créé ! Vérifie ta boîte mail (<strong>{{ email }}</strong
        >) pour confirmer ton adresse avant de te connecter.
      </p>
      <RouterLink
        to="/login"
        class="mt-1 rounded-xl bg-lavender-500 px-3.5 py-2 text-[12.5px] font-medium text-white shadow-soft hover:bg-lavender-600"
      >
        Aller à la connexion
      </RouterLink>
    </div>

    <form v-else class="flex flex-col gap-3.5" @submit.prevent="onSubmit">
      <label class="block">
        <span class="text-[12px] font-medium text-ink-soft">Prénom / nom d'affichage</span>
        <input
          v-model="displayName"
          type="text"
          autocomplete="name"
          placeholder="Alicia"
          class="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-lavender-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-lavender-100"
        />
      </label>

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
        <span class="text-[12px] font-medium text-ink-soft">Mot de passe</span>
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
        {{ submitting ? 'Création…' : 'Créer mon compte' }}
      </button>
    </form>

    <template #footer>
      <template v-if="!needsEmailConfirmation">
        Déjà un compte ?
        <RouterLink to="/login" class="font-medium text-lavender-600 hover:underline">Se connecter</RouterLink>
      </template>
    </template>
  </AuthCard>
</template>
