<script setup lang="ts">
withDefaults(defineProps<{ x?: number; y?: number }>(), { x: 0, y: 0 })
</script>

<template>
  <g :transform="`translate(${x}, ${y})`">
    <g class="garden-anim-pop">
      <ellipse cx="0" cy="0" rx="14" ry="8" fill="#b7ada0" />
      <ellipse cx="-4" cy="-3" rx="8" ry="5" fill="#c9c0b3" />
    </g>
  </g>
</template>
