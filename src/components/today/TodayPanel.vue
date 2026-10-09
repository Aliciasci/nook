<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useStore } from '@/store/useStore'
import TaskRow from '@/components/tasks/TaskRow.vue'
import CollapsiblePanel from '@/components/common/CollapsiblePanel.vue'

const { todayTasks } = useStore()
</script>

<template>
  <CollapsiblePanel panel-id="today" title="Aujourd'hui">
    <template #badge>
      <span
        v-if="todayTasks.count"
        class="rounded-full bg-lavender-100 px-2 py-0.5 text-[11px] font-semibold text-lavender-700"
      >
        {{ todayTasks.count }}
      </span>
    </template>
    <template #actions>
      <RouterLink to="/today" class="text-[12px] font-medium text-ink-faint hover:text-lavender-600">
        Voir tout
      </RouterLink>
    </template>

    <div v-if="todayTasks.count === 0" class="py-8 text-center text-[12.5px] text-ink-faint">
      Rien de prévu pour aujourd'hui.
    </div>

    <template v-else>
      <div v-if="todayTasks.priority.length" class="mt-3">
        <p class="px-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Prioritaire</p>
        <div class="mt-1">
          <TaskRow v-for="t in todayTasks.priority" :key="t.id" :item="t" hide-date :show-folder="false" />
        </div>
      </div>

      <div v-if="todayTasks.regular.length" class="mt-3">
        <p class="px-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">À faire</p>
        <div class="mt-1">
          <TaskRow v-for="t in todayTasks.regular" :key="t.id" :item="t" hide-date :show-folder="false" />
        </div>
      </div>
    </template>
  </CollapsiblePanel>
</template>
