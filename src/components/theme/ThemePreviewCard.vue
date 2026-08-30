<script setup lang="ts">
import type { PresetThemeId, ThemeMode } from '@/composables/useTheme'

defineProps<{
  id: PresetThemeId
  emoji: string
  label: string
  tagline: string
  mode: ThemeMode
  active: boolean
}>()

defineEmits<{ select: [] }>()
</script>

<template>
  <button
    type="button"
    class="group flex flex-col overflow-hidden rounded-2xl border-2 bg-white text-left transition-all cursor-pointer"
    :class="active ? 'border-lavender-400 shadow-soft-lg' : 'border-line hover:-translate-y-0.5 hover:border-lavender-200 hover:shadow-soft-lg'"
    @click="$emit('select')"
  >
    <!-- Miniature live mockup, scoped to this theme's real tokens -->
    <div
      :data-theme="id"
      :data-mode="mode === 'auto' ? 'light' : mode"
      class="flex h-36 gap-1.5 bg-paper p-2"
    >
      <div class="flex w-8 shrink-0 flex-col gap-1.5 rounded-lg bg-surface p-1.5 shadow-soft">
        <div class="h-1.5 w-4 rounded-full bg-lavender-400" />
        <div class="h-1 w-5 rounded-full bg-ink/15" />
        <div class="h-1 w-5 rounded-full bg-ink/15" />
        <div class="mt-1 h-1 w-3 rounded-full bg-ink/10" />
        <div class="h-1 w-4 rounded-full bg-lavender-200" />
        <div class="h-1 w-4 rounded-full bg-lavender-200" />
      </div>
      <div class="flex flex-1 flex-col gap-1.5">
        <div class="flex gap-1.5">
          <div class="h-9 flex-1 rounded-lg bg-folder-blue p-1">
            <span class="text-[9px] leading-none">📘</span>
          </div>
          <div class="h-9 flex-1 rounded-lg bg-folder-pink p-1">
            <span class="text-[9px] leading-none">🌸</span>
          </div>
          <div class="h-9 flex-1 rounded-lg bg-folder-green p-1">
            <span class="text-[9px] leading-none">🌿</span>
          </div>
        </div>
        <div class="flex items-center gap-1 rounded-lg bg-surface px-1.5 py-1 shadow-soft">
          <div class="h-1.5 w-1.5 shrink-0 rounded-[2px] border border-lavender-400" />
          <div class="h-1 w-8 rounded-full bg-ink/20" />
        </div>
        <div class="flex items-center gap-1 rounded-lg bg-surface px-1.5 py-1 shadow-soft">
          <div class="h-1.5 w-1.5 shrink-0 rounded-[2px] bg-lavender-500" />
          <div class="h-1 w-6 rounded-full bg-ink/15" />
        </div>
        <div class="mt-auto rounded-lg bg-surface p-1.5 shadow-soft">
          <div class="h-1 w-10 rounded-full bg-ink/20" />
          <div class="mt-1 h-1 w-full overflow-hidden rounded-full bg-line">
            <div class="h-full w-2/3 rounded-full bg-lavender-400" />
          </div>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-between p-3.5">
      <div>
        <p class="font-display text-[14px] font-medium text-ink">{{ emoji }} {{ label }}</p>
        <p class="mt-0.5 text-[11px] leading-snug text-ink-faint">{{ tagline }}</p>
      </div>
      <span
        v-if="active"
        class="shrink-0 rounded-full bg-lavender-100 px-2 py-1 text-[10.5px] font-semibold text-lavender-700"
      >
        Actif
      </span>
      <span
        v-else
        class="shrink-0 rounded-full border border-line px-2 py-1 text-[10.5px] font-medium text-ink-faint transition-colors group-hover:border-lavender-300 group-hover:text-lavender-600"
      >
        Utiliser
      </span>
    </div>
  </button>
</template>
