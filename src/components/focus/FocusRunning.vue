<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '@/store/useStore'
import { useFocusSession } from '@/composables/useFocusSession'
import FocusRing from '@/components/focus/FocusRing.vue'
import FocusCapture from '@/components/focus/FocusCapture.vue'
import AmbiancePicker from '@/components/focus/AmbiancePicker.vue'

const { toggleTaskDone } = useStore()
const { state, pause, resume, finishTask, quitFocus } = useFocusSession()

const progress = computed(() => {
  const total = state.durationMinutes * 60
  if (total <= 0) return 0
  return (total - state.remainingSeconds) / total
})

const timeLabel = computed(() => {
  const m = Math.floor(state.remainingSeconds / 60)
  const s = state.remainingSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

function onFinish() {
  finishTask(toggleTaskDone)
}
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center px-6 text-center">
    <p class="text-[12px] font-semibold uppercase tracking-[0.25em] text-lavender-400">Focus</p>
    <h1 class="mt-3 max-w-lg font-display text-[22px] font-medium leading-snug tracking-tight text-ink">
      {{ state.task?.title }}
    </h1>

    <div class="relative mt-10">
      <FocusRing :progress="progress" :size="300" :stroke-width="3">
        <div class="flex flex-col items-center">
          <span class="font-display text-[54px] font-medium tabular-nums tracking-tight text-ink">
            {{ timeLabel }}
          </span>
          <span
            class="mt-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
            :class="state.phase === 'paused' ? 'bg-ink/[0.06] text-ink-faint' : 'bg-lavender-100 text-lavender-600'"
          >
            {{ state.phase === 'paused' ? 'Pause' : 'Focus' }}
          </span>
        </div>
      </FocusRing>
    </div>

    <p class="mt-8 text-[12.5px] font-medium text-ink-faint">Session #{{ state.sessionNumber }}</p>

    <div class="mt-6 flex items-center gap-3">
      <button
        v-if="state.phase === 'running'"
        type="button"
        class="rounded-xl border border-line bg-white px-5 py-2.5 text-[13.5px] font-medium text-ink-soft shadow-soft transition-colors hover:border-lavender-300 hover:text-ink cursor-pointer"
        @click="pause"
      >
        ⏸ Pause
      </button>
      <button
        v-else
        type="button"
        class="rounded-xl border border-line bg-white px-5 py-2.5 text-[13.5px] font-medium text-ink-soft shadow-soft transition-colors hover:border-lavender-300 hover:text-ink cursor-pointer"
        @click="resume"
      >
        ▶ Reprendre
      </button>
      <button
        type="button"
        class="rounded-xl bg-lavender-500 px-5 py-2.5 text-[13.5px] font-medium text-white shadow-soft transition-colors hover:bg-lavender-600 cursor-pointer"
        @click="onFinish"
      >
        ✓ Terminé
      </button>
    </div>

    <div class="mt-10 flex items-center gap-3">
      <FocusCapture />
      <AmbiancePicker />
    </div>

    <button
      type="button"
      class="mt-16 text-[13px] font-medium text-ink-faint transition-colors hover:text-ink cursor-pointer"
      @click="quitFocus"
    >
      ← Quitter le focus
    </button>
  </div>
</template>
