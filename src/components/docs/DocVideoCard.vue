<script setup lang="ts">
// Une vidéo épinglée à la page.
//
// Au repos, la carte est une vignette : l'aperçu 16:9 de la vidéo avec son
// avancement, posée dans la rangée avec les autres. Au clic, le lecteur
// YouTube prend la place de l'image — et la carte passe pleine largeur, sinon
// on regarderait un cours dans un timbre-poste. Le lecteur reprend au repère
// enregistré et le tient à jour : le relevé est temporisé pendant la lecture,
// et forcé dès qu'on met en pause, qu'on referme, ou qu'on quitte la page.
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import type { DocVideo } from '@/types'
import { useDocs } from '@/store/useDocs'
import { useToast } from '@/composables/useToast'
import { useYouTubeApi, YT_STATE, type YouTubePlayer } from '@/composables/useYouTubeApi'
import { formatTimestamp, parseTimestamp, thumbnailUrl, watchUrl } from '@/utils/youtube'
import IconPlaySolid from '@/icons/IconPlaySolid.vue'
import IconX from '@/icons/IconX.vue'
import IconTrash from '@/icons/IconTrash.vue'

const props = defineProps<{ pageId: string; video: DocVideo }>()

const docs = useDocs()
const toast = useToast()
const youtube = useYouTubeApi()

/** Relevé de la position pendant la lecture, et écriture au plus tous les 20 s. */
const POLL_MS = 1000
const PERSIST_EVERY_MS = 20_000

const open = ref(false)
const loading = ref(false)
const hostEl = ref<HTMLElement>()
const position = ref(props.video.seconds)

// `maxresdefault` n'existe pas pour toutes les vidéos : on retombe sur
// `hqdefault`, une seule fois, sinon l'erreur d'image tournerait en boucle.
const thumbSrc = ref(thumbnailUrl(props.video.videoId, 'max'))

function onThumbError() {
  const fallback = thumbnailUrl(props.video.videoId, 'hq')
  if (thumbSrc.value !== fallback) thumbSrc.value = fallback
}

let player: YouTubePlayer | null = null
let poll: number | undefined
let lastPersist = 0

// Lecteur fermé, c'est le store qui fait foi (une autre session a pu avancer).
const seconds = computed(() => (open.value ? position.value : props.video.seconds))

const progress = computed(() => {
  if (!props.video.duration) return 0
  return Math.min(100, (seconds.value / props.video.duration) * 100)
})

const playLabel = computed(() =>
  seconds.value ? `Reprendre à ${formatTimestamp(seconds.value)}` : 'Lire la vidéo',
)

/* -------------------------------------------------------------- Lecteur --- */

