<script setup lang="ts">
/**
 * Couleur de fond unie, avec un motif discret par-dessus.
 *
 * Alternative à l'image : poser une couleur retire l'image et inversement, un
 * fond ne pouvant pas être deux choses à la fois.
 */
import { computed, ref, watch } from 'vue'
import { BACKGROUND_TINTS, resolveBackgroundColors, useBackground } from '@/composables/useBackground'
import { BACKGROUND_PATTERNS, patternDataUri, type BackgroundPattern } from '@/utils/backgroundPatterns'

const background = useBackground()

const TINT_LABELS: Record<string, string> = {
  blue: 'Bleu',
  green: 'Vert',
  pink: 'Rose',
  beige: 'Beige',
  lavender: 'Lavande',
  peach: 'Pêche',
}

const current = computed(() => background.config.value.color)
const pattern = computed(() => background.config.value.pattern as BackgroundPattern | null)

/** Couleur libre. Synchronisée avec le réglage quand il ne vient pas d'ici. */
const custom = ref(current.value?.startsWith('#') ? current.value : '#f4e4d8')
watch(current, (value) => {
  if (value?.startsWith('#')) custom.value = value
})

/** L'aperçu peint exactement ce que le fond peindra : même couleur, même motif. */
function swatchStyle(color: string, withPattern = true) {
  const { fill, ink } = resolveBackgroundColors(color)
  const style: Record<string, string> = { backgroundColor: fill }
  if (withPattern && pattern.value) {
    style.backgroundImage = patternDataUri(pattern.value, ink)
    style.backgroundSize = '36px 36px'
  }
  return style
}

function patternStyle(id: BackgroundPattern) {
  const { fill, ink } = resolveBackgroundColors(current.value ?? 'beige')
  return { backgroundColor: fill, backgroundImage: patternDataUri(id, ink), backgroundSize: '36px 36px' }
}
</script>

<template>
  <section class="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/[0.08]">
    <h2 class="font-display text-[15px] font-medium text-ink">🎨 Couleur de fond</h2>
    <p class="mt-1 text-[12.5px] text-ink-soft">
      Un aplat derrière toute l'application, avec un motif si tu veux. Les six teintes suivent le thème actif —
      elles s'assombrissent avec lui.
    </p>

    <p class="mt-4 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Teinte</p>
    <div class="mt-2 flex flex-wrap items-center gap-2">
      <button
        v-for="tint in BACKGROUND_TINTS"
        :key="tint"
        type="button"
        :title="TINT_LABELS[tint]"
        :aria-label="TINT_LABELS[tint]"
        class="h-10 w-10 rounded-xl ring-1 transition-transform hover:scale-105 cursor-pointer"
        :class="current === tint ? 'scale-105 ring-2 ring-lavender-400' : 'ring-ink/10'"
        :style="swatchStyle(tint)"
        @click="background.setColor(current === tint ? null : tint)"
      />

      <!-- Couleur libre : elle ne suit aucun thème, à toi de vérifier qu'elle
           reste lisible en sombre. -->
      <label
        class="flex h-10 items-center gap-2 rounded-xl px-2.5 ring-1 transition-colors cursor-pointer"
        :class="current?.startsWith('#') ? 'ring-2 ring-lavender-400' : 'ring-ink/10 hover:ring-lavender-200'"
      >
        <input
          v-model="custom"
          type="color"
          class="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
          @input="background.setColor(custom)"
        />
        <span class="text-[12px] font-medium text-ink-soft">Libre</span>
      </label>

      <button
        v-if="current"
        type="button"
        class="h-10 rounded-xl border border-line px-3 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-rose-300 hover:text-rose-500 cursor-pointer"
        @click="background.setColor(null)"
      >
        Retirer
      </button>
    </div>

    <template v-if="current">
      <p class="mt-5 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Motif</p>
      <div class="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          title="Aucun motif"
          class="flex h-14 w-14 items-center justify-center rounded-xl text-[11px] font-medium text-ink-faint ring-1 transition-transform hover:scale-105 cursor-pointer"
          :class="pattern === null ? 'scale-105 ring-2 ring-lavender-400' : 'ring-ink/10'"
          :style="swatchStyle(current, false)"
          @click="background.setPattern(null)"
        >
          Aucun
        </button>
        <button
          v-for="p in BACKGROUND_PATTERNS"
          :key="p.id"
          type="button"
          :title="p.label"
          :aria-label="p.label"
          class="h-14 w-14 rounded-xl ring-1 transition-transform hover:scale-105 cursor-pointer"
          :class="pattern === p.id ? 'scale-105 ring-2 ring-lavender-400' : 'ring-ink/10'"
          :style="patternStyle(p.id)"
          @click="background.setPattern(pattern === p.id ? null : p.id)"
        />
      </div>
      <p class="mt-2 px-0.5 text-[11.5px] text-ink-faint">
        Les aperçus montrent le motif en pleine teinte ; sur le fond réel il est posé à 8 % — on le devine
        plutôt qu'on le lit.
      </p>
    </template>
  </section>
</template>
