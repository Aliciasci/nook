<template>
  <div class="mx-auto max-w-2xl animate-pulse px-8 py-9">
    <div class="h-6 w-40 rounded-lg bg-ink/[0.06]" />
    <div class="mt-2.5 h-4 w-64 rounded-lg bg-ink/[0.05]" />

    <div class="mt-8 rounded-2xl bg-white p-3 shadow-soft ring-1 ring-ink/[0.08]">
      <div v-for="i in 4" :key="i" class="flex items-center gap-3 px-2.5 py-2.5">
        <div class="h-4 w-4 shrink-0 rounded-full bg-ink/[0.06]" />
        <div class="h-3.5 flex-1 rounded-lg bg-ink/[0.06]" :style="{ maxWidth: `${60 - i * 8}%` }" />
      </div>
    </div>

    <div class="mt-5 rounded-2xl bg-white p-3 shadow-soft ring-1 ring-ink/[0.08]">
      <div v-for="i in 3" :key="i" class="flex items-center gap-3 px-2.5 py-2.5">
        <div class="h-4 w-4 shrink-0 rounded-full bg-ink/[0.06]" />
        <div class="h-3.5 flex-1 rounded-lg bg-ink/[0.06]" :style="{ maxWidth: `${50 - i * 6}%` }" />
      </div>
    </div>
  </div>
</template>
