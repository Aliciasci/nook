<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNooks } from '@/composables/useNooks'
import { useProfile } from '@/composables/useProfile'
import { openTaskCountByNook } from '@/services/nooks'
import NookEditModal from '@/components/nooks/NookEditModal.vue'
import IconPlus from '@/icons/IconPlus.vue'

const router = useRouter()
const route = useRoute()
const nooks = useNooks()
const profile = useProfile()

const counts = ref<Map<string, number>>(new Map())
const createOpen = ref(false)
const entering = ref<string | null>(null)

onMounted(async () => {
  try {
    counts.value = await openTaskCountByNook()
  } catch {
    // Le compteur est un confort : sans lui les cartes restent utilisables.
  }
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return 'Bonne nuit'
  if (hour < 12) return 'Bonjour'
  if (hour < 18) return 'Bon après-midi'
  return 'Bonsoir'
})

function taskLabel(nookId: string): string {
  const n = counts.value.get(nookId) ?? 0
  if (n === 0) return 'Rien en attente'
  return n === 1 ? '1 tâche ouverte' : `${n} tâches ouvertes`
}

async function enter(id: string) {
  if (entering.value) return
  entering.value = id
  try {
    await nooks.switchTo(id)
    nooks.markPickedThisSession()
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect)
  } finally {
    entering.value = null
  }
}

async function onCreate(value: { name: string; icon: string | null; withStarterFolders: boolean }) {
  createOpen.value = false
  const id = await nooks.create(value)
  if (id) await enter(id)
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-paper px-4 py-12">
    <div class="w-full max-w-2xl">
      <div class="mb-10 text-center">
        <h1 class="font-display text-[26px] font-medium tracking-tight text-ink">
          {{ greeting }}{{ profile.state.displayName ? `, ${profile.state.displayName}` : '' }}
        </h1>
        <p class="mt-1.5 text-[14px] text-ink-soft">Où va-t-on aujourd'hui ?</p>
      </div>

      <div v-if="nooks.isLoading.value" class="flex justify-center py-10">
        <div class="h-6 w-6 animate-spin rounded-full border-2 border-lavender-200 border-t-lavender-500" />
      </div>

      <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <button
          v-for="nook in nooks.nooks.value"
          :key="nook.id"
          type="button"
          :disabled="entering !== null"
          class="group flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl bg-white p-5 shadow-folder ring-1 ring-ink/[0.04] transition-all duration-200 hover:-translate-y-1 hover:shadow-soft-lg disabled:cursor-wait disabled:opacity-60 cursor-pointer"
          :class="entering === nook.id ? 'ring-2 ring-lavender-300' : ''"
          @click="enter(nook.id)"
        >
          <span class="text-[36px] leading-none transition-transform duration-200 group-hover:scale-110">
            {{ nook.icon ?? '🏡' }}
          </span>
          <span class="mt-1 line-clamp-2 text-center text-[14px] font-medium text-ink">{{ nook.name }}</span>
          <span class="text-[12px] text-ink-faint">{{ taskLabel(nook.id) }}</span>
        </button>

        <button
          type="button"
          :disabled="entering !== null"
          class="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/10 p-5 text-ink-faint transition-all duration-200 hover:-translate-y-1 hover:border-lavender-300 hover:text-lavender-600 disabled:cursor-wait cursor-pointer"
          @click="createOpen = true"
        >
          <IconPlus class="h-6 w-6" />
          <span class="text-[13px] font-medium">Nouveau nook</span>
        </button>
      </div>

      <p class="mt-9 text-center text-[12.5px] text-ink-faint">
        Chaque nook a ses dossiers, sa documentation, son thème et son jardin.
      </p>
    </div>

    <NookEditModal :open="createOpen" @close="createOpen = false" @submit="onCreate" />
  </div>
</template>
