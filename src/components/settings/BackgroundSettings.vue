<script setup lang="ts">
import { computed, ref } from 'vue'
import { useBackground } from '@/composables/useBackground'
import { useToast } from '@/composables/useToast'
import { ACCEPTED_TYPES } from '@/services/backgrounds'

const background = useBackground()
const toast = useToast()

const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const urlDraft = ref(background.config.value.source === 'url' ? (background.config.value.url ?? '') : '')

const overlayPercent = computed({
  get: () => Math.round(background.config.value.overlay * 100),
  set: (value: number) => background.setOverlay(value / 100),
})

const tones = [
  { id: 'dark' as const, label: 'Texte foncé' },
  { id: 'light' as const, label: 'Texte blanc' },
]

function message(error: unknown): string {
  return error instanceof Error ? error.message : "L'opération a échoué."
}

async function onFilePicked(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // let the same file be re-picked after an error
  if (!file) return

  uploading.value = true
  try {
    await background.setFromFile(file)
    urlDraft.value = ''
    toast.push('Image de fond mise à jour.')
  } catch (error) {
    toast.error(message(error))
  } finally {
    uploading.value = false
  }
}

async function applyUrl() {
  if (!urlDraft.value.trim()) return
  try {
    await background.setFromUrl(urlDraft.value)
    toast.push('Image de fond mise à jour.')
  } catch (error) {
    toast.error(message(error))
  }
}

async function remove() {
  await background.clear()
  urlDraft.value = ''
  toast.push('Image de fond retirée.')
}
</script>

<template>
  <section class="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/[0.08]">
    <h2 class="font-display text-[15px] font-medium text-ink">🖼️ Image de fond</h2>
    <p class="mt-1 text-[12.5px] text-ink-soft">
      Une image affichée derrière toute l'application. Toi seule peux la changer, mais son adresse est
      publique : n'y mets rien de confidentiel.
    </p>

    <!-- Preview doubles as the empty state -->
    <div
      class="mt-4 relative h-36 overflow-hidden rounded-xl border border-line bg-paper"
      :style="background.config.value.url ? { backgroundImage: `url('${background.config.value.url}')`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined"
    >
      <div
        v-if="background.config.value.url"
        class="absolute inset-0 bg-paper"
        :style="{ opacity: background.config.value.overlay }"
      />
      <p
        v-else
        class="flex h-full items-center justify-center text-[12.5px] text-ink-faint"
      >
        Aucune image pour le moment
      </p>
    </div>

    <div class="mt-3 flex flex-wrap gap-2">
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        :accept="ACCEPTED_TYPES.join(',')"
        @change="onFilePicked"
      />
      <button
        type="button"
        :disabled="uploading"
        class="rounded-xl bg-lavender-500 px-3.5 py-2 text-[12.5px] font-medium text-white shadow-soft transition-colors hover:bg-lavender-600 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        @click="fileInput?.click()"
      >
        {{ uploading ? 'Envoi…' : 'Choisir une image' }}
      </button>
      <button
        v-if="background.hasImage.value"
        type="button"
        class="rounded-xl border border-line px-3.5 py-2 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-rose-300 hover:text-rose-500 cursor-pointer"
        @click="remove"
      >
        Retirer
      </button>
    </div>

    <label class="mt-4 block">
      <span class="text-[12px] font-medium text-ink-soft">…ou coller l'URL d'une image</span>
      <div class="mt-1 flex gap-1.5">
        <input
          v-model="urlDraft"
          type="url"
          placeholder="https://…"
          class="w-full rounded-xl border border-line bg-paper px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-lavender-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-lavender-100"
          @keydown.enter.prevent="applyUrl"
        />
        <button
          type="button"
          class="shrink-0 rounded-xl border border-line px-3 py-2 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-lavender-300 hover:text-lavender-600 cursor-pointer"
          @click="applyUrl"
        >
          Appliquer
        </button>
      </div>
    </label>

    <div v-if="background.hasBackground.value" class="mt-5 border-t border-line pt-4">
      <span class="text-[12px] font-medium text-ink-soft">Couleur du texte sur l'image</span>
      <p class="mt-1 text-[11.5px] leading-snug text-ink-faint">
        Concerne les titres posés directement sur l'image, sans carte derrière eux.
      </p>
      <div class="mt-2 flex gap-2">
        <button
          v-for="tone in tones"
          :key="tone.id"
          type="button"
          class="flex-1 rounded-xl border px-3 py-2 text-[12.5px] font-medium transition-colors cursor-pointer"
          :class="
            background.config.value.textTone === tone.id
              ? 'border-lavender-300 bg-lavender-50 text-lavender-700'
              : 'border-line text-ink-soft hover:border-lavender-300 hover:text-lavender-600'
          "
          @click="background.setTextTone(tone.id)"
        >
          {{ tone.label }}
        </button>
      </div>
    </div>

    <div class="mt-5 border-t border-line pt-4">
      <div class="flex items-baseline justify-between">
        <span class="text-[12px] font-medium text-ink-soft">Voile de lisibilité</span>
        <span class="text-[12px] tabular-nums text-ink-faint">{{ overlayPercent }} %</span>
      </div>
      <input
        v-model.number="overlayPercent"
        type="range"
        min="0"
        max="100"
        step="5"
        class="mt-2 w-full accent-lavender-500 cursor-pointer"
      />
      <p class="mt-1.5 text-[11.5px] leading-snug text-ink-faint">
        Plus le voile est fort, plus le texte est lisible et l'image discrète.
      </p>
    </div>
  </section>
</template>