/** Le lecteur jette tant qu'il n'est pas prêt : la position reste inconnue. */
function currentTime(): number | null {
  try {
    const value = player?.getCurrentTime()
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

function persist(force = false) {
  const time = currentTime()
  if (time === null) return
  position.value = Math.floor(time)
  const now = Date.now()
  if (!force && now - lastPersist < PERSIST_EVERY_MS) return
  lastPersist = now
  docs.setVideoTime(props.pageId, props.video.id, position.value, force)
}

function startPoll() {
  if (poll) return
  poll = window.setInterval(() => persist(), POLL_MS)
}

function stopPoll() {
  if (!poll) return
  window.clearInterval(poll)
  poll = undefined
}

function onState(state: number) {
  if (state === YT_STATE.PLAYING) {
    startPoll()
    return
  }
  if (state === YT_STATE.PAUSED || state === YT_STATE.ENDED) {
    stopPoll()
    persist(true)
  }
}

function teardown() {
  stopPoll()
  try {
    player?.destroy()
  } catch {
    /* l'iframe a déjà disparu : rien à démonter */
  }
  player = null
}

async function openPlayer() {
  if (open.value) return
  open.value = true
  loading.value = true
  await nextTick()
  try {
    const api = await youtube.load()
    // Le chargement est asynchrone : on a pu refermer entre-temps.
    if (!open.value || !hostEl.value) return
    player = new api.Player(hostEl.value, {
      // Pas de cookie tant que rien n'est lu.
      host: 'https://www.youtube-nocookie.com',
      videoId: props.video.videoId,
      width: '100%',
      height: '100%',
      playerVars: {
        start: Math.max(0, Math.floor(position.value)),
        autoplay: 1,
        rel: 0,
        playsinline: 1,
      },
      events: {
        onReady: (event) => {
          loading.value = false
          const duration = Math.floor(event.target.getDuration())
          if (duration > 0) docs.setVideoDuration(props.pageId, props.video.id, duration)
        },
        onStateChange: (event) => onState(event.data),
      },
    })
  } catch {
    open.value = false
    loading.value = false
    toast.error("Le lecteur YouTube n'a pas pu être chargé. Le lien reste ouvrable dans un onglet.")
  }
}

function closePlayer() {
  persist(true)
  teardown()
  open.value = false
  loading.value = false
}

onBeforeUnmount(() => {
  persist(true)
  teardown()
})

/* ---------------------------------------------------------------- Titre --- */

const editingTitle = ref(false)
const titleDraft = ref('')

function startTitleEdit() {
  titleDraft.value = props.video.title
  editingTitle.value = true
}

function commitTitle() {
  editingTitle.value = false
  const next = titleDraft.value.trim()
  if (next && next !== props.video.title) docs.renameVideo(props.pageId, props.video.id, next)
}

/* --------------------------------------------------------------- Repère --- */

const editingTime = ref(false)
const timeDraft = ref('')

function startTimeEdit() {
  timeDraft.value = formatTimestamp(seconds.value)
  editingTime.value = true
}

/** Saisir le repère à la main sert quand on a suivi le cours ailleurs. */
function commitTime() {
  editingTime.value = false
  const parsed = parseTimestamp(timeDraft.value)
  if (parsed === null) {
    toast.error('Repère non reconnu — attendu « 12:34 », « 1:02:03 », ou un nombre de secondes.')
    return
  }
  position.value = parsed
  docs.setVideoTime(props.pageId, props.video.id, parsed, true)
  lastPersist = Date.now()
  try {
    player?.seekTo(parsed, true)
  } catch {
    /* lecteur pas encore prêt : `start` s'en chargera au prochain lancement */
  }
}
</script>

<template>
  <div
    class="rounded-xl bg-white p-1.5 shadow-soft ring-1 ring-ink/[0.08]"
    :class="open ? 'w-full' : 'w-[188px]'"
  >
    <!-- Aperçu, remplacé par le lecteur au clic -->
    <div class="doc-video-frame relative aspect-video w-full overflow-hidden rounded-lg bg-ink">
      <template v-if="open">
        <div ref="hostEl" class="h-full w-full" />
        <p
          v-if="loading"
          class="pointer-events-none absolute inset-0 flex items-center justify-center text-[12.5px] text-paper/70"
        >
          Chargement du lecteur…
        </p>
        <button
          type="button"
          class="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-lg bg-ink/60 text-white transition-colors hover:bg-ink/85 cursor-pointer"
          title="Refermer le lecteur"
          aria-label="Refermer le lecteur"
          @click="closePlayer"
        >
          <IconX class="h-3.5 w-3.5" />
        </button>
      </template>

      <button
        v-else
        type="button"
        class="group/thumb absolute inset-0 h-full w-full cursor-pointer"
        :title="playLabel"
        :aria-label="playLabel"
        @click="openPlayer"
      >
        <img
          :src="thumbSrc"
          alt=""
          loading="lazy"
          class="h-full w-full object-cover transition-transform duration-300 group-hover/thumb:scale-[1.03]"
          @error="onThumbError"
        />
        <span class="absolute inset-0 bg-ink/15 transition-colors group-hover/thumb:bg-ink/30" />
        <span class="absolute inset-0 flex items-center justify-center">
          <span
            class="flex h-9 w-9 items-center justify-center rounded-full bg-ink/65 text-white shadow-soft-lg transition-transform group-hover/thumb:scale-110"
          >
            <IconPlaySolid class="ml-0.5 h-4 w-4" />
          </span>
        </span>

        <!-- Avancement : le lecteur affiche le sien, celui-ci n'a de sens
             que sur l'aperçu. -->
        <span v-if="video.duration" class="absolute inset-x-0 bottom-0 block h-1 bg-white/25">
          <span class="block h-full bg-lavender-400" :style="{ width: `${progress}%` }" />
        </span>
      </button>
    </div>

    <!-- Titre et repère -->
    <div class="mt-1.5">
      <input
        v-if="editingTitle"
        v-model="titleDraft"
        class="w-full rounded-md bg-paper px-1.5 py-0.5 text-[12px] font-medium text-ink focus:outline-none focus:ring-2 focus:ring-lavender-300"
        @blur="commitTitle"
        @keydown.enter.prevent="commitTitle"
        @keydown.esc="editingTitle = false"
      />
      <button
        v-else
        type="button"
        class="block w-full truncate text-left text-[12px] font-medium leading-snug text-ink hover:text-lavender-600 cursor-pointer"
        :title="`${video.title} — cliquer pour renommer`"
        @click="startTitleEdit"
      >
        {{ video.title }}
      </button>

      <div class="mt-1 flex items-center gap-1">
        <input
          v-if="editingTime"
          v-model="timeDraft"
          class="w-16 rounded-md bg-paper px-1 py-0.5 text-[11px] tabular-nums text-ink focus:outline-none focus:ring-2 focus:ring-lavender-300"
          placeholder="12:34"
          @blur="commitTime"
          @keydown.enter.prevent="commitTime"
          @keydown.esc="editingTime = false"
        />
        <button
          v-else
          type="button"
          class="min-w-0 truncate rounded-md bg-lavender-50 px-1 py-0.5 text-[11px] tabular-nums text-lavender-700 transition-colors hover:bg-lavender-100 cursor-pointer"
          :title="`${playLabel} — cliquer pour modifier le repère`"
          @click="startTimeEdit"
        >
          {{ formatTimestamp(seconds) }}<template v-if="video.duration"> / {{ formatTimestamp(video.duration) }}</template>
        </button>

        <a
          :href="watchUrl(video.videoId, seconds)"
          target="_blank"
          rel="noreferrer noopener"
          title="Ouvrir sur YouTube"
          class="ml-auto flex h-5 w-5 items-center justify-center rounded-md text-[12px] leading-none text-ink-faint transition-colors hover:bg-lavender-50 hover:text-ink-soft"
        >
          ↗
        </a>

        <button
          type="button"
          class="flex h-5 w-5 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-rose-50 hover:text-rose-500 cursor-pointer"
          title="Retirer cette vidéo de la page"
          aria-label="Retirer cette vidéo de la page"
          @click="docs.removeVideo(pageId, video.id)"
        >
          <IconTrash class="h-3 w-3" />
        </button>
      </div>
    </div>
  </div>
</template>
