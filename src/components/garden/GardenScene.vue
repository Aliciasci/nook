<script setup lang="ts">
import { useGarden } from '@/composables/useGarden'
import GardenSun from './GardenSun.vue'
import GardenCloud from './GardenCloud.vue'
import GardenGround from './GardenGround.vue'
import GardenPath from './GardenPath.vue'
import GardenPond from './GardenPond.vue'
import GardenHouse from './GardenHouse.vue'
import GardenTree from './GardenTree.vue'
import GardenBush from './GardenBush.vue'
import GardenFlower from './GardenFlower.vue'
import GardenStone from './GardenStone.vue'
import GardenSprout from './GardenSprout.vue'
import GardenFireflies from './GardenFireflies.vue'

const garden = useGarden()
const unlocked = garden.unlockedElements

function has(key: string) {
  return unlocked.value.has(key)
}
</script>

<template>
  <div class="garden-scene-wrap">
    <svg viewBox="0 0 800 400" class="garden-scene-svg" role="img" aria-label="Mon espace — jardin de progression">
      <defs>
        <linearGradient id="garden-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#eaf3fb" />
          <stop offset="100%" stop-color="#fdf6ec" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="800" height="400" fill="url(#garden-sky)" />

      <GardenSun v-if="has('ground')" />
      <GardenCloud v-if="has('cloud-1')" :x="150" :y="55" :scale="1" />
      <GardenCloud v-if="has('cloud-2')" :x="560" :y="95" :scale="0.8" />

      <GardenGround v-if="has('ground')" />

      <GardenPath v-if="has('path')" />
      <GardenPond v-if="has('pond')" :x="640" :y="330" />

      <GardenTree v-if="has('tree-1')" :x="110" :y="300" :scale="1" />
      <GardenTree v-if="has('tree-2')" :x="700" :y="305" :scale="0.9" />
      <GardenTree v-if="has('tree-3')" :x="250" :y="330" :scale="0.65" />

      <GardenHouse v-if="has('house')" :x="400" :y="190" />

      <GardenBush v-if="has('bush-1')" :x="205" :y="335" />
      <GardenBush v-if="has('bush-2')" :x="595" :y="350" />

      <GardenStone v-if="has('stone-1')" :x="335" :y="305" />

      <GardenSprout v-if="has('sprout-1')" :x="90" :y="345" />
      <GardenSprout v-if="has('sprout-2')" :x="510" :y="365" />

      <GardenFlower v-if="has('flower-1')" :x="160" :y="315" color="pink" />
      <GardenFlower v-if="has('flower-2')" :x="475" :y="322" color="lavender" />
      <GardenFlower v-if="has('flower-3')" :x="300" :y="352" color="peach" />
      <GardenFlower v-if="has('flower-4')" :x="655" :y="300" color="yellow" />
      <GardenFlower v-if="has('full-bloom')" :x="230" :y="290" color="yellow" />
      <GardenFlower v-if="has('full-bloom')" :x="540" :y="270" color="pink" />

      <GardenFireflies v-if="has('fireflies')" :x="460" :y="250" />
    </svg>

    <Transition name="garden-celebrate">
      <div v-if="garden.celebration.level" class="garden-celebrate">
        <span class="garden-celebrate__sparkle">✨</span>
        <span>Nouveau ! Niveau {{ garden.celebration.level.level }}</span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.garden-scene-wrap {
  position: relative;
  width: 100%;
}

.garden-scene-svg {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 1.25rem;
  overflow: hidden;
}

.garden-celebrate {
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(6px);
  font-size: 0.8rem;
  font-weight: 500;
  color: #6b5b45;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.garden-celebrate__sparkle {
  font-size: 0.9rem;
}

.garden-celebrate-enter-active {
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.garden-celebrate-leave-active {
  transition: opacity 1.2s ease;
}
.garden-celebrate-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-6px);
}
.garden-celebrate-leave-to {
  opacity: 0;
}
</style>
