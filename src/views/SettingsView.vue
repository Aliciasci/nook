<script setup lang="ts">
import { computed, ref } from 'vue'
import { useWorkSchedule } from '@/composables/useWorkSchedule'
import { useSpotify } from '@/composables/useSpotify'
import { useTheme } from '@/composables/useTheme'
import { useUiState } from '@/composables/useUiState'
import { useStore } from '@/store/useStore'
import { useToast } from '@/composables/useToast'
import { seedDemoData } from '@/services/seed'
import PageHeader from '@/components/common/PageHeader.vue'
import BackgroundSettings from '@/components/settings/BackgroundSettings.vue'
import BackgroundColorSettings from '@/components/settings/BackgroundColorSettings.vue'
import ActivityColorSettings from '@/components/settings/ActivityColorSettings.vue'
import NookSettingsSection from '@/components/nooks/NookSettingsSection.vue'

const { schedule } = useWorkSchedule()
const spotify = useSpotify()
const theme = useTheme()
const { openThemePicker } = useUiState()
const store = useStore()
const toast = useToast()

const isDev = import.meta.env.DEV
const seeding = ref(false)
async function loadDemoData() {
  seeding.value = true
  try {
    await seedDemoData()
    await store.reload()
    toast.push('Données de démo ajoutées à ton compte.')
  } catch {
    toast.error("Le chargement des données de démo a échoué.")
  } finally {
    seeding.value = false
  }
}

const activeThemeMeta = computed(() => {
  const id = theme.state.themeId === 'custom' ? theme.state.customTheme.baseTheme : theme.state.themeId
  return theme.themes.find((t) => t.id === id) ?? theme.themes[0]
})

const fields: { key: keyof typeof schedule; label: string }[] = [
  { key: 'startTime', label: 'Début de journée' },
  { key: 'lunchStart', label: 'Début pause déjeuner' },
  { key: 'lunchEnd', label: 'Fin pause déjeuner' },
  { key: 'endTime', label: 'Fin de journée' },
]

const clientIdDraft = ref(spotify.clientId.value)
const copied = ref(false)

function saveClientId() {
  spotify.setClientId(clientIdDraft.value)
}

