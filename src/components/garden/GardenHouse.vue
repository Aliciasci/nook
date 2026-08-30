<script setup lang="ts">
withDefaults(defineProps<{ x?: number; y?: number }>(), { x: 0, y: 0 })
</script>

<template>
  <g :transform="`translate(${x}, ${y})`">
    <g class="garden-anim-pop">
      <rect x="-22" y="-6" width="44" height="34" rx="3" fill="#f3e3cf" />
      <path d="M-27,-6 L0,-32 L27,-6 Z" fill="#c47a5e" />
      <rect x="-6" y="8" width="12" height="20" rx="2" fill="#96693f" />
      <circle cx="2" cy="18" r="1.4" fill="#f3e3cf" />
      <rect x="-16" y="4" width="9" height="9" rx="1.5" fill="#bcd9e3" />
      <rect x="8" y="4" width="9" height="9" rx="1.5" fill="#bcd9e3" />
      <rect x="-3" y="-18" width="6" height="10" fill="#c47a5e" />
      <rect x="-4.5" y="-24" width="4" height="7" rx="1" fill="#e8ddce" />
    </g>
  </g>
</template>
