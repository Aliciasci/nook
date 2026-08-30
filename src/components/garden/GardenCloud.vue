<script setup lang="ts">
withDefaults(defineProps<{ x?: number; y?: number; scale?: number }>(), { x: 0, y: 0, scale: 1 })
</script>

<template>
  <g :transform="`translate(${x}, ${y})`">
    <g class="garden-anim-drift">
      <g :transform="`scale(${scale})`" opacity="0.75">
        <ellipse cx="0" cy="0" rx="26" ry="14" fill="#ffffff" />
        <ellipse cx="18" cy="-6" rx="18" ry="12" fill="#ffffff" />
        <ellipse cx="-18" cy="-4" rx="16" ry="10" fill="#ffffff" />
      </g>
    </g>
  </g>
</template>
