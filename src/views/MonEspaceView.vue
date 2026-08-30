<script setup lang="ts">
import { useGarden } from '@/composables/useGarden'
import GardenScene from '@/components/garden/GardenScene.vue'

const garden = useGarden()
</script>

<template>
  <div class="page-sheet mx-auto max-w-3xl px-8 py-9">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Mon espace</p>
        <h1 class="mt-1 font-display text-[24px] font-medium tracking-tight text-ink">
          Niveau {{ garden.level.value.level }}
        </h1>
        <p class="mt-1.5 text-[14px] text-ink-soft">
          {{ garden.state.xp }} XP · {{ garden.activeDaysCount.value }} jour{{ garden.activeDaysCount.value > 1 ? 's' : '' }} actif{{ garden.activeDaysCount.value > 1 ? 's' : '' }}
        </p>
      </div>
    </div>

    <div class="mt-6 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/[0.08]">
      <GardenScene />

      <div class="mt-5">
        <div class="relative h-2 w-full overflow-hidden rounded-full bg-line">
          <div
            class="absolute inset-y-0 left-0 rounded-full bg-lavender-400 transition-all duration-700"
            :style="{ width: garden.progressToNext.value * 100 + '%' }"
          />
        </div>
        <div class="mt-2 flex items-center justify-between text-[12px] font-medium text-ink-faint">
          <span>Niveau {{ garden.level.value.level }}</span>
          <span v-if="!garden.isMaxLevel.value" class="text-lavender-600">
            🌱 Prochaine évolution dans {{ garden.xpToNext.value }} XP
          </span>
          <span v-else class="text-lavender-600">🌳 Jardin pleinement épanoui</span>
          <span v-if="!garden.isMaxLevel.value">Niveau {{ garden.nextLevel.value?.level }}</span>
        </div>
      </div>
    </div>

    <p class="mt-5 text-center text-[12.5px] text-ink-faint">
      Ton jardin grandit avec toi — chaque tâche, chaque session Focus le fait doucement évoluer.
    </p>
  </div>
</template>
