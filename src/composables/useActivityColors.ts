/**
 * La teinte de chaque activité du planning.
 *
 * Le catalogue (`utils/activityKinds`) en propose une par catégorie ; ce qui
 * est ici la remplace, par nook. Rien n'est écrit tant qu'on ne change rien :
 * une catégorie laissée telle quelle n'a pas de clé, et suivra donc le
 * catalogue si celui-ci change un jour.
 *
 * Vit dans `user_preferences.extra`, comme le fond d'écran et la to-do list —
 * six champs sans relation ne valent pas une table, un service et une policy.
 */
import { computed } from 'vue'
import type { TimeBlockKind } from '@/types'
import { prefsState, savePreferences } from '@/composables/usePreferencesStore'
import { activityKind, ACTIVITY_KINDS } from '@/utils/activityKinds'

/** La teinte effective d'une catégorie : la sienne, sinon celle du catalogue. */
export function activityColorOf(kind: TimeBlockKind): string {
  return prefsState.activityColors[kind] ?? activityKind(kind)?.color ?? 'lavender'
}

export function useActivityColors() {
  /** Les six activités avec leur teinte du moment, prêtes à afficher. */
  const kinds = computed(() =>
    ACTIVITY_KINDS.map((k) => ({
      ...k,
      /** La teinte affichée, d'où qu'elle vienne. */
      tint: activityColorOf(k.id),
      /** Vrai si elle a été changée — ce qui donne son sens au bouton « Défaut ». */
      custom: prefsState.activityColors[k.id] !== undefined,
    })),
  )

  /** `null` rend la catégorie à la teinte du catalogue. */
  function setColor(kind: TimeBlockKind, color: string | null) {
    if (color === null) delete prefsState.activityColors[kind]
    else prefsState.activityColors[kind] = color
    savePreferences()
  }

  return { kinds, setColor }
}
