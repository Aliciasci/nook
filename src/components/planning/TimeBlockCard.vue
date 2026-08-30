<script setup lang="ts">
/**
 * Un créneau sur la grille.
 *
 * La carte se replie à mesure qu'elle rétrécit : un quart d'heure n'a la place
 * que de son titre, une heure y ajoute l'icône et l'horaire, trois heures la
 * durée sur sa propre ligne et le réalisé par-dessus le prévu. Plutôt que de
 * masquer par débordement — ce qui donne des demi-lignes coupées — chaque
 * palier est choisi à la hauteur rendue.
 *
 * Elle se peint par **variables CSS** (`--blk-bg`, `--blk-ink`…) posées en
 * style plutôt que par classes de couleur : une catégorie peut porter une
 * couleur libre, qu'aucune classe Tailwind ne sait dire. Les enfants en
 * héritent, donc rien n'a besoin de reprendre la teinte à son compte.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { FolderColor, TimeBlock, TimeBlockKind } from '@/types'
import { useTimeBlocks } from '@/store/useTimeBlocks'
import { activityColorOf } from '@/composables/useActivityColors'
import { ACTIVITY_KINDS } from '@/utils/activityKinds'
import { resolvePalette, TINTS, TINT_LABELS } from '@/utils/activityPalette'
import { activityIcon } from '@/components/planning/activityIcons'
import { formatDuration, formatDurationShort } from '@/utils/time'
import IconPlaySolid from '@/icons/IconPlaySolid.vue'
import IconMoreHorizontal from '@/icons/IconMoreHorizontal.vue'
import IconTrash from '@/icons/IconTrash.vue'

const props = defineProps<{
  block: TimeBlock
  /** Hauteur rendue, en pixels — dicte ce qui tient dans la carte. */
  height: number
  /** Un déplacement ou un redimensionnement est en cours. */
  active?: boolean
}>()

const emit = defineEmits<{
  focus: [block: TimeBlock]
  remove: [block: TimeBlock]
  moveStart: [block: TimeBlock, e: PointerEvent]
  resizeStart: [block: TimeBlock, e: PointerEvent]
}>()

const blocks = useTimeBlocks()

const label = computed(() => blocks.labelOf(props.block))
const item = computed(() => blocks.itemOf(props.block))
const planned = computed(() => blocks.plannedMinutes(props.block))
const actual = computed(() => blocks.actualMinutes(props.block))
const status = computed(() => blocks.blockStatus(props.block))

/** Les variables que toute la carte — et ses enfants — vont lire. */
function varsOf(color: string | null): Record<string, string> {
  const p = resolvePalette(color)
  return { '--blk-bg': p.bg, '--blk-ink': p.ink, '--blk-ring': p.ring, '--blk-solid': p.solid }
}

const cardVars = computed(() => varsOf(blocks.colorOf(props.block)))

const icon = computed(() => activityIcon(props.block.kind, Boolean(props.block.itemId)))

/* ------------------------------------------------------- Les paliers --- */

/** Sous ~34 px la carte ne peut montrer que son titre, sur une ligne. */
const compact = computed(() => props.height < 34)
/** L'horaire et la durée demandent une deuxième ligne. */
const roomy = computed(() => props.height >= 90)
/** La jauge du réalisé demande la place d'une quatrième ligne. */
const tall = computed(() => props.height >= 132)

const ratio = computed(() => (planned.value <= 0 ? 0 : Math.min(1, actual.value / planned.value)))

function hhmm(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}

const timeRange = computed(() => `${hhmm(props.block.startMinute)} – ${hhmm(props.block.endMinute)}`)

/**
 * Une tâche cochée sans une seule minute de focus reste un créneau tenu — on
 * l'a faite, on ne l'a simplement pas chronométrée. Lui afficher « pas encore
 * commencé » à côté d'un titre barré serait se contredire.
 */
const actualLabel = computed(() => {
  if (actual.value > 0) return `${formatDuration(actual.value)} faites`
  if (item.value?.status === 'done') return 'terminée, sans chrono'
  return 'pas encore commencé'
})

/* ------------------------------------------------------------ Le menu --- */

/**
 * Le menu est téléporté et positionné en fixe, comme celui de l'arborescence
 * de la documentation : la surface de la grille rogne ce qui la dépasse, un
 * menu posé dans la carte serait coupé par le bord bas ou le bord droit.
 */
const menu = ref<{ x: number; y: number } | null>(null)

/**
 * Hauteur estimée du menu. Elle sert à savoir s'il tient sous le bouton ;
 * mesurer après coup demanderait un rendu, un `nextTick` et un saut visible.
 * Généreuse à dessein : trop haute, le menu remonte pour rien ; trop courte,
 * il dépasse du bas de la fenêtre — et le défilement qui suivrait le
 * refermerait.
 */
