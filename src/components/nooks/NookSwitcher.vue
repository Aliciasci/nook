<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useNooks } from '@/composables/useNooks'

defineProps<{ collapsed: boolean }>()

const router = useRouter()
const nooks = useNooks()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false
}
onMounted(() => window.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => window.removeEventListener('mousedown', onDocClick))

async function pick(id: string) {
  open.value = false
  await nooks.switchTo(id)
  // Les vues de détail montrent un dossier ou une page du nook qu'on vient de
  // quitter : leur identifiant n'existe pas dans le nouveau. On rentre à
  // l'accueil, qui a du sens dans n'importe quel nook.
  const name = router.currentRoute.value.name
  if (name === 'folder' || name === 'doc-page') await router.push('/')
}

/** Repasser par l'écran de choix, comme au démarrage. */
function backToPicker() {
  open.value = false
  nooks.forgetPickedThisSession()
  void router.push({ name: 'nook-picker' })
}
</script>

<template>
  <div ref="root" class="relative" :class="collapsed ? 'mt-3' : 'mt-3 px-1'">
    <button
      type="button"
      :title="collapsed ? (nooks.active.value?.name ?? 'Nook') : undefined"
      class="flex w-full items-center gap-2 rounded-xl py-1.5 text-left transition-colors hover:bg-lavender-50 cursor-pointer"
      :class="collapsed ? 'justify-center px-0' : 'px-2'"
      @click="open = !open"
    >
      <span class="text-[15px] leading-none">{{ nooks.active.value?.icon ?? '🏡' }}</span>
      <span v-if="!collapsed" class="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink-soft">
        {{ nooks.active.value?.name ?? 'Nook' }}
      </span>
      <svg
        v-if="!collapsed"
        viewBox="0 0 20 20"
        class="h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform"
        :class="open ? 'rotate-180' : ''"
        fill="none"
      >
        <path d="M6 8.5 10 12.5 14 8.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <Transition name="pop">
      <div
        v-if="open"
        class="absolute left-0 top-[calc(100%+0.375rem)] z-30 rounded-xl bg-white p-1.5 shadow-soft-lg ring-1 ring-ink/[0.08]"
        :class="collapsed ? 'w-52' : 'w-full min-w-[13rem]'"
      >
        <button
          v-for="nook in nooks.nooks.value"
          :key="nook.id"
          type="button"
          class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors hover:bg-lavender-50 cursor-pointer"
          :class="nook.id === nooks.activeId.value ? 'text-lavender-700' : 'text-ink-soft hover:text-ink'"
          @click="pick(nook.id)"
        >
          <span class="text-[14px] leading-none">{{ nook.icon ?? '🏡' }}</span>
          <span class="min-w-0 flex-1 truncate">{{ nook.name }}</span>
          <svg
            v-if="nook.id === nooks.activeId.value"
            viewBox="0 0 20 20"
            class="h-3.5 w-3.5 shrink-0"
            fill="none"
          >
            <path d="m5 10.5 3.2 3.2L15 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <div class="my-1 h-px bg-line" />

        <button
          type="button"
          class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-ink-soft transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
          @click="backToPicker"
        >
          <span class="w-[14px] text-center text-[13px] leading-none">⇄</span>
          <span>Changer de nook…</span>
        </button>
        <RouterLink
          to="/settings"
          class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-ink-soft transition-colors hover:bg-lavender-50 hover:text-ink"
          @click="open = false"
        >
          <span class="w-[14px] text-center text-[13px] leading-none">⚙</span>
          <span>Gérer les nooks</span>
        </RouterLink>
      </div>
    </Transition>
  </div>
</template>
