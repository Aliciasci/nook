<script setup lang="ts">
import { useStore } from '@/store/useStore'
import { useFocusSession } from '@/composables/useFocusSession'

const { toggleTaskDone } = useStore()
const { state, continueSession, quitFocus } = useFocusSession()

function markDone() {
  if (state.task) toggleTaskDone(state.task.id)
}
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center px-6 text-center">
    <p class="font-display text-[30px] font-medium tracking-tight text-ink">✨ Well done.</p>
    <p class="mt-2 text-[14px] text-ink-soft">{{ state.durationMinutes }} min de focus</p>
    <p class="mt-6 max-w-md font-display text-[19px] font-medium leading-snug text-ink">
      {{ state.task?.title }}
    </p>

    <button
      v-if="state.task && state.task.status !== 'done'"
      type="button"
      class="mt-4 flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-lavender-300 hover:text-lavender-600 cursor-pointer"
      @click="markDone"
    >
      Marquer la tâche comme terminée
    </button>
    <p v-else class="mt-4 flex items-center gap-1.5 text-[12.5px] font-medium text-lavender-600">
      ✓ Terminé
    </p>

    <div class="mt-12 flex flex-col items-center gap-3">
      <button
        type="button"
        class="rounded-xl bg-lavender-500 px-6 py-3 text-[14px] font-medium text-white shadow-soft transition-colors hover:bg-lavender-600 cursor-pointer"
        @click="quitFocus"
      >
        Faire une pause
      </button>
      <button
        type="button"
        class="text-[13px] font-medium text-ink-faint transition-colors hover:text-lavender-600 cursor-pointer"
        @click="continueSession"
      >
        Continuer encore {{ state.durationMinutes }} min
      </button>
    </div>
  </div>
</template>
