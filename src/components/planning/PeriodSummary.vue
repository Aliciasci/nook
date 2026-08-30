<script setup lang="ts">
/**
 * Le bilan de la période affichée : le temps posé, puis ce qu'il en a été.
 *
 * Le grand chiffre est le **prévu**, pas le réalisé. À huit heures du matin,
 * « 0h sur 4h prévues » se lit comme un échec alors que la journée n'a pas
 * commencé ; « 4h planifiées » se lit comme un plan. Le rapprochement suit
 * juste en dessous, où il ne juge plus la journée avant qu'elle ait eu lieu.
 *
 * Il ne note pas la précision de l'estimation — il distingue « je m'y suis
 * mis » de « je l'ai sauté ». Un planning tenu à 60 % est un bon planning ;
 * un planning jamais regardé n'en est pas un.
 *
 * Une journée, une semaine ou un mois : c'est le même calcul sur des bornes
 * différentes, `summarize()` ne demande qu'une liste de créneaux.
 */
import { computed } from 'vue'
import { useTimeBlocks } from '@/store/useTimeBlocks'
import { activityColorOf } from '@/composables/useActivityColors'
import { KIND_BUCKETS, bucketLabel } from '@/utils/activityKinds'
import { resolvePalette } from '@/utils/activityPalette'
import { formatDuration, formatDurationShort } from '@/utils/time'
import IconReport from '@/icons/IconReport.vue'

const props = defineProps<{
  /** Bornes de la période, comprises. */
  from: string
  to: string
  /** « Bilan », « Bilan de la semaine »… */
  title: string
}>()

const blocks = useTimeBlocks()
const summary = computed(() => blocks.rangeSummary(props.from, props.to))

/** Les paniers qui pèsent quelque chose, dans l'ordre du catalogue. */
const segments = computed(() => {
  const total = summary.value.plannedMin
  if (total <= 0) return []
  return KIND_BUCKETS.filter((b) => summary.value.plannedByKind[b] > 0).map((b) => ({
    id: b,
    label: bucketLabel(b),
    minutes: summary.value.plannedByKind[b],
    width: (summary.value.plannedByKind[b] / total) * 100,
    // « Autre » n'a pas de teinte à lui : un gris d'encre, qui ne prétend pas
    // être une septième catégorie.
    solid: b === 'autre' ? 'color-mix(in srgb, var(--color-ink) 20%, transparent)' : resolvePalette(activityColorOf(b)).solid,
  }))
})

/** Les blocs libres sont hors comptage : rien à y mesurer. */
const measured = computed(() => summary.value.kept + summary.value.partial + summary.value.missed)
</script>

<template>
  <div v-if="summary.blockCount" class="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/[0.08]">
    <div class="flex items-start justify-between gap-2">
      <h2 class="font-display text-[14px] font-medium text-ink">{{ title }}</h2>
      <IconReport class="h-[17px] w-[17px] shrink-0 text-ink-faint/70" />
    </div>

    <p class="mt-3 font-display text-[30px] font-medium leading-none tabular-nums tracking-tight text-ink">
      {{ formatDurationShort(summary.plannedMin) }}
    </p>
    <p class="mt-1 text-[12.5px] text-ink-faint">planifiées</p>

    <!-- La barre est le même comptage que la répartition, à plat : d'un coup
         d'œil on voit à quoi la période a été donnée, sans lire de légende. -->
    <div class="mt-3 flex h-2 gap-1 overflow-hidden">
      <span
        v-for="seg in segments"
        :key="seg.id"
        class="h-full rounded-full"
        :style="{ width: `${seg.width}%`, backgroundColor: seg.solid }"
        :title="`${seg.label} — ${formatDuration(seg.minutes)}`"
      />
    </div>

    <p class="mt-2.5 text-[12px] text-ink-faint">
      {{ summary.blockCount }} bloc{{ summary.blockCount > 1 ? 's' : '' }}
      <span v-if="summary.actualMin"> · {{ formatDuration(summary.actualMin) }} faites</span>
    </p>

    <dl v-if="measured" class="mt-4 grid grid-cols-3 gap-2 text-center">
      <div class="rounded-xl bg-paper py-2">
        <dt class="text-[10.5px] uppercase tracking-wide text-ink-faint">Tenus</dt>
        <dd class="mt-0.5 text-[16px] font-semibold tabular-nums text-green-600">{{ summary.kept }}</dd>
      </div>
      <div class="rounded-xl bg-paper py-2">
        <dt class="text-[10.5px] uppercase tracking-wide text-ink-faint">Entamés</dt>
        <dd class="mt-0.5 text-[16px] font-semibold tabular-nums text-amber-600">{{ summary.partial }}</dd>
      </div>
      <div class="rounded-xl bg-paper py-2">
        <dt class="text-[10.5px] uppercase tracking-wide text-ink-faint">Sautés</dt>
        <dd class="mt-0.5 text-[16px] font-semibold tabular-nums text-ink-faint">{{ summary.missed }}</dd>
      </div>
    </dl>

    <p v-if="summary.freeBlocks" class="mt-2.5 text-[11.5px] leading-snug text-ink-faint">
      {{ summary.freeBlocks }} bloc{{ summary.freeBlocks > 1 ? 's' : '' }} libre{{ summary.freeBlocks > 1 ? 's' : '' }}
      hors comptage — réunions, pauses, trajets.
    </p>
  </div>
</template>
