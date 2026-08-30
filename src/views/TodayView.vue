<script setup lang="ts">
import { computed, watch } from 'vue'
import { useStore } from '@/store/useStore'
import { useTimeBlocks, todayIso } from '@/store/useTimeBlocks'
import PageHeader from '@/components/common/PageHeader.vue'
import TaskRow from '@/components/tasks/TaskRow.vue'
import QuickAddButton from '@/components/common/QuickAddButton.vue'
import SelectModeToggle from '@/components/common/SelectModeToggle.vue'
import IconTimeGrid from '@/icons/IconTimeGrid.vue'
import IconArrowRight from '@/icons/IconArrowRight.vue'

const { todayTasks } = useStore()
const blocks = useTimeBlocks()

// Le planning est chargé ici aussi, alors que cette vue ne l'affiche pas :
// sans ça, le lien annoncerait « Planifier ma journée » à quelqu'un qui a déjà
// tout posé. Le store met en cache par semaine — c'est la même que la page
// Planning demandera juste après, donc un chargement, pas deux.
watch(
  () => blocks.loaded.value,
  (loaded) => {
    if (!loaded) void blocks.ensureDay(todayIso())
  },
  { immediate: true },
)

const plannedCount = computed(() => blocks.blocksForDay(todayIso()).length)
</script>

<template>
  <div class="page-sheet mx-auto max-w-2xl px-8 py-9">
    <PageHeader title="Aujourd'hui" :subtitle="`${todayTasks.count} chose${todayTasks.count > 1 ? 's' : ''} à faire.`">
      <SelectModeToggle v-if="todayTasks.count" scope="today" />
      <QuickAddButton />
    </PageHeader>

    <!-- Le planning est une page à part : c'est ici qu'on pense à sa journée,
         donc c'est ici qu'il faut savoir qu'elle existe. -->
    <RouterLink
      to="/planning"
      class="group mt-6 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/[0.08] transition-all hover:-translate-y-0.5 hover:shadow-soft-lg"
    >
      <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lavender-100 text-lavender-600">
        <IconTimeGrid class="h-[18px] w-[18px]" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-[13.5px] font-medium text-ink">
          {{ plannedCount ? 'Voir mon planning' : 'Planifier ma journée' }}
        </span>
        <span class="block text-[12px] text-ink-faint">
          {{
            plannedCount
              ? `${plannedCount} créneau${plannedCount > 1 ? 'x' : ''} posé${plannedCount > 1 ? 's' : ''} aujourd'hui.`
              : 'Donne une heure à tes tâches sur une grille horaire.'
          }}
        </span>
      </span>
      <IconArrowRight class="h-4 w-4 shrink-0 text-ink-faint transition-colors group-hover:text-lavender-600" />
    </RouterLink>

    <div v-if="todayTasks.count === 0" class="mt-6 rounded-2xl bg-white p-10 text-center shadow-soft ring-1 ring-ink/[0.08]">
      <p class="text-[13.5px] text-ink-faint">Rien de prévu pour aujourd'hui. Profite-en 🌿</p>
    </div>

    <template v-else>
      <section v-if="todayTasks.priority.length" class="mt-7">
        <h2 class="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Prioritaire</h2>
        <div class="mt-2 rounded-2xl bg-white p-3 shadow-soft ring-1 ring-ink/[0.08]">
          <TaskRow v-for="t in todayTasks.priority" :key="t.id" :item="t" selection-scope="today" />
        </div>
      </section>

      <section v-if="todayTasks.regular.length" class="mt-6">
        <h2 class="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">À faire</h2>
        <div class="mt-2 rounded-2xl bg-white p-3 shadow-soft ring-1 ring-ink/[0.08]">
          <TaskRow v-for="t in todayTasks.regular" :key="t.id" :item="t" selection-scope="today" />
        </div>
      </section>
    </template>
  </div>
</template>
