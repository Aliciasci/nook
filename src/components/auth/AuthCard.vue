<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-paper px-4 py-10">
    <div class="w-full max-w-sm">
      <div class="mb-7 flex items-center justify-center gap-2">
        <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-lavender-400 shadow-soft">
          <svg viewBox="0 0 20 20" class="h-4 w-4 text-white" fill="none">
            <path
              d="M3 8.4c0-1.6 1.3-2.9 2.9-2.9h3.1c.7 0 1.4.3 1.9.8l.9.9c.5.5 1.2.8 1.9.8h3.1c1.6 0 2.9 1.3 2.9 2.9v3.5c0 1.6-1.3 2.9-2.9 2.9H5.9C4.3 17.3 3 16 3 14.4V8.4Z"
              fill="currentColor"
            />
          </svg>
        </div>
        <span class="font-display text-lg font-medium tracking-tight text-ink">Nook</span>
      </div>

      <div class="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-ink/[0.08]">
        <h1 class="font-display text-[19px] font-medium tracking-tight text-ink">{{ title }}</h1>
        <p v-if="subtitle" class="mt-1 text-[13px] text-ink-soft">{{ subtitle }}</p>

        <div class="mt-5">
          <slot />
        </div>
      </div>

      <p class="mt-5 text-center text-[12.5px] text-ink-faint">
        <slot name="footer" />
      </p>
    </div>
  </div>
</template>
