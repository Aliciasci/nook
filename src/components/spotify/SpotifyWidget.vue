<script setup lang="ts">
import { computed } from 'vue'
import { useSpotify } from '@/composables/useSpotify'
import IconSkipBack from '@/icons/IconSkipBack.vue'
import IconSkipForward from '@/icons/IconSkipForward.vue'
import IconPlaySolid from '@/icons/IconPlaySolid.vue'
import IconPauseSolid from '@/icons/IconPauseSolid.vue'

const spotify = useSpotify()

const progressPercent = computed(() => {
  const p = spotify.state.playback
  if (!p?.track || !p.track.durationMs) return 0
  return Math.min(100, (p.progressMs / p.track.durationMs) * 100)
})

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function togglePlayback() {
  if (spotify.state.playback?.isPlaying) spotify.pause()
  else spotify.play()
}
</script>

<template>
  <div class="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/[0.08]">
    <!-- Disconnected -->
    <div v-if="spotify.state.status === 'disconnected'" class="text-center">
      <p class="text-[22px] leading-none">🎧</p>
      <p class="mt-2 text-[13px] font-medium text-ink">Connecter Spotify</p>
      <p class="mt-1 text-[11.5px] leading-snug text-ink-faint">
        Écouter ma musique directement depuis Nook.
      </p>
      <button
        v-if="spotify.isConfigured.value"
        type="button"
        class="mt-3 rounded-xl bg-lavender-500 px-3.5 py-2 text-[12.5px] font-medium text-white shadow-soft transition-colors hover:bg-lavender-600 cursor-pointer"
        @click="spotify.connect"
      >
        Se connecter
      </button>
      <RouterLink
        v-else
        to="/settings"
        class="mt-3 inline-block rounded-xl border border-line px-3.5 py-2 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-lavender-300 hover:text-lavender-600"
      >
        Configurer dans les paramètres
      </RouterLink>
    </div>

    <!-- Connecting -->
    <div v-else-if="spotify.state.status === 'connecting'" class="flex items-center gap-3">
      <div class="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-lavender-100" />
      <div class="flex-1 space-y-1.5">
        <div class="h-2.5 w-2/3 animate-pulse rounded-full bg-lavender-100" />
        <div class="h-2 w-2/5 animate-pulse rounded-full bg-lavender-100" />
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="spotify.state.status === 'error'" class="text-center">
      <p class="text-[22px] leading-none">🎧</p>
      <p class="mt-2 text-[12.5px] font-medium text-ink-soft">
        {{ spotify.state.errorMessage ?? 'Connexion Spotify indisponible.' }}
      </p>
      <button
        type="button"
        class="mt-3 rounded-xl border border-line px-3.5 py-2 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-lavender-300 hover:text-lavender-600 cursor-pointer"
        @click="spotify.connect"
      >
        Réessayer
      </button>
    </div>

    <!-- Connected -->
    <div v-else>
      <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">🎧 Now playing</p>

      <template v-if="spotify.state.playback?.track">
        <div class="mt-3 flex items-center gap-3">
          <img
            v-if="spotify.state.playback.track.albumArtUrl"
            :src="spotify.state.playback.track.albumArtUrl"
            :alt="spotify.state.playback.track.albumName"
            class="h-11 w-11 shrink-0 rounded-xl object-cover shadow-soft"
          />
          <div v-else class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lavender-100 text-lg">
            🎵
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[13px] font-medium text-ink" :title="spotify.state.playback.track.name">
              {{ spotify.state.playback.track.name }}
            </p>
            <p class="truncate text-[11.5px] text-ink-faint" :title="spotify.state.playback.track.artist">
              {{ spotify.state.playback.track.artist }}
            </p>
          </div>
        </div>

        <div class="mt-3">
          <div class="h-1 w-full overflow-hidden rounded-full bg-line">
            <div
              class="h-full rounded-full bg-lavender-400 transition-[width] duration-1000 ease-linear"
              :style="{ width: progressPercent + '%' }"
            />
          </div>
          <div class="mt-1 flex items-center justify-between text-[10px] font-medium text-ink-faint">
            <span>{{ formatMs(spotify.state.playback.progressMs) }}</span>
            <span>{{ formatMs(spotify.state.playback.track.durationMs) }}</span>
          </div>
        </div>

        <div class="mt-3 flex items-center justify-center gap-4">
          <button
            type="button"
            title="Précédent"
            class="text-ink-faint transition-colors hover:text-lavender-600 cursor-pointer"
            @click="spotify.previous"
          >
            <IconSkipBack class="h-4 w-4" />
          </button>
          <button
            type="button"
            :title="spotify.state.playback.isPlaying ? 'Pause' : 'Lecture'"
            class="flex h-8 w-8 items-center justify-center rounded-full bg-lavender-500 text-white shadow-soft transition-colors hover:bg-lavender-600 cursor-pointer"
            @click="togglePlayback"
          >
            <IconPauseSolid v-if="spotify.state.playback.isPlaying" class="h-3.5 w-3.5" />
            <IconPlaySolid v-else class="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Suivant"
            class="text-ink-faint transition-colors hover:text-lavender-600 cursor-pointer"
            @click="spotify.next"
          >
            <IconSkipForward class="h-4 w-4" />
          </button>
        </div>
      </template>

      <template v-else>
        <div class="mt-3 text-center">
          <p class="text-[12.5px] text-ink-faint">Rien en écoute actuellement.</p>
          <a
            href="https://open.spotify.com"
            target="_blank"
            rel="noopener"
            class="mt-2 inline-block text-[11.5px] font-medium text-lavender-600 hover:underline"
          >
            Ouvrir Spotify
          </a>
        </div>
      </template>
    </div>
  </div>
</template>
