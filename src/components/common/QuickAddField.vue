<script setup lang="ts">
import { ref } from 'vue'
import IconPlus from '@/icons/IconPlus.vue'

withDefaults(defineProps<{ placeholder?: string; disabled?: boolean; maxlength?: number }>(), {
  placeholder: 'Ajouter rapidement…',
  disabled: false,
  maxlength: undefined,
})

const emit = defineEmits<{ submit: [value: string] }>()

const value = ref('')
const focused = ref(false)

function submit() {
  const text = value.value.trim()
  if (!text) return
  emit('submit', text)
  value.value = ''
}
</script>

<template>
  <!-- Champ de saisie rapide. Il portait un trait pointillé très pâle et un
       texte d'invite en gris clair : deux choses discrètes l'une sur l'autre,
       invisibles sur une feuille posée par-dessus un fond d'écran. Le fond
       teinté et le « + » dans sa pastille lui donnent la présence d'un champ,
       sans crier.

       La présentation vit ici et le câblage chez l'appelant : `InlineQuickAdd`
       le branche sur le store, la check-list de l'accueil sur ses propres
       lignes, qui ne sont pas des items. -->
  <div
    class="flex items-center gap-2.5 rounded-xl border border-dashed px-3 py-2.5 transition-all duration-200"
    :class="[
      focused
        ? 'border-lavender-400 bg-lavender-50/70 shadow-soft'
        : 'border-ink/[0.14] bg-ink/[0.02] hover:border-lavender-300 hover:bg-lavender-50/50',
      disabled ? 'pointer-events-none opacity-50' : '',
    ]"
  >
    <span
      class="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full transition-colors"
      :class="focused ? 'bg-lavender-500 text-white' : 'bg-lavender-100 text-lavender-600'"
    >
      <IconPlus class="h-3 w-3" />
    </span>
    <input
      v-model="value"
      type="text"
      :placeholder="placeholder"
      :disabled="disabled"
      :maxlength="maxlength"
      class="w-full bg-transparent text-[13.5px] text-ink placeholder:text-ink-soft focus:outline-none"
      @focus="focused = true"
      @blur="focused = false"
      @keydown.enter="submit"
    />
  </div>
</template>
