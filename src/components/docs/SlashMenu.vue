<script setup lang="ts">
import { computed, watch } from 'vue'
import { SLASH_COMMANDS, type SlashCommand } from './slashCommands'
import { foldText } from '@/utils/docs'

const props = defineProps<{ query: string; highlighted: number }>()
const emit = defineEmits<{ select: [SlashCommand]; 'update:highlighted': [number]; empty: [] }>()

const results = computed(() => {
  const q = foldText(props.query)
  if (!q) return SLASH_COMMANDS
  return SLASH_COMMANDS.filter((cmd) => [cmd.label, ...cmd.keywords].some((term) => foldText(term).includes(q)))
})

defineExpose({ results })

// Le parent pilote la sélection au clavier : on le prévient quand la liste
// rétrécit sous l'index courant, ou quand plus rien ne correspond.
watch(results, (list) => {
  if (!list.length) emit('empty')
  else if (props.highlighted >= list.length) emit('update:highlighted', list.length - 1)
})
</script>

<template>
  <div
    v-if="results.length"
    class="absolute left-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-xl bg-white p-1.5 shadow-soft-lg ring-1 ring-ink/[0.08]"
  >
    <button
      v-for="(cmd, i) in results"
      :key="cmd.type"
      type="button"
      class="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors cursor-pointer"
      :class="i === highlighted ? 'bg-lavender-100' : 'hover:bg-lavender-50'"
      @mouseenter="emit('update:highlighted', i)"
      @mousedown.prevent="emit('select', cmd)"
    >
      <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-paper text-[11px] font-semibold text-ink-soft">
        {{ cmd.glyph }}
      </span>
      <span class="min-w-0 flex-1">
        <span class="block truncate text-[13px] font-medium text-ink">{{ cmd.label }}</span>
        <span class="block truncate text-[11.5px] text-ink-faint">{{ cmd.hint }}</span>
      </span>
    </button>
  </div>
</template>