async function copyRedirectUri() {
  await navigator.clipboard.writeText(spotify.redirectUri)
  copied.value = true
  window.setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="page-sheet mx-auto max-w-xl px-8 py-9">
    <PageHeader title="Paramètres" subtitle="Personnalise Nook selon tes habitudes." />

    <NookSettingsSection />

    <section class="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/[0.08]">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h2 class="font-display text-[15px] font-medium text-ink">🎨 Personnaliser mon espace</h2>
          <p class="mt-1 text-[12.5px] text-ink-soft">
            Thème actuel :
            <span class="font-medium text-ink">{{ activeThemeMeta.emoji }} {{ activeThemeMeta.label }}</span>
            <span v-if="theme.state.themeId === 'custom'" class="text-ink-faint"> (personnalisé)</span>
          </p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-xl bg-lavender-500 px-3.5 py-2 text-[12.5px] font-medium text-white shadow-soft transition-colors hover:bg-lavender-600 cursor-pointer"
          @click="openThemePicker"
        >
          Ouvrir
        </button>
      </div>
    </section>

    <BackgroundColorSettings />
    <BackgroundSettings />
    <ActivityColorSettings />

    <section class="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/[0.08]">
      <h2 class="font-display text-[15px] font-medium text-ink">Horaires de travail</h2>
      <p class="mt-1 text-[12.5px] text-ink-soft">Utilisés par le panneau « Ma journée ».</p>

      <div class="mt-4 grid grid-cols-2 gap-4">
        <label v-for="field in fields" :key="field.key" class="block">
          <span class="text-[12px] font-medium text-ink-soft">{{ field.label }}</span>
          <input
            v-model="schedule[field.key]"
            type="time"
            class="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-[13.5px] text-ink focus:border-lavender-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-lavender-100"
          />
        </label>
      </div>
    </section>

    <section class="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/[0.08]">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="font-display text-[15px] font-medium text-ink">🎧 Spotify</h2>
          <p class="mt-1 text-[12.5px] text-ink-soft">Voir et contrôler ta musique sans quitter Nook.</p>
        </div>
        <span
          class="rounded-full px-2.5 py-1 text-[11px] font-semibold"
          :class="
            spotify.state.status === 'connected'
              ? 'bg-lavender-100 text-lavender-700'
              : 'bg-ink/[0.06] text-ink-faint'
          "
        >
          {{ spotify.state.status === 'connected' ? 'Connecté' : 'Non connecté' }}
        </span>
      </div>

      <!-- Client ID already configured for this deployment: nothing for a regular visitor to set up. -->
      <p v-if="spotify.isClientIdFromEnv.value" class="mt-4 text-[12.5px] text-ink-faint">
        Spotify est déjà configuré pour cette app — connecte simplement ton compte.
      </p>

      <!-- No env-level Client ID (local dev, or self-hosted without one set): let this browser configure one. -->
      <template v-else>
        <label class="mt-4 block">
          <span class="text-[12px] font-medium text-ink-soft">Client ID Spotify</span>
          <input
            v-model="clientIdDraft"
            type="text"
            placeholder="Colle ici le Client ID de ton app Spotify"
            class="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-lavender-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-lavender-100"
            @blur="saveClientId"
            @keydown.enter="saveClientId"
          />
        </label>

        <label class="mt-3 block">
          <span class="text-[12px] font-medium text-ink-soft">URI de redirection à déclarer dans ton app Spotify</span>
          <div class="mt-1 flex gap-1.5">
            <input
              :value="spotify.redirectUri"
              type="text"
              readonly
              class="w-full rounded-xl border border-line bg-paper px-3 py-2 text-[12.5px] text-ink-faint"
            />
            <button
              type="button"
              class="shrink-0 rounded-xl border border-line px-3 py-2 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-lavender-300 hover:text-lavender-600 cursor-pointer"
              @click="copyRedirectUri"
            >
              {{ copied ? 'Copié ✓' : 'Copier' }}
            </button>
          </div>
        </label>

        <p class="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
          Crée une app sur
          <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener" class="text-lavender-600 hover:underline">
            developer.spotify.com
          </a>
          , colle son Client ID ci-dessus, puis ajoute l'URI de redirection dans les paramètres de cette app.
          <br />
          Pour un déploiement public, préfère la variable d'environnement
          <code class="rounded bg-paper px-1 py-0.5 text-[11px]">VITE_SPOTIFY_CLIENT_ID</code>
          : tous les visiteurs pourront alors se connecter directement, sans configurer quoi que ce soit ici.
        </p>
      </template>

      <div class="mt-4 flex gap-2">
        <button
          v-if="spotify.state.status !== 'connected'"
          type="button"
          class="rounded-xl bg-lavender-500 px-3.5 py-2 text-[12.5px] font-medium text-white shadow-soft transition-colors hover:bg-lavender-600 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          :disabled="!spotify.isConfigured.value"
          @click="spotify.connect"
        >
          Se connecter
        </button>
        <button
          v-else
          type="button"
          class="rounded-xl border border-line px-3.5 py-2 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-rose-300 hover:text-rose-500 cursor-pointer"
          @click="spotify.disconnect"
        >
          Se déconnecter
        </button>
      </div>

      <div class="mt-5 border-t border-line pt-4">
        <label class="block">
          <span class="text-[12px] font-medium text-ink-soft">Playlist Focus (optionnel)</span>
          <input
            :value="spotify.focusPlaylistUri.value"
            type="text"
            placeholder="spotify:playlist:…"
            class="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-lavender-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-lavender-100"
            @change="spotify.setFocusPlaylistUri(($event.target as HTMLInputElement).value)"
          />
        </label>
        <p class="mt-1.5 text-[11.5px] leading-snug text-ink-faint">
          Réservé pour une future version du Mode Focus, qui pourra lancer cette playlist automatiquement.
        </p>
      </div>
    </section>

    <section v-if="isDev" class="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/[0.08]">
      <h2 class="font-display text-[15px] font-medium text-ink">🧪 Données de démo</h2>
      <p class="mt-1 text-[12.5px] text-ink-soft">
        Outil de développement — ajoute le jeu de données de démonstration de Nook à <em>ton</em> compte, pour tester
        rapidement l'app avec du contenu.
      </p>
      <button
        type="button"
        :disabled="seeding"
        class="mt-3 rounded-xl border border-line px-3.5 py-2 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-lavender-300 hover:text-lavender-600 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        @click="loadDemoData"
      >
        {{ seeding ? 'Chargement…' : 'Charger les données de démo' }}
      </button>
    </section>
  </div>
</template>
