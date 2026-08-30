<script setup lang="ts">
defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <button
    type="button"
    role="checkbox"
    :aria-checked="modelValue"
    class="flex h-[19px] w-[19px] shrink-0 cursor-pointer items-center justify-center rounded-[7px] border-[1.6px] transition-all duration-150 active:scale-90"
    :class="
      modelValue
        ? 'check-checked border-lavender-500 bg-lavender-500'
        : 'border-ink-faint/35 bg-white hover:border-lavender-400'
    "
    @click.stop="emit('update:modelValue', !modelValue)"
  >
    <svg viewBox="0 0 16 16" class="h-[11px] w-[11px]" fill="none">
      <path
        class="check-path"
        d="M3.2 8.3 6.2 11.2 12.6 4.6"
        stroke="white"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </button>
</template>
