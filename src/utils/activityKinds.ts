import type { FolderColor, TimeBlockKind } from '@/types'

/**
 * Les six activités que le planning sait nommer.
 *
 * Une liste fermée, pas des étiquettes libres : c'est ce qui permet à la
 * « Répartition » de compter quelque chose. Six suffisent à décrire une
 * journée sans obliger à choisir — au-delà, ranger devient un travail.
 *
 * La teinte est une des six couleurs des dossiers, pas une valeur en dur :
 * elle suit donc le thème actif, et « travail » reste lavande en clair comme
 * en sombre sans une ligne de plus.
 */
export interface ActivityKind {
  id: TimeBlockKind
  label: string
  color: FolderColor
}

export const ACTIVITY_KINDS: ActivityKind[] = [
  { id: 'travail', label: 'Travail', color: 'lavender' },
  { id: 'focus', label: 'Focus', color: 'pink' },
  { id: 'reunion', label: 'Réunion', color: 'blue' },
  { id: 'etude', label: 'Étude', color: 'green' },
  { id: 'sport', label: 'Sport', color: 'peach' },
  { id: 'pause', label: 'Pause', color: 'beige' },
]

const BY_ID = new Map<TimeBlockKind, ActivityKind>(ACTIVITY_KINDS.map((k) => [k.id, k]))

export function activityKind(kind: TimeBlockKind | null | undefined): ActivityKind | null {
  return kind ? (BY_ID.get(kind) ?? null) : null
}

/**
 * Les paniers de la répartition : les six catégories, plus les créneaux qui
 * n'en portent aucune. « Autre » est un regroupement d'affichage — rien ne
 * s'écrit sous ce nom en base, une catégorie absente reste absente.
 */
export type KindBucket = TimeBlockKind | 'autre'

export const KIND_BUCKETS: KindBucket[] = [...ACTIVITY_KINDS.map((k) => k.id), 'autre']

export function bucketLabel(bucket: KindBucket): string {
  return bucket === 'autre' ? 'Autre' : (BY_ID.get(bucket)?.label ?? 'Autre')
}
