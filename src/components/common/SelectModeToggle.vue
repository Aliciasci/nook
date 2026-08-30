<script setup lang="ts">
import { useSelection } from '@/composables/useSelection'

const props = withDefaults(defineProps<{ scope?: string }>(), { scope: 'default' })
const selection = useSelection(props.scope)
</script>

<template>
  <button
    type="button"
    class="rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors cursor-pointer"
    :class="
      selection.state.isSelecting
        ? 'border-lavender-300 bg-lavender-50 text-lavender-700'
        : 'border-line text-ink-faint hover:border-lavender-300 hover:text-ink'
    "
    @click="selection.toggleSelecting"
  >
    {{ selection.state.isSelecting ? 'Annuler' : 'Sélectionner' }}
  </button>
</template>
