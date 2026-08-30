<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useWorkSchedule } from '@/composables/useWorkSchedule'
import { useFocusSession } from '@/composables/useFocusSession'
import { toMinutes, nowMinutes, formatDuration, formatDurationWithSeconds } from '@/utils/time'
import IconX from '@/icons/IconX.vue'

defineEmits<{ close: [] }>()

const { schedule } = useWorkSchedule()
const { todayFocusStats } = useFocusSession()

const now = ref(new Date())
let timer: number | undefined
onMounted(() => {
  timer = window.setInterval(() => {
    now.value = new Date()
  }, 1000)
})
onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
})

const nowMin = computed(() => nowMinutes(now.value))
const startMin = computed(() => toMinutes(schedule.startTime))
const lunchStartMin = computed(() => toMinutes(schedule.lunchStart))
const lunchEndMin = computed(() => toMinutes(schedule.lunchEnd))
const endMin = computed(() => toMinutes(schedule.endTime))

const lunchDuration = computed(() => Math.max(0, lunchEndMin.value - lunchStartMin.value))
const totalWorkMin = computed(() => Math.max(0, endMin.value - startMin.value - lunchDuration.value))

type Phase = 'before' | 'morning' | 'lunch' | 'afternoon' | 'done'

const phase = computed<Phase>(() => {
  const n = nowMin.value
  if (n < startMin.value) return 'before'
  if (n < lunchStartMin.value) return 'morning'
  if (n < lunchEndMin.value) return 'lunch'
  if (n < endMin.value) return 'afternoon'
  return 'done'
})

const workedMin = computed(() => {
  const n = nowMin.value
  if (n <= startMin.value) return 0
  if (n <= lunchStartMin.value) return n - startMin.value
  if (n <= lunchEndMin.value) return lunchStartMin.value - startMin.value
  if (n <= endMin.value) return n - startMin.value - lunchDuration.value
  return totalWorkMin.value
})

const remainingMin = computed(() => Math.max(0, totalWorkMin.value - workedMin.value))
const progressPercent = computed(() =>
  totalWorkMin.value <= 0 ? 0 : Math.min(100, Math.round((workedMin.value / totalWorkMin.value) * 100)),
)

const pauseCountdown = computed(() => Math.max(0, lunchStartMin.value - nowMin.value))
const lunchRemaining = computed(() => Math.max(0, lunchEndMin.value - nowMin.value))

const hero = computed(() => {
  switch (phase.value) {
    case 'before':
      return {
        icon: '☀️',
        title: 'Ta journée démarre dans',
        value: formatDuration(startMin.value - nowMin.value),
        suffix: `à ${schedule.startTime}`,
      }
    case 'lunch':
      return { icon: '🍝', title: 'Pause déjeuner', value: formatDuration(lunchRemaining.value), suffix: 'encore' }
    case 'done':
      return { icon: '🏠', title: "C'est l'heure", value: '', suffix: '' }
    default:
      return {
        icon: '⏱️',
        title: 'Il te reste',
        value: formatDurationWithSeconds(remainingMin.value),
        suffix: 'de travail',
      }
  }
})

const statusLine = computed(() => {
  switch (phase.value) {
    case 'before':
      return `${formatDuration(totalWorkMin.value)} prévues aujourd'hui`
    case 'morning':
      return `🍝 Pause dans ${formatDuration(pauseCountdown.value)}`
    case 'afternoon':
      return '✨ Dernière ligne droite'
    case 'done':
      return 'Bonne soirée ✨'
    default:
      return null
  }
})

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

const daySpan = computed(() => Math.max(1, endMin.value - startMin.value))
const nowPct = computed(() => (clamp(nowMin.value, startMin.value, endMin.value) - startMin.value) / daySpan.value * 100)
const lunchStartPct = computed(() => clamp((lunchStartMin.value - startMin.value) / daySpan.value * 100, 0, 100))
const lunchEndPct = computed(() => clamp((lunchEndMin.value - startMin.value) / daySpan.value * 100, 0, 100))
</script>

<template>
  <div class="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/[0.08]">
    <div class="flex items-center justify-between">
      <h2 class="font-display text-[15px] font-medium text-ink">Ma journée</h2>
      <button
        type="button"
        title="Masquer le panneau"
        class="rounded-full p-1 text-ink-faint transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
        @click="$emit('close')"
      >
        <IconX class="h-3.5 w-3.5" />
      </button>
    </div>

    <div class="mt-4 text-center">
      <p class="text-[12.5px] text-ink-faint">{{ hero.icon }} {{ hero.title }}</p>
      <p v-if="hero.value" class="mt-1 font-display text-[28px] font-medium tabular-nums tracking-tight text-ink">
        {{ hero.value }}
      </p>
      <p v-if="hero.suffix" class="text-[12px] text-ink-faint">{{ hero.suffix }}</p>
    </div>

    <p v-if="statusLine" class="mt-3 text-center text-[12.5px] font-medium text-lavender-600">
      {{ statusLine }}
    </p>

    <div class="mt-5 rounded-xl bg-paper px-3.5 py-3">
      <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Aujourd'hui</p>
      <p class="mt-0.5 text-[14px] font-medium text-ink">
        {{ formatDuration(workedMin) }} <span class="font-normal text-ink-faint">travaillées</span>
      </p>
    </div>

    <div v-if="todayFocusStats.sessionCount > 0" class="mt-2.5 rounded-xl bg-paper px-3.5 py-3">
      <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">🎯 Focus aujourd'hui</p>
      <p class="mt-0.5 text-[14px] font-medium text-ink">
        {{ formatDuration(todayFocusStats.totalSeconds / 60) }}
        <span class="font-normal text-ink-faint">
          · {{ todayFocusStats.sessionCount }} session{{ todayFocusStats.sessionCount > 1 ? 's' : '' }}
        </span>
      </p>
    </div>

    <div class="mt-4">
      <div class="relative h-2 w-full overflow-hidden rounded-full bg-line">
        <div
          class="absolute inset-y-0 rounded-full bg-folder-peach/70"
          :style="{ left: lunchStartPct + '%', width: Math.max(0, lunchEndPct - lunchStartPct) + '%' }"
        />
        <div
          class="absolute inset-y-0 left-0 rounded-full bg-lavender-400 transition-all duration-700"
          :style="{ width: nowPct + '%' }"
        />
      </div>
      <div class="mt-1.5 flex items-center justify-between text-[10.5px] font-medium text-ink-faint">
        <span>{{ schedule.startTime }}</span>
        <span class="text-[11px] font-semibold text-lavender-600">{{ progressPercent }}%</span>
        <span>{{ schedule.endTime }}</span>
      </div>
    </div>
  </div>
</template>
