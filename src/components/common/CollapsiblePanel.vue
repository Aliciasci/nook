<script setup lang="ts">
/**
 * Une carte de la colonne de droite de l'accueil, repliable sur sa seule
 * ligne de titre.
 *
 * Le titre lui-même est le bouton : sur un panneau, c'est la bande entière
 * qu'on vise, pas un chevron de 14 px. Les actions de l'en-tête (bascule de
 * sélection…) restent en dehors de ce bouton — les imbriquer poserait un
 * bouton dans un bouton, et un clic dessus replierait le panneau au passage.
 *
 * Replié, l'en-tête garde sa pastille : une bande qui ne dit plus rien de ce
 * qu'elle cache n'est qu'un trait de plus dans la colonne.
 *
 * Le chevron ne se montre qu'au survol du panneau — un en-tête au repos n'a
 * pas à porter un bouton en permanence. Deux exceptions, sans quoi le geste
 * deviendrait invisible : replié, il reste affiché (c'est le seul signe qu'il
 * y a quelque chose dessous), et il réapparaît à la tabulation. Il s'efface en
 * opacité et garde sa place : le faire disparaître décalerait le titre à
 * chaque passage de souris.
 */
import { computed } from 'vue'
import { usePanels, type HomePanelId } from '@/composables/usePanels'
import IconChevronLeft from '@/icons/IconChevronLeft.vue'

const props = defineProps<{ panelId: HomePanelId; title: string }>()

const panels = usePanels()
const collapsed = computed(() => panels.isPanelCollapsed(props.panelId))
</script>

<template>
  <div
    class="group/panel rounded-2xl bg-white shadow-soft ring-1 ring-ink/[0.08] transition-[padding]"
    :class="collapsed ? 'px-5 py-3.5' : 'p-5'"
  >
    <div class="flex items-center justify-between gap-2">
      <button
        type="button"
        class="group/head flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
        :aria-expanded="!collapsed"
        :title="collapsed ? 'Déplier' : 'Réduire'"
        @click="panels.togglePanel(panelId)"
      >
        <IconChevronLeft
          class="h-3.5 w-3.5 shrink-0 text-ink-faint transition group-hover/head:text-lavender-600"
          :class="
            collapsed
              ? 'rotate-180'
              : '-rotate-90 opacity-0 group-hover/panel:opacity-100 group-focus-visible/head:opacity-100'
          "
        />
        <h2 class="truncate font-display text-[15px] font-medium text-ink">{{ title }}</h2>
        <slot name="badge" />
      </button>

      <!-- Repliées avec le corps : ces actions agissent sur des lignes qu'on
           ne voit plus. La pastille, elle, reste — c'est ce qui donne encore
           un sens à la bande. -->
      <template v-if="!collapsed">
        <slot name="actions" />
      </template>
    </div>

    <div v-if="!collapsed">
      <slot />
    </div>
  </div>
</template>
