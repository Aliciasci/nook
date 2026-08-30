import type { Item, TimeBlock } from '@/types'
import { KIND_BUCKETS, type KindBucket } from '@/utils/activityKinds'

/**
 * Le rapprochement prévu / réalisé, partagé par le bilan du jour et le
 * rapport de période — les deux répondent à la même question sur des bornes
 * différentes, et deux définitions de « créneau tenu » qui divergeraient
 * seraient pires qu'une seule imparfaite.
 */

export type BlockStatus = 'free' | 'kept' | 'partial' | 'missed'

/** Un créneau tenu à moitié compte comme tenu. Voir `blockStatus`. */
const KEPT_RATIO = 0.5

export interface PlanningSummary {
  blockCount: number
  plannedMin: number
  actualMin: number
  kept: number
  partial: number
  missed: number
  freeBlocks: number
  /**
   * Minutes prévues par catégorie d'activité, « Autre » compris — de quoi
   * dessiner la répartition de la période sans reparcourir les créneaux.
   *
   * C'est le *prévu* qui est réparti, pas le réalisé : la question à laquelle
   * répond ce camembert est « à quoi ai-je donné mon temps », et un créneau
   * sauté a quand même pris la place dans la journée.
   */
  plannedByKind: Record<KindBucket, number>
}

function emptyByKind(): Record<KindBucket, number> {
  return Object.fromEntries(KIND_BUCKETS.map((b) => [b, 0])) as Record<KindBucket, number>
}

export function actualKey(day: string, itemId: string): string {
  return `${day}|${itemId}`
}

/**
 * Secondes de focus par `jour|itemId`.
 *
 * Le jour retenu est celui où la session a *commencé*, à l'horloge locale :
 * c'est ainsi qu'on la retrouve en face du créneau qui l'avait prévue. Une
 * session à cheval sur minuit compte pour le jour où l'on s'y est mis.
 */
export function actualSecondsByDayItem(
  sessions: { item_id: string | null; started_at: string; actual_duration: number }[],
): Map<string, number> {
  const map = new Map<string, number>()
  for (const session of sessions) {
    if (!session.item_id) continue
    const started = new Date(session.started_at)
    const day = `${started.getFullYear()}-${String(started.getMonth() + 1).padStart(2, '0')}-${String(
      started.getDate(),
    ).padStart(2, '0')}`
    const key = actualKey(day, session.item_id)
    map.set(key, (map.get(key) ?? 0) + session.actual_duration)
  }
  return map
}

export function plannedMinutes(block: TimeBlock): number {
  return block.endMinute - block.startMinute
}

export function actualMinutes(block: TimeBlock, actual: Map<string, number>): number {
  if (!block.itemId) return 0
  return Math.round((actual.get(actualKey(block.day, block.itemId)) ?? 0) / 60)
}

/**
 * Un créneau est tenu si sa tâche est terminée, ou si on y a passé au moins la
 * moitié du temps prévu. Le seuil est volontairement indulgent : le but est de
 * distinguer « je m'y suis mis » de « je l'ai sauté », pas de noter la
 * précision de l'estimation.
 *
 * Un bloc libre — réunion, pause, trajet — n'a rien à mesurer : il ne compte
 * ni comme tenu ni comme manqué.
 */
export function blockStatus(block: TimeBlock, item: Item | undefined, actualMin: number): BlockStatus {
  if (!block.itemId) return 'free'
  if (item?.status === 'done') return 'kept'
  if (actualMin === 0) return 'missed'
  return actualMin >= plannedMinutes(block) * KEPT_RATIO ? 'kept' : 'partial'
}

export function summarize(
  blocks: TimeBlock[],
  getItem: (id: string | null) => Item | undefined,
  actual: Map<string, number>,
): PlanningSummary {
  const summary: PlanningSummary = {
    blockCount: blocks.length,
    plannedMin: 0,
    actualMin: 0,
    kept: 0,
    partial: 0,
    missed: 0,
    freeBlocks: 0,
    plannedByKind: emptyByKind(),
  }

  for (const block of blocks) {
    const actualMin = actualMinutes(block, actual)
    summary.plannedByKind[block.kind ?? 'autre'] += plannedMinutes(block)
    summary.plannedMin += plannedMinutes(block)
    summary.actualMin += actualMin
    switch (blockStatus(block, getItem(block.itemId), actualMin)) {
      case 'kept':
        summary.kept++
        break
      case 'partial':
        summary.partial++
        break
      case 'missed':
        summary.missed++
        break
      default:
        summary.freeBlocks++
    }
  }

  return summary
}
