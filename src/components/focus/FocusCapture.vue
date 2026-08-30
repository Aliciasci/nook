<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useStore } from '@/store/useStore'
import { useFocusSession } from '@/composables/useFocusSession'
import IconPlus from '@/icons/IconPlus.vue'

const { addTask } = useStore()
const { captureThought } = useFocusSession()

const isOpen = ref(false)
const value = ref('')
const root = ref<HTMLElement>()
const inputEl = ref<HTMLInputElement>()

function open() {
  isOpen.value = true
  value.value = ''
  nextTick(() => inputEl.value?.focus())
}

function submit() {
  if (!value.value.trim()) {
    isOpen.value = false
    return
  }
  captureThought(addTask, value.value)
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
      @click="open"
    >
      <IconPlus class="h-3.5 w-3.5" />
      Capturer
    </button>

    <Transition name="pop">
      <div
        v-if="isOpen"
        class="absolute bottom-full left-0 z-20 mb-2 w-72 rounded-2xl bg-white p-3 shadow-soft-lg ring-1 ring-ink/5"
      >
        <p class="px-0.5 pb-2 text-[11px] font-medium text-ink-faint">
          Sortir une pensée de ta tête, sans quitter le focus.
        </p>
        <input
          ref="inputEl"
          v-model="value"
          type="text"
          placeholder="Demander le serveur à Thomas…"
          class="w-full rounded-xl border border-line bg-paper px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-lavender-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-lavender-100"
          @keydown.enter="submit"
          @keydown.escape="isOpen = false"
        />
      </div>
    </Transition>
  </div>
</template>
