<script setup lang="ts">
withDefaults(defineProps<{ x?: number; y?: number; scale?: number }>(), { x: 0, y: 0, scale: 1 })
</script>

<template>
  <g :transform="`translate(${x}, ${y}) scale(${scale})`">
    <g class="garden-anim-pop">
      <rect x="-4" y="-6" width="8" height="26" rx="2" fill="#96693f" />
      <g class="garden-anim-sway-slow">
        <circle cx="0" cy="-30" r="22" fill="#6fae57" />
        <circle cx="-16" cy="-18" r="16" fill="#7dbb63" />
        <circle cx="16" cy="-18" r="16" fill="#7dbb63" />
        <circle cx="0" cy="-42" r="16" fill="#8bc571" />
      </g>
    </g>
  </g>
</template>
