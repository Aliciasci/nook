<script setup lang="ts">
import { useTodoList } from '@/composables/useTodoList'
import { TODO_MAX_LENGTH } from '@/composables/usePreferencesStore'
import Checkbox from '@/components/common/Checkbox.vue'
import QuickAddField from '@/components/common/QuickAddField.vue'
import IconX from '@/icons/IconX.vue'

const { entries, openCount, doneCount, ready, add, toggle, remove, clearDone } = useTodoList()
</script>

<template>
  <div class="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/[0.08]">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h2 class="font-display text-[15px] font-medium text-ink">To-do list</h2>
        <span
          v-if="openCount"
          class="rounded-full bg-lavender-100 px-2 py-0.5 text-[11px] font-semibold text-lavender-700"
        >
          {{ openCount }}
        </span>
      </div>
    </div>

    <div class="mt-3">
      <QuickAddField
        placeholder="Ajouter une ligne…"
        :disabled="!ready"
        :maxlength="TODO_MAX_LENGTH"
        @submit="add"
      />
    </div>

    <p v-if="ready && !entries.length" class="py-6 text-center text-[12.5px] text-ink-faint">
      Rien à cocher pour l'instant.
    </p>

    <!-- `TransitionGroup` pour le seul déplacement : une ligne cochée descend
         sous les autres, et la voir glisser dit ce qui vient de se passer. -->
    <TransitionGroup v-else name="fade-slide" tag="div" class="mt-3 flex flex-col gap-1">
      <div
        v-for="e in entries"
        :key="e.id"
        class="group flex min-h-11 items-start gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-lavender-50/60"
      >
        <Checkbox class="mt-0.5" :model-value="e.done" @update:model-value="toggle(e.id)" />
        <p
          class="min-w-0 flex-1 break-words text-[13px] leading-snug transition-colors"
          :class="e.done ? 'text-ink-faint line-through' : 'text-ink-soft'"
        >
          {{ e.text }}
        </p>
        <button
          type="button"
          class="mt-0.5 shrink-0 cursor-pointer rounded-md p-1 text-ink-faint opacity-0 transition-all hover:bg-ink/[0.04] hover:text-ink group-hover:opacity-100 focus-visible:opacity-100"
          :aria-label="`Retirer « ${e.text} »`"
          title="Retirer"
          @click="remove(e.id)"
        >
          <IconX class="h-3.5 w-3.5" />
        </button>
      </div>
    </TransitionGroup>

    <div v-if="doneCount" class="mt-2 flex justify-end">
      <button
        type="button"
        class="cursor-pointer text-[12px] font-medium text-ink-faint transition-colors hover:text-lavender-600"
        @click="clearDone"
      >
        Nettoyer ({{ doneCount }})
      </button>
    </div>
  </div>
</template>
