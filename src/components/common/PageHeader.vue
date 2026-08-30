<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <div class="flex flex-wrap items-start justify-between gap-4">
    <div>
      <div class="flex items-center gap-2">
        <h1 class="font-display text-[24px] font-medium tracking-tight text-ink">{{ title }}</h1>
        <!-- De quoi poser une marque à côté du titre — la pousse du planning.
             Vide partout ailleurs : le titre garde alors sa place exacte. -->
        <slot name="badge" />
      </div>
      <p v-if="subtitle" class="mt-1.5 text-[14px] text-ink-soft">{{ subtitle }}</p>
    </div>
    <div class="flex items-center gap-2">
      <slot />
    </div>
  </div>
</template>
