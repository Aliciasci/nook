<script setup lang="ts">
/**
 * Le prévu/réalisé sur la période du rapport.
 *
 * Il charge ses propres données plutôt que de passer par `useTimeBlocks` : le
 * store du planning tient la semaine autour du jour regardé, alors qu'un
 * rapport porte sur un mois ou plus. Deux besoins, deux plages — les faire
 * cohabiter dans un seul cache ferait osciller la grille au gré des filtres du
 * rapport.
 */
import { ref, watch } from 'vue'
import type { TimeBlock } from '@/types'
import { useStore } from '@/store/useStore'
import { listTimeBlocks } from '@/services/timeBlocks'
import { listFocusSessions } from '@/services/focus'
import { actualSecondsByDayItem, summarize, type PlanningSummary } from '@/utils/planning'
import { formatDuration } from '@/utils/time'

const props = defineProps<{ from: string; to: string }>()

const store = useStore()

const summary = ref<PlanningSummary | null>(null)
const loading = ref(false)
const failed = ref(false)

let token = 0

async function load(from: string, to: string) {
  const mine = ++token
  loading.value = true
  failed.value = false
  try {
    const sinceIso = new Date(`${from}T00:00:00`).toISOString()
    const until = new Date(`${to}T00:00:00`)
    until.setDate(until.getDate() + 1)

    const [blocks, sessions] = await Promise.all([
      listTimeBlocks(from, to),
      listFocusSessions(sinceIso, until.toISOString()),
    ])
    if (mine !== token) return
    summary.value = summarize(
      blocks as TimeBlock[],
      (id) => store.getItem(id),
      actualSecondsByDayItem(sessions),
    )
  } catch {
    if (mine !== token) return
    failed.value = true
    summary.value = null
  } finally {
    if (mine === token) loading.value = false
  }
}

watch(
  () => [props.from, props.to] as const,
  ([from, to]) => {
    if (from && to && from <= to) void load(from, to)
  },
  { immediate: true },
)

defineExpose({ summary })
</script>

<template>
  <section class="mt-5 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/[0.08]">
    <h2 class="font-display text-[15px] font-medium text-ink">🗓️ Planning</h2>
    <p class="mt-1 text-[12.5px] text-ink-soft">
      Le temps que tu avais bloqué sur la période, face à celui que tu y as réellement passé en Focus.
    </p>

    <p v-if="loading" class="mt-4 text-[13px] text-ink-faint">Chargement…</p>
    <p v-else-if="failed" class="mt-4 text-[13px] text-ink-faint">
      Le planning de cette période n'a pas pu être chargé.
    </p>
    <p v-else-if="!summary || !summary.blockCount" class="mt-4 text-[13px] text-ink-faint">
      Aucun créneau posé sur cette période.
    </p>

    <template v-else>
      <div class="mt-4 grid grid-cols-2 gap-3">
        <div class="rounded-xl bg-paper p-3">
          <p class="text-[11px] uppercase tracking-wide text-ink-faint">Prévu</p>
          <p class="mt-0.5 font-display text-[19px] font-medium tabular-nums text-ink">
            {{ formatDuration(summary.plannedMin) }}
          </p>
        </div>
        <div class="rounded-xl bg-paper p-3">
          <p class="text-[11px] uppercase tracking-wide text-ink-faint">Réalisé en Focus</p>
          <p class="mt-0.5 font-display text-[19px] font-medium tabular-nums text-ink">
            {{ formatDuration(summary.actualMin) }}
          </p>
        </div>
      </div>

      <dl class="mt-3 grid grid-cols-3 gap-2 text-center">
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

      <p class="mt-3 text-[12px] leading-snug text-ink-faint">
        Un créneau compte comme tenu si sa tâche est terminée, ou si tu y as passé au moins la moitié du temps prévu.
        Les {{ summary.freeBlocks }} bloc{{ summary.freeBlocks > 1 ? 's' : '' }} libre{{ summary.freeBlocks > 1 ? 's' : '' }}
        (réunions, pauses) sont hors comptage.
      </p>
    </template>
  </section>
</template>
