<script setup lang="ts">
/**
 * À quoi la période a été donnée, par catégorie d'activité.
 *
 * C'est le **prévu** qui est réparti, pas le réalisé : la question est « à
 * quoi ai-je donné mes journées », et un créneau sauté a quand même pris la
 * place dans la journée. Les créneaux sans catégorie tombent dans « Autre »,
 * qui n'existe qu'ici — rien ne s'écrit sous ce nom en base.
 */
import { computed } from 'vue'
import { useTimeBlocks } from '@/store/useTimeBlocks'
import { activityColorOf } from '@/composables/useActivityColors'
import { KIND_BUCKETS, bucketLabel } from '@/utils/activityKinds'
import { resolvePalette } from '@/utils/activityPalette'
import { formatDuration } from '@/utils/time'

const props = defineProps<{ from: string; to: string }>()

const blocks = useTimeBlocks()
const summary = computed(() => blocks.rangeSummary(props.from, props.to))

/* Le trait du beignet, en unités du `viewBox`. */
const RADIUS = 32
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
/** Un filet de fond entre deux parts, pour qu'elles ne se soudent pas. */
const GAP = 2

const slices = computed(() => {
  const total = summary.value.plannedMin
  if (total <= 0) return []
  let offset = 0
  return KIND_BUCKETS.filter((b) => summary.value.plannedByKind[b] > 0).map((b) => {
    const minutes = summary.value.plannedByKind[b]
    const share = minutes / total
    const length = share * CIRCUMFERENCE
    // « Autre » n'a pas de teinte à lui : un gris d'encre, qui ne prétend pas
    // être une septième catégorie.
    const solid =
      b === 'autre'
        ? 'color-mix(in srgb, var(--color-ink) 20%, transparent)'
        : resolvePalette(activityColorOf(b)).solid
    const slice = {
      id: b,
      label: bucketLabel(b),
      minutes,
      percent: Math.round(share * 100),
      // Une part plus courte que le filet deviendrait invisible : on lui
      // laisse au moins un trait, quitte à mordre d'un cheveu sur la voisine.
      dash: `${Math.max(1.5, length - GAP)} ${CIRCUMFERENCE - Math.max(1.5, length - GAP)}`,
      offset: -offset,
      solid,
    }
    offset += length
    return slice
  })
})
</script>

<template>
  <div v-if="slices.length" class="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/[0.08]">
    <h2 class="font-display text-[14px] font-medium text-ink">Répartition</h2>

    <div class="mt-3 flex items-center gap-4">
      <svg viewBox="0 0 92 92" class="h-[86px] w-[86px] shrink-0 -rotate-90" aria-hidden="true">
        <circle
          v-for="slice in slices"
          :key="slice.id"
          cx="46"
          cy="46"
          :r="RADIUS"
          fill="none"
          stroke-width="12"
          :style="{ stroke: slice.solid }"
          :stroke-dasharray="slice.dash"
          :stroke-dashoffset="slice.offset"
        />
      </svg>

      <dl class="min-w-0 flex-1 space-y-1.5">
        <div v-for="slice in slices" :key="slice.id" class="flex items-center gap-2">
          <span class="h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: slice.solid }" />
          <dt class="min-w-0 flex-1 truncate text-[12px] text-ink-soft" :title="formatDuration(slice.minutes)">
            {{ slice.label }}
          </dt>
          <dd class="shrink-0 text-[12px] font-medium tabular-nums text-ink-faint">{{ slice.percent }}%</dd>
        </div>
      </dl>
    </div>
  </div>
</template>
