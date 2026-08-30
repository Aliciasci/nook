<script setup lang="ts">
withDefaults(
  defineProps<{ x?: number; y?: number; color?: 'pink' | 'lavender' | 'peach' | 'yellow' }>(),
  { x: 0, y: 0, color: 'pink' },
)

const PETAL_COLORS: Record<string, string> = {
  pink: '#f2a3c4',
  lavender: '#b6a3e6',
  peach: '#f2b48a',
  yellow: '#f5d576',
}
const CENTER_COLORS: Record<string, string> = {
  pink: '#e0709e',
  lavender: '#8a6fd1',
  peach: '#d97f4a',
  yellow: '#e0a83a',
}
</script>

<template>
  <g :transform="`translate(${x}, ${y})`">
    <g class="garden-anim-pop">
      <path d="M0,0 L0,-14" stroke="#6fa054" stroke-width="2" stroke-linecap="round" />
      <g transform="translate(0,-14)">
        <g class="garden-anim-sway">
          <circle cx="0" cy="-6" r="4.5" :fill="PETAL_COLORS[color]" />
          <circle cx="5" cy="-2" r="4.5" :fill="PETAL_COLORS[color]" />
          <circle cx="-5" cy="-2" r="4.5" :fill="PETAL_COLORS[color]" />
          <circle cx="3" cy="3" r="4.5" :fill="PETAL_COLORS[color]" />
          <circle cx="-3" cy="3" r="4.5" :fill="PETAL_COLORS[color]" />
          <circle cx="0" cy="0" r="3" :fill="CENTER_COLORS[color]" />
        </g>
      </g>
    </g>
  </g>
</template>
