<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { state, dismiss } = useToast()
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-2">
      <TransitionGroup name="fade-slide">
        <div
          v-for="toast in state.toasts"
          :key="toast.id"
          class="pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-xl bg-white px-3.5 py-3 text-[12.5px] font-medium shadow-soft-lg ring-1 ring-ink/[0.08]"
          :class="toast.tone === 'error' ? 'text-rose-600' : 'text-ink'"
        >
          <span class="flex-1 leading-snug">{{ toast.message }}</span>
          <button
            type="button"
            class="shrink-0 text-ink-faint transition-colors hover:text-ink cursor-pointer"
            @click="dismiss(toast.id)"
          >
            ✕
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
