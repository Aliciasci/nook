<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import Modal from '@/components/common/Modal.vue'
import type { Nook } from '@/types'
import IconX from '@/icons/IconX.vue'

const props = defineProps<{
  open: boolean
  /** Absent = création. Présent = modification de ce nook. */
  nook?: Nook | null
}>()

const emit = defineEmits<{
  close: []
  submit: [value: { name: string; icon: string | null; withStarterFolders: boolean }]
}>()

// Deux registres d'espaces plutôt que la palette des dossiers : on nomme ici
// un pan de sa vie, pas un rangement.
const emojiOptions = [
  '🏡', '🏢', '💼', '🎓', '🌿', '🎨', '🚀', '🔬',
  '📚', '🧪', '🎬', '🎸', '⚽', '🧘', '✈️', '🍳',
  '💜', '⭐', '🌙', '☀️', '🔥', '🌊', '🗻', '🧭',
]

const name = ref('')
const icon = ref<string>('🏡')
const withStarterFolders = ref(true)
const nameInput = ref<HTMLInputElement>()

const isEdit = computed(() => Boolean(props.nook))
const canSubmit = computed(() => name.value.trim().length > 0)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    name.value = props.nook?.name ?? ''
    icon.value = props.nook?.icon ?? '🏡'
    withStarterFolders.value = true
    void nextTick(() => nameInput.value?.focus())
  },
  { immediate: true },
)

function submit() {
  if (!canSubmit.value) return
  emit('submit', {
    name: name.value.trim(),
    icon: icon.value,
    withStarterFolders: withStarterFolders.value,
  })
}
</script>

<template>
  <Modal :open="open" @close="emit('close')">
    <div class="rounded-2xl bg-white p-5 shadow-soft-lg ring-1 ring-ink/5">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="font-display text-[15px] font-medium text-ink">
          {{ isEdit ? `Modifier « ${nook?.name} »` : 'Nouveau nook' }}
        </h2>
        <button
          type="button"
          class="rounded-full p-1 text-ink-faint transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
          @click="emit('close')"
        >
          <IconX class="h-4 w-4" />
        </button>
      </div>

      <div class="flex items-center justify-center">
        <div
          class="flex h-16 w-16 items-center justify-center rounded-2xl bg-folder-lavender text-[30px] shadow-folder"
        >
          {{ icon }}
        </div>
      </div>

      <form class="mt-5" @submit.prevent="submit">
        <label class="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint" for="nook-name">
          Nom
        </label>
        <input
          id="nook-name"
          ref="nameInput"
          v-model="name"
          type="text"
          maxlength="40"
          placeholder="Pro, Perso, Thèse…"
          class="mt-2 w-full rounded-xl bg-paper px-3.5 py-2.5 text-[14px] text-ink outline-none ring-1 ring-ink/[0.08] transition-shadow placeholder:text-ink-faint focus:ring-2 focus:ring-lavender-300"
        />

        <p class="mt-5 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Icône</p>
        <div class="mt-2 grid grid-cols-8 gap-1.5">
          <button
            v-for="e in emojiOptions"
            :key="e"
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-xl text-[18px] transition-colors cursor-pointer"
            :class="icon === e ? 'bg-lavender-100 ring-2 ring-lavender-300' : 'hover:bg-paper'"
            @click="icon = e"
          >
            {{ e }}
          </button>
        </div>

        <label
          v-if="!isEdit"
          class="mt-5 flex cursor-pointer items-start gap-2.5 rounded-xl bg-paper p-3 ring-1 ring-ink/[0.06]"
        >
          <input v-model="withStarterFolders" type="checkbox" class="mt-0.5 h-4 w-4 accent-lavender-500 cursor-pointer" />
          <span class="text-[12.5px] leading-snug text-ink-soft">
            Créer les dossiers de départ (Inbox, À voir, Idées).
            <span class="block text-ink-faint">Un nook vide part d'une page blanche.</span>
          </span>
        </label>

        <div class="mt-5 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-xl px-3.5 py-2 text-[13px] font-medium text-ink-faint hover:bg-lavender-50 cursor-pointer"
            @click="emit('close')"
          >
            Annuler
          </button>
          <button
            type="submit"
            :disabled="!canSubmit"
            class="rounded-xl bg-lavender-500 px-4 py-2 text-[13px] font-medium text-white shadow-soft transition-colors hover:bg-lavender-600 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            {{ isEdit ? 'Enregistrer' : 'Créer le nook' }}
          </button>
        </div>
      </form>
    </div>
  </Modal>
</template>
