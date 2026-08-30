<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '@/store/useStore'
import TaskRow from '@/components/tasks/TaskRow.vue'
import InlineQuickAdd from '@/components/common/InlineQuickAdd.vue'

const props = withDefaults(
  defineProps<{ limit?: number; selectionScope?: string }>(),
  { limit: 0, selectionScope: 'default' },
)

const { inboxItems } = useStore()

const visible = computed(() => (props.limit ? inboxItems.value.slice(0, props.limit) : inboxItems.value))
</script>

<template>
  <div>
    <div v-if="visible.length" class="flex flex-col gap-0.5">
      <TaskRow
        v-for="t in visible"
        :key="t.id"
        :item="t"
        :show-folder="false"
        date-mode="created"
        :selection-scope="selectionScope"
      />
    </div>
    <p v-else class="px-2.5 py-6 text-center text-[13px] text-ink-faint">Ta boîte de capture est vide ✨</p>

    <div class="mt-2">
      <InlineQuickAdd placeholder="Ajouter rapidement…" />
    </div>
  </div>
</template>
