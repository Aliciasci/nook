<script setup lang="ts">
/**
 * Un mot du jour, dans la colonne du planning.
 *
 * Il ne dépend de rien — ni des créneaux, ni du retard, ni de ce qui a été
 * tenu. C'est voulu : une phrase qui commenterait la journée deviendrait un
 * jugement de plus sur une page qui en porte déjà deux.
 *
 * La phrase est tirée du jour lui-même, pas au hasard : elle ne change pas
 * sous les yeux à chaque re-rendu, et elle est la même du matin au soir.
 */
import { computed } from 'vue'
import IconBulb from '@/icons/IconBulb.vue'

const props = defineProps<{ day: string }>()

const TIPS = [
  'Un petit pas chaque jour mène à de grands changements.',
  "Le meilleur moment pour commencer, c'est le créneau que tu viens de poser.",
  "Bloquer une pause, c'est aussi planifier.",
  'Une journée pleine à craquer ne laisse aucune place à la journée.',
  "Ce qui n'a pas d'heure n'a pas vraiment de place.",
  'Deux heures posées valent mieux que six heures espérées.',
  'Terminer une chose vaut mieux que commencer trois.',
  'Laisse un trou : la journée le remplira toute seule.',
]

/** Somme des caractères de `2026-08-27` — stable, et suffisamment mêlée. */
const tip = computed(() => {
  let sum = 0
  for (let i = 0; i < props.day.length; i++) sum += props.day.charCodeAt(i) * (i + 1)
  return TIPS[sum % TIPS.length]
})
</script>

<template>
  <div class="rounded-2xl bg-folder-beige/45 p-5 shadow-soft ring-1 ring-folder-beige-ink/15">
    <div class="flex items-center gap-2">
      <IconBulb class="h-[17px] w-[17px] shrink-0 text-folder-beige-ink" />
      <h2 class="font-display text-[14px] font-medium text-folder-beige-ink">Conseil du jour</h2>
    </div>
    <p class="mt-2 text-[12.5px] leading-relaxed text-folder-beige-ink/85">{{ tip }}</p>
    <p class="mt-3 text-center text-[13px]">💜</p>
  </div>
</template>
