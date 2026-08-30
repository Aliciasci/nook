<script setup lang="ts">
// Les vidéos YouTube d'une page.
//
// Une page sans vidéo n'affiche qu'un bouton discret, comme « + Icône » : la
// section ne prend de la place que pour les pages qui en ont.
import { computed, nextTick, ref } from 'vue'
import type { DocPage } from '@/types'
import { useDocs } from '@/store/useDocs'
import { useToast } from '@/composables/useToast'
import { fetchVideoTitle, parseYouTubeUrl } from '@/utils/youtube'
import DocVideoCard from './DocVideoCard.vue'

const props = defineProps<{ page: DocPage }>()

const docs = useDocs()
const toast = useToast()

const formOpen = ref(false)
const urlInput = ref<HTMLInputElement>()
const url = ref('')

const videos = computed(() => props.page.videos)

async function openForm() {
  formOpen.value = true
  await nextTick()
  urlInput.value?.focus()
}

function closeForm() {
  formOpen.value = false
  url.value = ''
}

function submit() {
  const parsed = parseYouTubeUrl(url.value)
  if (!parsed) {
    toast.error("Ce lien YouTube n'est pas reconnu. Colle l'adresse de la vidéo, ou son identifiant.")
    return
  }
  if (videos.value.some((video) => video.videoId === parsed.videoId)) {
    toast.push('Cette vidéo est déjà sur la page.')
    closeForm()
    return
  }

  // Le titre arrive après coup : oEmbed ne doit pas retarder l'ajout, et il
  // peut échouer (vidéo privée, hors ligne) sans que ce soit bloquant.
  const added = docs.addVideo(props.page.id, { videoId: parsed.videoId, title: 'Vidéo YouTube', seconds: parsed.seconds })
  closeForm()
  if (!added) return
  void fetchVideoTitle(parsed.videoId).then((title) => {
    if (title) docs.renameVideo(props.page.id, added.id, title)
  })
}
</script>

<template>
  <div :class="videos.length ? 'mt-4' : 'mt-2'">
    <div v-if="videos.length" class="mb-2 flex items-center gap-2">
      <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        Vidéos ({{ videos.length }})
      </p>
      <button
        type="button"
        class="rounded-lg px-1.5 py-0.5 text-[12px] font-medium text-ink-faint transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
        @click="formOpen ? closeForm() : openForm()"
      >
        + Ajouter
      </button>
    </div>

    <button
      v-else-if="!formOpen"
      type="button"
      class="rounded-lg px-2 py-1 text-[13px] font-medium text-ink-faint transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
      @click="openForm"
    >
      + Vidéo YouTube
    </button>

    <form v-if="formOpen" class="mb-2 flex items-center gap-1.5" @submit.prevent="submit">
      <input
        ref="urlInput"
        v-model="url"
        type="text"
        placeholder="Colle un lien YouTube — le repère « t= » est repris s'il y en a un"
        class="min-w-0 flex-1 rounded-lg bg-white px-2.5 py-1.5 text-[13px] text-ink shadow-soft ring-1 ring-ink/[0.08] placeholder:text-ink-faint/70 focus:outline-none focus:ring-2 focus:ring-lavender-300"
        @keydown.esc="closeForm"
      />
      <button
        type="submit"
        class="rounded-lg bg-lavender-500 px-2.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-lavender-600 cursor-pointer"
      >
        Ajouter
      </button>
      <button
        type="button"
        class="rounded-lg px-2 py-1.5 text-[13px] text-ink-faint transition-colors hover:text-ink cursor-pointer"
        @click="closeForm"
      >
        Annuler
      </button>
    </form>

    <!-- Rangée de vignettes : elle se replie sur plusieurs lignes quand la
         colonne d'écriture est étroite. Une carte en lecture passe pleine
         largeur et prend donc sa propre ligne. -->
    <div v-if="videos.length" class="flex flex-wrap items-start gap-2">
      <DocVideoCard v-for="video in videos" :key="video.id" :page-id="page.id" :video="video" />
    </div>
  </div>
</template>
