<script setup lang="ts">
import type { TocEntry } from '@/utils/docs'

defineProps<{ entries: TocEntry[] }>()

function scrollTo(blockId: string) {
  document.getElementById(`doc-block-${blockId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const TONE: Record<1 | 2 | 3, string> = {
  1: 'font-medium text-ink-soft',
  2: 'text-ink-soft',
  3: 'text-ink-faint',
}
</script>

<template>
  <nav v-if="entries.length > 1" class="sticky top-9 rounded-2xl bg-white px-4 py-3.5 shadow-soft ring-1 ring-ink/[0.08]">
    <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Sommaire</p>
    <div class="mt-2 flex flex-col gap-0.5 border-l border-line">
      <button
        v-for="entry in entries"
        :key="entry.blockId"
        type="button"
        class="-ml-px block truncate border-l-2 border-transparent py-1 pr-1 text-left text-[12.5px] transition-colors hover:border-lavender-300 hover:text-ink cursor-pointer"
        :class="TONE[entry.level]"
        :style="{ paddingLeft: `${entry.level * 8}px` }"
        :title="entry.text"
        @click="scrollTo(entry.blockId)"
      >
        {{ entry.text }}
      </button>
    </div>
  </nav>
</template>