const MENU_HEIGHT = 320

function openMenu(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  // Sous le bouton s'il y a la place, au-dessus sinon.
  const below = rect.bottom + 6
  const y = below + MENU_HEIGHT <= window.innerHeight ? below : Math.max(8, rect.top - MENU_HEIGHT - 6)
  menu.value = { x: rect.right, y }
}

const menuStyle = computed(() => ({
  left: `${Math.max(8, (menu.value?.x ?? 0) - 236)}px`,
  top: `${menu.value?.y ?? 0}px`,
}))

function closeMenu() {
  menu.value = null
}

// La position est figée à l'ouverture : un défilement la rendrait fausse, et
// la grille de la semaine défile latéralement.
onMounted(() => {
  document.addEventListener('mousedown', closeMenu)
  window.addEventListener('scroll', closeMenu, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', closeMenu)
  window.removeEventListener('scroll', closeMenu, true)
})

function setKind(kind: TimeBlockKind | null) {
  closeMenu()
  if (props.block.kind !== kind) blocks.updateBlock(props.block.id, { kind })
}

/**
 * La couleur posée sur ce créneau-là. Les six teintes seulement : la colonne
 * `color` les vérifie en base, et une couleur libre se décide au niveau de la
 * catégorie, où elle sert à toutes ses cartes plutôt qu'à une seule.
 */
function setColor(color: FolderColor | null) {
  closeMenu()
  if (props.block.color !== color) blocks.updateBlock(props.block.id, { color })
}

/** L'aperçu d'une catégorie dans le menu : sa teinte du moment. */
function kindVars(kind: TimeBlockKind): Record<string, string> {
  return varsOf(activityColorOf(kind))
}
</script>

<template>
  <div
    class="group/blk relative flex h-full flex-col overflow-hidden rounded-xl bg-[var(--blk-bg)] py-1.5 pl-3 pr-1.5 text-[var(--blk-ink)] ring-1 ring-[var(--blk-ring)] transition-shadow select-none"
    :class="[active ? 'shadow-soft-lg' : 'shadow-folder', status === 'missed' ? 'opacity-70' : '']"
    :style="{ ...cardVars, cursor: active ? 'grabbing' : 'grab' }"
    @pointerdown.stop="emit('moveStart', block, $event)"
  >
    <!-- Le trait de couleur, épinglé au bord gauche. C'est la carte qui le
         rogne (`overflow-hidden`) plutôt qu'un arrondi posé dessus : sur
         quatre pixels de large, un `rounded-l-xl` est ramené à un rayon de
         quatre pixels, et le trait dépassait de la courbe de la carte au lieu
         de l'épouser. Le menu ⋯ est téléporté, il ne craint pas le rognage. -->
    <span class="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[var(--blk-solid)]" />

    <div class="flex min-h-0 flex-1 items-start gap-2">
      <!-- L'icône de la catégorie, sur une pastille claire : à même le fond
           pastel, un trait fin de la même famille de teintes se perdrait. -->
      <span v-if="!compact" class="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/70">
        <component :is="icon" class="h-[15px] w-[15px]" />
      </span>

      <div class="min-w-0 flex-1">
        <p
          class="truncate text-[12.5px] font-medium leading-tight"
          :class="item?.status === 'done' ? 'line-through opacity-60' : ''"
        >
          {{ label }}
        </p>

        <p v-if="!compact" class="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] leading-none">
          <!-- C'est l'horaire qui se coupe, pas la ligne : dans une colonne de
               semaine, tronquer l'ensemble mangeait la durée en premier. -->
          <span class="truncate opacity-70">{{ timeRange }}</span>
          <!-- La durée passe sur sa propre ligne dès qu'il y a la place : à
               côté de l'horaire, les deux se lisent comme une seule phrase. -->
          <span v-if="!roomy" class="shrink-0 rounded-full bg-white/60 px-1.5 py-0.5 text-[10.5px] font-medium">
            {{ formatDurationShort(planned) }}
          </span>
        </p>

        <span v-if="roomy" class="mt-1.5 inline-block rounded-full bg-white/60 px-2 py-0.5 text-[11px] font-medium">
          {{ formatDurationShort(planned) }}
        </span>
      </div>

      <!-- Les actions ne s'arment qu'au survol : à trois créneaux serrés, un
           bouton par carte noierait la lecture de la journée. -->
      <button
        v-if="!compact"
        type="button"
        title="Actions du créneau"
        aria-label="Actions du créneau"
        class="shrink-0 rounded-lg p-1 opacity-0 transition-opacity hover:bg-black/[0.06] cursor-pointer group-hover/blk:opacity-100"
        :class="menu ? 'opacity-100' : ''"
        @pointerdown.stop
        @mousedown.stop
        @click.stop="openMenu"
      >
        <IconMoreHorizontal class="h-3.5 w-3.5" />
      </button>
    </div>

    <!-- Réalisé par-dessus prévu. Absent pour un bloc libre : il n'y a rien à
         mesurer, et une jauge vide se lirait comme un échec. -->
    <div v-if="tall && block.itemId" class="mt-auto pt-1">
      <div class="h-1 overflow-hidden rounded-full bg-black/[0.08]">
        <div
          class="h-full rounded-full transition-[width] duration-300"
          :class="status === 'kept' ? 'bg-green-500/70' : status === 'partial' ? 'bg-amber-500/70' : 'bg-transparent'"
          :style="{ width: `${ratio * 100}%` }"
        />
      </div>
      <p class="mt-1 text-[10.5px] leading-none opacity-60">{{ actualLabel }}</p>
    </div>

    <!-- Poignée de redimensionnement, bord bas. -->
    <div
      class="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize opacity-0 transition-opacity group-hover/blk:opacity-100"
      @pointerdown.stop="emit('resizeStart', block, $event)"
    >
      <div class="mx-auto h-0.5 w-6 rounded-full bg-ink/25" />
    </div>
  </div>

  <Teleport to="body">
    <Transition name="pop">
      <div
        v-if="menu"
        class="fixed z-50 w-60 rounded-2xl bg-white p-2 shadow-soft-lg ring-1 ring-ink/[0.08]"
        :style="menuStyle"
        @mousedown.stop
        @pointerdown.stop
      >
        <div class="flex items-baseline justify-between gap-2 px-1.5 pb-1.5">
          <p class="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Catégorie</p>
          <button
            v-if="block.kind"
            type="button"
            class="text-[11px] font-medium text-lavender-600 transition-colors hover:text-lavender-700 cursor-pointer"
            @click="setKind(null)"
          >
            Aucune
          </button>
        </div>
        <div class="flex gap-1.5 px-1">
          <button
            v-for="k in ACTIVITY_KINDS"
            :key="k.id"
            type="button"
            :title="k.label"
            :aria-label="k.label"
            class="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--blk-bg)] text-[var(--blk-ink)] ring-1 transition-transform hover:scale-105 cursor-pointer"
            :class="block.kind === k.id ? 'ring-2 ring-lavender-400' : 'ring-[var(--blk-ring)]'"
            :style="kindVars(k.id)"
            @click="setKind(k.id)"
          >
            <component :is="activityIcon(k.id, false)" class="h-[15px] w-[15px]" />
          </button>
        </div>

        <div class="mt-3 flex items-baseline justify-between gap-2 px-1.5 pb-1.5">
          <p class="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Couleur</p>
          <button
            v-if="block.color"
            type="button"
            title="Rendre la main à la catégorie, ou au dossier de la tâche"
            class="text-[11px] font-medium text-lavender-600 transition-colors hover:text-lavender-700 cursor-pointer"
            @click="setColor(null)"
          >
            Auto
          </button>
        </div>
        <div class="flex gap-1.5 px-1">
          <!-- Chaque pastille est une carte en miniature — même fond, même
               trait de gauche : ce qu'on voit est ce qu'on aura. -->
          <button
            v-for="tint in TINTS"
            :key="tint"
            type="button"
            :title="TINT_LABELS[tint]"
            :aria-label="TINT_LABELS[tint]"
            class="relative h-7 w-7 overflow-hidden rounded-lg bg-[var(--blk-bg)] ring-1 transition-transform hover:scale-105 cursor-pointer"
            :class="block.color === tint ? 'ring-2 ring-lavender-400' : 'ring-[var(--blk-ring)]'"
            :style="varsOf(tint)"
            @click="setColor(tint)"
          >
            <span class="absolute inset-y-0 left-0 w-1 bg-[var(--blk-solid)]" />
          </button>
        </div>

        <div class="my-2 h-px bg-line" />

        <button
          v-if="item && item.status !== 'done'"
          type="button"
          class="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] text-ink-soft transition-colors hover:bg-lavender-50 hover:text-ink cursor-pointer"
          @click="closeMenu(); emit('focus', block)"
        >
          <IconPlaySolid class="h-3.5 w-3.5 text-lavender-500" />
          Démarrer un focus
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] text-ink-soft transition-colors hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
          @click="closeMenu(); emit('remove', block)"
        >
          <IconTrash class="h-3.5 w-3.5" />
          Retirer le créneau
        </button>
      </div>
    </Transition>
  </Teleport>
</template>
