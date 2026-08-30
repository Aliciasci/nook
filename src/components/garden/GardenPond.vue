<script setup lang="ts">
withDefaults(defineProps<{ x?: number; y?: number }>(), { x: 0, y: 0 })
</script>

<template>
  <g :transform="`translate(${x}, ${y})`">
    <g class="garden-anim-pop">
      <ellipse cx="0" cy="0" rx="42" ry="20" fill="#a9c9d6" />
      <ellipse cx="0" cy="0" rx="35" ry="15" fill="#bcd9e3" class="garden-anim-shimmer" />
      <ellipse cx="-8" cy="-3" rx="12" ry="4" fill="#ffffff" opacity="0.5" class="garden-anim-shimmer" />
    </g>
  </g>
</template>
