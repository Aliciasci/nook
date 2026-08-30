<script setup lang="ts">
/**
 * Rend un texte avec ses marqueurs de mise en forme — gras, italique,
 * souligné, barré, code, lien, couleur.
 *
 * Même moteur que la documentation (`formatInline`), donc mêmes marqueurs,
 * mêmes styles et mêmes thèmes. `v-html` est sûr par construction : le moteur
 * échappe tout ce qui vient du texte et ne laisse passer que des schémas
 * d'URL validés.
 *
 * Les `[[Page]]` restent du texte brut ici : hors de la doc, le clic ne mène
 * nulle part.
 */
import { computed } from 'vue'
import { formatInline } from '@/utils/docs'

const props = withDefaults(
  defineProps<{
    text?: string | null
    /** Tronque à N lignes — pour les cartes, où la place est comptée. */
    clamp?: number
  }>(),
  { text: '', clamp: 0 },
)

const html = computed(() => formatInline(props.text ?? '', { wikiLinks: false }).html)

const clampStyle = computed(() =>
  props.clamp
    ? {
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical' as const,
        WebkitLineClamp: String(props.clamp),
        overflow: 'hidden',
      }
    : undefined,
)
</script>

<template>
  <div
    v-if="text"
    class="doc-rendered whitespace-pre-wrap break-words"
    :style="clampStyle"
    v-html="html"
  />
</template>
