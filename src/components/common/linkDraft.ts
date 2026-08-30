/**
 * Liens en attente, tant que l'item porteur n'existe pas encore. Pendant une
 * création, `LinkedItemsPanel` ne peut rien écrire : il note ce qui a été
 * demandé, et `QuickCreateModal` l'applique juste après la création.
 *
 * Dans un module à part parce qu'un `<script setup>` ne peut rien exporter.
 */
export interface LinkDraft {
  /** Items déjà existants, à lier. */
  linkIds: string[]
  /** Notes à créer puis à lier, réduites à leur titre. */
  newNoteTitles: string[]
}

export function emptyLinkDraft(): LinkDraft {
  return { linkIds: [], newNoteTitles: [] }
}
