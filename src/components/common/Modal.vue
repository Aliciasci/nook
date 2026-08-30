<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    align?: 'center' | 'top'
    /** `lg` pour un contenu long — le détail d'un item, qui empile description et liens. */
    size?: 'md' | 'lg'
  }>(),
  { align: 'center', size: 'md' },
)
const emit = defineEmits<{ close: [] }>()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="fade-slide">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex justify-center bg-ink/25 backdrop-blur-[2px] px-4"
        :class="align === 'top' ? 'items-start pt-[14vh]' : 'items-center'"
        @mousedown.self="emit('close')"
      >
        <Transition name="pop" appear>
          <div v-if="open" class="w-full" :class="size === 'lg' ? 'max-w-lg' : 'max-w-md'">
            <slot />
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
