<script setup lang="ts">
/**
 * L'aide de la page, sous la grille.
 *
 * Elle était un paragraphe gris posé sous la grille, sans carte — le seul
 * texte de l'app dans ce cas. La voici en bandeau, refermable : les gestes de
 * la grille ne s'apprennent qu'une fois, et le rappel doit pouvoir se taire.
 *
 * Le repli est retenu par navigateur, comme la vue choisie : c'est une
 * habitude de lecture, pas une donnée du nook.
 */
import { ref } from 'vue'
import IconSparkles from '@/icons/IconSparkles.vue'
import IconX from '@/icons/IconX.vue'

defineProps<{ text: string }>()

const STORAGE_KEY = 'nook:planning-tip-hidden'

const hidden = ref(false)
try {
  hidden.value = localStorage.getItem(STORAGE_KEY) === '1'
} catch {
  // Navigation privée, stockage refusé : le bandeau reste, tant pis.
}

function dismiss() {
  hidden.value = true
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Sans stockage, il reviendra à la prochaine visite. Rien de perdu.
  }
}
</script>

<template>
  <div
    v-if="!hidden"
    class="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/[0.08]"
  >
    <IconSparkles class="mt-px h-[17px] w-[17px] shrink-0 text-lavender-500" />
    <p class="min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink-faint">
      <span class="font-semibold text-lavender-600">Astuce Nook</span>
      <span class="mx-1.5 text-line">·</span>{{ text }}
    </p>
    <button
      type="button"
      title="Masquer l'astuce"
      aria-label="Masquer l'astuce"
      class="shrink-0 rounded-lg p-1 text-ink-faint transition-colors hover:bg-paper hover:text-ink cursor-pointer"
      @click="dismiss"
    >
      <IconX class="h-3.5 w-3.5" />
    </button>
  </div>
</template>
