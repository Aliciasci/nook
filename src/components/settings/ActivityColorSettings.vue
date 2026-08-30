<script setup lang="ts">
/**
 * La teinte de chaque activité du planning.
 *
 * Le réglage est ici plutôt que dans le menu d'un créneau parce qu'il vaut
 * pour tous : changer « Pause » ici repeint les pauses déjà posées comme
 * celles à venir. Le menu d'un créneau, lui, ne traite que l'exception.
 *
 * Une couleur libre est ramenée à un pastel de sa teinte : une carte de
 * planning porte du texte, et un aplat saturé y rendrait le titre illisible.
 * Voir `utils/activityPalette`.
 */
import { reactive } from 'vue'
import type { TimeBlockKind } from '@/types'
import { useActivityColors } from '@/composables/useActivityColors'
import { isFreeColor, resolvePalette, TINTS, TINT_LABELS } from '@/utils/activityPalette'
import { activityIcon } from '@/components/planning/activityIcons'

const { kinds, setColor } = useActivityColors()

/** La valeur du nuancier de chaque activité, le temps de la visite. */
const picked = reactive<Record<string, string>>({})

function pickerValue(kind: TimeBlockKind, tint: string): string {
  return picked[kind] ?? (isFreeColor(tint) ? tint : '#a3d9d5')
}

function onPick(kind: TimeBlockKind, value: string) {
  picked[kind] = value
  setColor(kind, value)
}

function vars(color: string): Record<string, string> {
  const p = resolvePalette(color)
  return { '--sw-bg': p.bg, '--sw-ink': p.ink, '--sw-ring': p.ring, '--sw-solid': p.solid }
}
</script>

<template>
  <section class="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/[0.08]">
    <h2 class="font-display text-[15px] font-medium text-ink">🗓️ Couleurs des activités</h2>
    <p class="mt-1 text-[12.5px] text-ink-soft">
      La teinte de chaque activité du planning. Les six teintes suivent le thème actif — elles s'assombrissent
      avec lui ; une couleur libre, non.
    </p>

    <div class="mt-4 flex flex-col gap-3">
      <div v-for="k in kinds" :key="k.id" class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div class="flex w-24 shrink-0 items-center gap-2 text-[var(--sw-ink)]" :style="vars(k.tint)">
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--sw-bg)]">
            <component :is="activityIcon(k.id, false)" class="h-[15px] w-[15px]" />
          </span>
          <span class="text-[13px] font-medium">{{ k.label }}</span>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <!-- Chaque pastille est une carte en miniature — même fond, même
               trait de gauche : ce qu'on voit est ce qu'on aura. -->
          <button
            v-for="tint in TINTS"
            :key="tint"
            type="button"
            :title="TINT_LABELS[tint]"
            :aria-label="`${k.label} en ${TINT_LABELS[tint].toLowerCase()}`"
            class="relative h-7 w-7 overflow-hidden rounded-lg bg-[var(--sw-bg)] ring-1 transition-transform hover:scale-105 cursor-pointer"
            :class="k.tint === tint ? 'scale-105 ring-2 ring-lavender-400' : 'ring-[var(--sw-ring)]'"
            :style="vars(tint)"
            @click="setColor(k.id, tint)"
          >
            <span class="absolute inset-y-0 left-0 w-1 bg-[var(--sw-solid)]" />
          </button>

          <label
            class="flex h-7 items-center gap-1.5 rounded-lg px-2 ring-1 transition-colors cursor-pointer"
            :class="isFreeColor(k.tint) ? 'ring-2 ring-lavender-400' : 'ring-ink/10 hover:ring-lavender-200'"
            :title="`Une couleur libre pour ${k.label}`"
          >
            <input
              type="color"
              class="h-[18px] w-[18px] cursor-pointer rounded border-0 bg-transparent p-0"
              :value="pickerValue(k.id, k.tint)"
              @input="onPick(k.id, ($event.target as HTMLInputElement).value)"
            />
            <span class="text-[11.5px] font-medium text-ink-soft">Libre</span>
          </label>

          <button
            v-if="k.custom"
            type="button"
            class="h-7 rounded-lg px-2 text-[11.5px] font-medium text-ink-faint ring-1 ring-ink/10 transition-colors hover:text-ink hover:ring-lavender-200 cursor-pointer"
            :title="`Rendre à ${k.label} sa teinte d'origine`"
            @click="setColor(k.id, null)"
          >
            Défaut
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
