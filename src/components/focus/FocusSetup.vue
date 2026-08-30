<script setup lang="ts">
import { useFocusSession, DURATION_PRESETS } from '@/composables/useFocusSession'

const { state, startSession, quitFocus } = useFocusSession()
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center px-6 text-center">
    <p class="text-[12px] font-semibold uppercase tracking-[0.25em] text-lavender-400">Focus</p>
    <h1 class="mt-4 max-w-xl font-display text-[32px] font-medium leading-tight tracking-tight text-ink">
      {{ state.task?.title }}
    </h1>

    <div class="mt-12 flex flex-wrap items-stretch justify-center gap-4">
      <button
        v-for="preset in DURATION_PRESETS"
        :key="preset.minutes"
        type="button"
        class="flex w-44 flex-col items-center gap-1 rounded-2xl border border-line bg-white px-5 py-6 shadow-soft transition-all hover:-translate-y-0.5 hover:border-lavender-300 hover:shadow-soft-lg cursor-pointer"
        @click="startSession(preset.minutes)"
      >
        <span class="font-display text-[15px] font-medium text-ink">{{ preset.label }}</span>
        <span class="text-[24px] font-semibold tracking-tight text-lavender-500">{{ preset.minutes }}</span>
        <span class="text-[11px] text-ink-faint">min</span>
        <span class="mt-1.5 text-[11.5px] leading-snug text-ink-faint">{{ preset.description }}</span>
      </button>
    </div>

    <button
      type="button"
      class="mt-8 text-[13px] font-medium text-ink-faint underline decoration-dotted underline-offset-4 transition-colors hover:text-lavender-600 cursor-pointer"
      @click="startSession(state.durationMinutes)"
    >
      Continuer avec {{ state.durationMinutes }} min (dernière session)
    </button>

    <button
      type="button"
      class="mt-16 text-[13px] font-medium text-ink-faint transition-colors hover:text-ink cursor-pointer"
      @click="quitFocus"
    >
      ← Quitter le focus
    </button>
  </div>
</template>
