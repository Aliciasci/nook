<script setup lang="ts">
withDefaults(defineProps<{ x?: number; y?: number }>(), { x: 0, y: 0 })
</script>

<template>
  <g :transform="`translate(${x}, ${y})`">
    <g class="garden-anim-pop">
      <g class="garden-anim-sway">
        <path d="M0,0 Q-3,-10 0,-16" stroke="#5e9b4a" stroke-width="2.5" fill="none" stroke-linecap="round" />
        <path d="M0,-4 Q6,-12 2,-18" stroke="#6fae57" stroke-width="2.5" fill="none" stroke-linecap="round" />
      </g>
    </g>
  </g>
</template>
