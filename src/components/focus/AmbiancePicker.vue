<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useFocusSession } from '@/composables/useFocusSession'
import IconWaves from '@/icons/IconWaves.vue'
import type { FocusAmbiance } from '@/types'

const { ambiance, setAmbiance } = useFocusSession()

const options: { key: FocusAmbiance; label: string; emoji: string }[] = [
  { key: 'silence', label: 'Silence', emoji: '🔇' },
  { key: 'rain', label: 'Pluie', emoji: '🌧️' },
  { key: 'coffee', label: 'Café', emoji: '☕' },
  { key: 'ocean', label: 'Océan', emoji: '🌊' },
  { key: 'nature', label: 'Nature', emoji: '🌿' },
  { key: 'white-noise', label: 'Bruit blanc', emoji: '🔊' },
]

const isOpen = ref(false)
const root = ref<HTMLElement>()

function pick(key: FocusAmbiance) {
  setAmbiance(key)
  isOpen.value = false
}

function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) isOpen.value = false
}
onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex items-center gap-1.5 rounded-full border border-ink/10 px-3 py-1.5 text-[12px] font-medium text-ink-faint transition-colors hover:border-lavender-300 hover:text-lavender-600 cursor-pointer"
      @click="isOpen = !isOpen"
    >
      <IconWaves class="h-3.5 w-3.5" />
      Ambiance
    </button>

    <Transition name="pop">
      <div
        v-if="isOpen"
        class="absolute bottom-full right-0 z-20 mb-2 w-44 rounded-2xl bg-white p-1.5 shadow-soft-lg ring-1 ring-ink/5"
      >
        <button
          v-for="opt in options"
          :key="opt.key"
          type="button"
          class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium transition-colors cursor-pointer"
          :class="ambiance === opt.key ? 'bg-lavender-100 text-lavender-700' : 'text-ink-soft hover:bg-lavender-50'"
          @click="pick(opt.key)"
        >
          <span class="text-[15px] leading-none">{{ opt.emoji }}</span>
          {{ opt.label }}
        </button>
      </div>
    </Transition>
  </div>
</template>
