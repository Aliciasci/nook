<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Nook } from '@/types'
import { useNooks } from '@/composables/useNooks'
import { useToast } from '@/composables/useToast'
import NookEditModal from '@/components/nooks/NookEditModal.vue'
import IconPlus from '@/icons/IconPlus.vue'
import IconPencil from '@/icons/IconPencil.vue'
import IconTrash from '@/icons/IconTrash.vue'

const router = useRouter()
const nooks = useNooks()
const toast = useToast()

const editing = ref<Nook | null>(null)
const createOpen = ref(false)
/** Le nook dont la suppression attend une confirmation. */
const confirming = ref<string | null>(null)
const busy = ref(false)

const isOnlyNook = computed(() => nooks.nooks.value.length <= 1)

function openEdit(nook: Nook) {
  confirming.value = null
  editing.value = nook
}

/* ----------------------------------------------- Rangement des nooks --- */

// Glisser-déposer natif, comme les dossiers de l'accueil et les blocs de la
// documentation. La liste est verticale : c'est l'ordonnée du pointeur qui dit
// de quel côté de la ligne survolée l'insertion se ferait.
const dragIndex = ref<number | null>(null)
const dropIndex = ref<number | null>(null)

function onDragStart(index: number, e: DragEvent) {
  // Une confirmation de suppression ouverte déplacerait la ligne sous le
  // pointeur au moment précis où on vise une place.
  confirming.value = null
  dragIndex.value = index
  // Firefox n'amorce pas un glisser sans données attachées.
  e.dataTransfer?.setData('text/plain', nooks.nooks.value[index]?.id ?? '')
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(index: number, e: DragEvent) {
  if (dragIndex.value === null) return
  e.preventDefault()
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  dropIndex.value = e.clientY < rect.top + rect.height / 2 ? index : index + 1
}

function onDrop() {
  const from = dragIndex.value
  let to = dropIndex.value
  dragIndex.value = null
  dropIndex.value = null
  if (from === null || to === null) return
  // `to` compte les places avant retrait de la ligne glissée.
  if (to > from) to -= 1
  const nook = nooks.nooks.value[from]
  if (nook) nooks.moveNook(nook.id, to)
}

function onDragEnd() {
  dragIndex.value = null
  dropIndex.value = null
}

async function onSubmit(value: { name: string; icon: string | null; withStarterFolders: boolean }) {
  busy.value = true
  try {
    if (editing.value) {
      await nooks.rename(editing.value.id, { name: value.name, icon: value.icon })
      editing.value = null
      return
    }
    const id = await nooks.create(value)
    createOpen.value = false
    if (id) toast.push(`Le nook « ${value.name} » est prêt.`)
  } finally {
    busy.value = false
  }
}

async function confirmRemove(nook: Nook) {
  busy.value = true
  try {
    const wasActive = nook.id === nooks.activeId.value
    const ok = await nooks.remove(nook.id)
    confirming.value = null
    if (!ok) return
    toast.push(`« ${nook.name} » a été supprimé.`)
    // On était dedans : la vue courante montre peut-être un dossier qui vient
    // de disparaître avec lui.
    if (wasActive) await router.push('/')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="mt-7 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/[0.08]">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="font-display text-[15px] font-medium text-ink">🗄️ Mes nooks</h2>
        <p class="mt-1 text-[12.5px] text-ink-soft">
          Chaque nook est un espace complet : ses dossiers, ses tâches, sa documentation, son thème et son jardin.
          Rien ne passe de l'un à l'autre.
        </p>
      </div>
      <button
        type="button"
        class="flex shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-lavender-300 hover:text-lavender-600 cursor-pointer"
        @click="createOpen = true"
      >
        <IconPlus class="h-3.5 w-3.5" />
        Nouveau
      </button>
    </div>

    <ul class="mt-4 flex flex-col gap-1.5" @dragend="onDragEnd" @drop="onDrop">
      <li
        v-for="(nook, index) in nooks.nooks.value"
        :key="nook.id"
        class="group/nook relative rounded-xl px-3 py-2.5 ring-1 transition-colors"
        :class="[
          nook.id === nooks.activeId.value ? 'bg-lavender-50/60 ring-lavender-200' : 'ring-ink/[0.06]',
          dragIndex === index ? 'opacity-40' : '',
        ]"
        @dragover="onDragOver(index, $event)"
      >
        <!-- Trait d'insertion, dans la gouttière entre deux lignes. -->
        <div
          v-if="dragIndex !== null && dropIndex === index"
          class="pointer-events-none absolute -top-1 left-2 right-2 z-10 h-0.5 rounded-full bg-lavender-400"
        />

        <div class="flex items-center gap-2">
          <button
            v-if="!isOnlyNook"
            type="button"
            draggable="true"
            title="Glisser pour ranger"
            aria-label="Glisser pour ranger ce nook"
            class="-ml-1 shrink-0 rounded-md px-1 py-1 text-ink-faint opacity-0 transition-opacity hover:bg-lavender-50 hover:text-ink-soft group-hover/nook:opacity-100 focus-visible:opacity-100 cursor-grab active:cursor-grabbing"
            @dragstart="onDragStart(index, $event)"
            @dragend="onDragEnd"
          >
            <svg viewBox="0 0 10 16" class="h-3.5 w-2.5" fill="currentColor" aria-hidden="true">
              <circle cx="2" cy="3" r="1.3" />
              <circle cx="8" cy="3" r="1.3" />
              <circle cx="2" cy="8" r="1.3" />
              <circle cx="8" cy="8" r="1.3" />
              <circle cx="2" cy="13" r="1.3" />
              <circle cx="8" cy="13" r="1.3" />
            </svg>
          </button>
          <span class="text-[18px] leading-none">{{ nook.icon ?? '🏡' }}</span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[13.5px] font-medium text-ink">{{ nook.name }}</p>
            <p v-if="nook.id === nooks.activeId.value" class="text-[11.5px] text-lavender-600">Nook ouvert</p>
          </div>

          <button
            type="button"
            title="Renommer"
            aria-label="Renommer ce nook"
            class="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
            @click="openEdit(nook)"
          >
            <IconPencil class="h-4 w-4" />
          </button>
          <button
            type="button"
            :disabled="isOnlyNook"
            :title="isOnlyNook ? 'Il faut au moins un nook' : 'Supprimer'"
            aria-label="Supprimer ce nook"
            class="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-faint cursor-pointer"
            @click="confirming = confirming === nook.id ? null : nook.id"
          >
            <IconTrash class="h-4 w-4" />
          </button>
        </div>

        <div v-if="confirming === nook.id" class="mt-2.5 rounded-xl bg-rose-50 p-3 ring-1 ring-rose-200">
          <p class="text-[12.5px] leading-snug text-rose-700">
            Supprimer « {{ nook.name }} » efface définitivement ses dossiers, ses tâches, ses notes, sa documentation
            et son jardin. C'est irréversible.
          </p>
          <div class="mt-2.5 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-ink-faint hover:bg-white cursor-pointer"
              @click="confirming = null"
            >
              Annuler
            </button>
            <button
              type="button"
              :disabled="busy"
              class="rounded-lg bg-rose-600 px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
              @click="confirmRemove(nook)"
            >
              Supprimer définitivement
            </button>
          </div>
        </div>

        <div
          v-if="dragIndex !== null && dropIndex === index + 1"
          class="pointer-events-none absolute -bottom-1 left-2 right-2 z-10 h-0.5 rounded-full bg-lavender-400"
        />
      </li>
    </ul>

    <p v-if="!isOnlyNook" class="mt-2.5 px-1 text-[11.5px] text-ink-faint">
      Glisse une ligne par sa poignée pour changer l'ordre — celui de l'écran de choix et du sélecteur.
    </p>

    <NookEditModal :open="createOpen" @close="createOpen = false" @submit="onSubmit" />
    <NookEditModal :open="editing !== null" :nook="editing" @close="editing = null" @submit="onSubmit" />
  </section>
</template>
