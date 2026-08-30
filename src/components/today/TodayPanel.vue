<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useStore } from '@/store/useStore'
import TaskRow from '@/components/tasks/TaskRow.vue'

const { todayTasks } = useStore()
</script>

<template>
  <div class="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/[0.08]">
    <div class="flex items-center justify-between">
      <h2 class="font-display text-[15px] font-medium text-ink">Aujourd'hui</h2>
      <RouterLink to="/today" class="text-[12px] font-medium text-ink-faint hover:text-lavender-600">
        Voir tout
      </RouterLink>
    </div>

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
  </div>
</template>
