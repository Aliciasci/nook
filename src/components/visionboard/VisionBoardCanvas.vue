<script setup lang="ts">
/**
 * La surface du board : un ratio fixe, dans lequel `x`/`y`/`width`/`height`
 * sont des pourcentages — voir `VisionBoardItem`.
 *
 * Déplacer et redimensionner passent par les événements pointeur, comme
 * `TimeGrid` : le glisser natif ne donne pas de position continue. La position
 * en cours de geste est calculée ici (`effectiveItems`), jamais écrite tant
 * que le pointeur n'est pas relâché.
 */
import { computed, ref } from 'vue'
import type { VisionBoardItem } from '@/types'
import { useVisionBoards } from '@/store/useVisionBoards'
import { CANVAS_ASPECT } from '@/utils/visionBoard'
import VisionBoardItemView, { type ResizeHandle } from '@/components/visionboard/VisionBoardItemView.vue'

const props = defineProps<{ items: VisionBoardItem[] }>()

const board = useVisionBoards()

const MIN_SIZE = 6

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

type Gesture =
  | { kind: 'move'; id: string; grabX: number; grabY: number; x: number; y: number }
  | {
      kind: 'resize'
      id: string
      handle: ResizeHandle
      anchorX: number
      anchorY: number
      startX: number
      startY: number
      startW: number
      startH: number
      x: number
      y: number
      width: number
      height: number
    }

const gesture = ref<Gesture | null>(null)
const surface = ref<HTMLElement | null>(null)

function pct(e: PointerEvent): { x: number; y: number } {
  const rect = surface.value!.getBoundingClientRect()
  return {
    x: ((e.clientX - rect.left) / rect.width) * 100,
    y: ((e.clientY - rect.top) / rect.height) * 100,
  }
}

function onMoveStart(item: VisionBoardItem, e: PointerEvent) {
  if (e.button !== 0 || !surface.value) return
  const p = pct(e)
  gesture.value = { kind: 'move', id: item.id, grabX: p.x - item.x, grabY: p.y - item.y, x: item.x, y: item.y }
  surface.value.setPointerCapture(e.pointerId)
}

function onResizeStart(item: VisionBoardItem, handle: ResizeHandle, e: PointerEvent) {
  if (e.button !== 0 || !surface.value) return
  const p = pct(e)
  gesture.value = {
    kind: 'resize',
    id: item.id,
    handle,
    anchorX: p.x,
    anchorY: p.y,
    startX: item.x,
    startY: item.y,
    startW: item.width,
    startH: item.height,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
  }
  surface.value.setPointerCapture(e.pointerId)
}

/** Le bord qui bouge tient le curseur ; le bord opposé reste fixe. */
function resizeAxisX(handle: ResizeHandle, startX: number, startW: number, dx: number) {
  if (handle.includes('e')) return { x: startX, width: clamp(startW + dx, MIN_SIZE, 100 - startX) }
  if (handle.includes('w')) {
    const rightEdge = startX + startW
    const x = clamp(startX + dx, 0, rightEdge - MIN_SIZE)
    return { x, width: rightEdge - x }
  }
  return { x: startX, width: startW }
}

function resizeAxisY(handle: ResizeHandle, startY: number, startH: number, dy: number) {
  if (handle.includes('s')) return { y: startY, height: clamp(startH + dy, MIN_SIZE, 100 - startY) }
  if (handle.includes('n')) {
    const bottomEdge = startY + startH
    const y = clamp(startY + dy, 0, bottomEdge - MIN_SIZE)
    return { y, height: bottomEdge - y }
  }
  return { y: startY, height: startH }
}

function onPointerMove(e: PointerEvent) {
  const g = gesture.value
  if (!g || !surface.value) return
  const item = props.items.find((it) => it.id === g.id)
  if (!item) {
    gesture.value = null
    return
  }
  const p = pct(e)

  if (g.kind === 'move') {
    gesture.value = {
      ...g,
      x: clamp(p.x - g.grabX, 0, 100 - item.width),
      y: clamp(p.y - g.grabY, 0, 100 - item.height),
    }
    return
  }
  const ax = resizeAxisX(g.handle, g.startX, g.startW, p.x - g.anchorX)
  const ay = resizeAxisY(g.handle, g.startY, g.startH, p.y - g.anchorY)
  gesture.value = { ...g, x: ax.x, y: ay.y, width: ax.width, height: ay.height }
}

function onPointerUp() {
  const g = gesture.value
  gesture.value = null
  if (!g) return
  const item = props.items.find((it) => it.id === g.id)
  if (!item) return

  if (g.kind === 'move') {
    if (item.x !== g.x || item.y !== g.y) board.updateItem(g.id, { x: g.x, y: g.y })
    return
  }
  if (item.x !== g.x || item.y !== g.y || item.width !== g.width || item.height !== g.height) {
    board.updateItem(g.id, { x: g.x, y: g.y, width: g.width, height: g.height })
  }
}

/** Les éléments tels qu'ils doivent s'afficher *maintenant* — celui qu'on
 *  déplace ou redimensionne porte la position du geste, pas encore écrite. */
const effectiveItems = computed(() =>
  props.items.map((it) => {
    const g = gesture.value
    if (!g || g.id !== it.id) return it
    if (g.kind === 'move') return { ...it, x: g.x, y: g.y }
    return { ...it, x: g.x, y: g.y, width: g.width, height: g.height }
  }),
)

function styleOf(it: VisionBoardItem) {
  return {
    left: `${it.x}%`,
    top: `${it.y}%`,
    width: `${it.width}%`,
    height: `${it.height}%`,
    zIndex: it.zIndex,
  }
}
</script>

<template>
  <div
    ref="surface"
    class="relative w-full touch-none rounded-2xl bg-paper ring-1 ring-ink/[0.08]"
    :style="{ aspectRatio: CANVAS_ASPECT }"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <p v-if="!items.length" class="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] text-ink-faint">
      Ce board est vide — ajoute une image, une note, une couleur ou une carte depuis la barre au-dessus.
    </p>

    <div v-for="it in effectiveItems" :key="it.id" class="absolute" :style="styleOf(it)">
      <VisionBoardItemView
        :item="it"
        :active="gesture !== null && gesture.id === it.id"
        @move-start="onMoveStart"
        @resize-start="onResizeStart"
      />
    </div>
  </div>
</template>
