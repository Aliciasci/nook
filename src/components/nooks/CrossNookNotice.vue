<script setup lang="ts">
/**
 * Le nook actif n'est pas dans l'URL : un lien `/folder/<id>` ou `/docs/<id>`
 * mis en favori, ou envoyé à soi-même, désigne un contenu qui peut très bien
 * appartenir à un autre nook. Le store, lui, ne charge que le nook ouvert et
 * ne le trouve donc pas.
 *
 * Plutôt qu'une page blanche, on demande à la base à quel nook appartient cet
 * identifiant et on propose d'y aller. Une fois la bascule faite, le store
 * recharge et la vue affiche le contenu — sans changer d'URL.
 */
import { computed, ref, watch } from 'vue'
import { useNooks } from '@/composables/useNooks'
import { nookOf } from '@/services/nooks'

const props = defineProps<{
  kind: 'folder' | 'doc_page'
  id: string
  /**
   * Le store a fini de charger. Sans cette garde, on conclurait « introuvable »
   * pendant le chargement normal du nook courant.
   */
  ready: boolean
}>()

const nooks = useNooks()

type Status = 'checking' | 'elsewhere' | 'missing'
const status = ref<Status>('checking')
const targetNookId = ref<string | null>(null)
const switching = ref(false)

const targetNook = computed(() => nooks.nooks.value.find((n) => n.id === targetNookId.value) ?? null)

const label = computed(() => (props.kind === 'folder' ? 'Ce dossier' : 'Cette page'))

watch(
  () => [props.id, props.ready] as const,
  async ([id, ready]) => {
    if (!ready || !id) {
      status.value = 'checking'
      return
    }
    status.value = 'checking'
    targetNookId.value = null
    try {
      const nookId = await nookOf(props.kind, id)
      // La réponse peut arriver après une navigation vers un autre contenu.
      if (id !== props.id) return
      if (!nookId || nookId === nooks.activeId.value) {
        status.value = 'missing'
        return
      }
      targetNookId.value = nookId
      status.value = 'elsewhere'
    } catch {
      status.value = 'missing'
    }
  },
  { immediate: true },
)

async function go() {
  if (!targetNookId.value) return
  switching.value = true
  try {
    await nooks.switchTo(targetNookId.value)
  } finally {
    switching.value = false
  }
}
</script>

<template>
  <div class="page-sheet mx-auto max-w-lg px-8 py-16">
    <div v-if="status === 'checking'" class="text-center text-[13.5px] text-ink-faint">Un instant…</div>

    <div
      v-else-if="status === 'elsewhere' && targetNook"
      class="rounded-2xl bg-white p-7 text-center shadow-soft ring-1 ring-ink/[0.08]"
    >
      <span class="text-[32px] leading-none">{{ targetNook.icon ?? '🏡' }}</span>
      <h1 class="mt-3 font-display text-[17px] font-medium tracking-tight text-ink">
        {{ label }} est dans un autre nook
      </h1>
      <p class="mt-1.5 text-[13.5px] leading-snug text-ink-soft">
        Ce lien pointe vers « {{ targetNook.name }} ». Tu es actuellement dans
        « {{ nooks.active.value?.name }} ».
      </p>
      <button
        type="button"
        :disabled="switching"
        class="mt-5 rounded-xl bg-lavender-500 px-4 py-2 text-[13px] font-medium text-white shadow-soft transition-colors hover:bg-lavender-600 disabled:opacity-50 cursor-pointer"
        @click="go"
      >
        {{ switching ? 'Bascule…' : `Aller dans « ${targetNook.name} »` }}
      </button>
    </div>

    <div v-else class="rounded-2xl bg-white p-7 text-center shadow-soft ring-1 ring-ink/[0.08]">
      <h1 class="font-display text-[17px] font-medium tracking-tight text-ink">Introuvable</h1>
      <p class="mt-1.5 text-[13.5px] leading-snug text-ink-soft">
        {{ label }} n'existe plus — il a peut-être été supprimé.
      </p>
      <RouterLink
        to="/"
        class="mt-5 inline-block rounded-xl border border-line px-4 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:border-lavender-300 hover:text-lavender-600"
      >
        Retour à l'accueil
      </RouterLink>
    </div>
  </div>
</template>
