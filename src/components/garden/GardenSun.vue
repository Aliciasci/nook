<script setup lang="ts">
withDefaults(defineProps<{ x?: number; y?: number }>(), { x: 680, y: 60 })
</script>

<template>
  <g :transform="`translate(${x}, ${y})`">
    <circle r="34" fill="#ffd98a" opacity="0.35" class="garden-anim-glow" />
    <circle r="22" fill="#ffe6a8" />
    <circle r="16" fill="#fff1c9" />
  </g>
</template>
