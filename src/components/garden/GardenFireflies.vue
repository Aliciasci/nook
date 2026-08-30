<script setup lang="ts">
withDefaults(defineProps<{ x?: number; y?: number }>(), { x: 0, y: 0 })
</script>

<template>
  <g :transform="`translate(${x}, ${y})`">
    <g class="garden-anim-pop">
      <circle cx="0" cy="0" r="2" fill="#ffe58a" class="garden-anim-firefly" style="animation-delay: 0s" />
      <circle cx="16" cy="8" r="1.6" fill="#ffe58a" class="garden-anim-firefly" style="animation-delay: 1.2s" />
      <circle cx="-14" cy="10" r="1.8" fill="#ffe58a" class="garden-anim-firefly" style="animation-delay: 2.1s" />
      <circle cx="6" cy="-10" r="1.4" fill="#ffe58a" class="garden-anim-firefly" style="animation-delay: 0.6s" />
    </g>
  </g>
</template>
