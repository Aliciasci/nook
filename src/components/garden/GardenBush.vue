<script setup lang="ts">
withDefaults(defineProps<{ x?: number; y?: number }>(), { x: 0, y: 0 })
</script>

<template>
  <g :transform="`translate(${x}, ${y})`">
    <g class="garden-anim-pop">
      <g class="garden-anim-sway-slow">
        <ellipse cx="0" cy="0" rx="20" ry="14" fill="#7dae5f" />
        <ellipse cx="-13" cy="4" rx="14" ry="11" fill="#6fa054" />
        <ellipse cx="13" cy="4" rx="14" ry="11" fill="#6fa054" />
        <ellipse cx="0" cy="-6" rx="13" ry="10" fill="#8bbd6e" />
      </g>
    </g>
  </g>
</template>
