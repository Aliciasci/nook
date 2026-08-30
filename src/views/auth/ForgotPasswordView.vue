<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import AuthCard from '@/components/auth/AuthCard.vue'

const email = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)
const sent = ref(false)

const auth = useAuth()

async function onSubmit() {
  error.value = null
  if (!email.value.trim()) {
    error.value = 'Renseigne ton email.'
    return
  }
  submitting.value = true
  try {
    const { ok } = await auth.resetPassword(email.value.trim())
    if (!ok) {
      error.value = auth.state.error ?? 'Une erreur est survenue.'
      return
    }
    sent.value = true
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthCard title="Mot de passe oublié ?" subtitle="On t'envoie un lien pour en choisir un nouveau.">
    <div v-if="sent" class="flex flex-col items-center gap-3 py-2 text-center">
      <span class="text-3xl">📬</span>
      <p class="text-[13.5px] text-ink">
        Si un compte existe pour <strong>{{ email }}</strong
        >, un email vient d'être envoyé avec un lien de réinitialisation.
      </p>
    </div>

    <form v-else class="flex flex-col gap-3.5" @submit.prevent="onSubmit">
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

      <p v-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-[12.5px] font-medium text-rose-600">{{ error }}</p>

      <button
        type="submit"
        :disabled="submitting"
        class="mt-1.5 rounded-xl bg-lavender-500 px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-soft transition-all hover:bg-lavender-600 hover:shadow-soft-lg active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
      >
        {{ submitting ? 'Envoi…' : 'Envoyer le lien' }}
      </button>
    </form>

    <template #footer>
      <RouterLink to="/login" class="font-medium text-lavender-600 hover:underline">Retour à la connexion</RouterLink>
    </template>
  </AuthCard>
</template>
