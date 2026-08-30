import { supabase } from '@/lib/supabase'
import { requireNookId } from '@/lib/activeNook'
import type { Database } from '@/types/database'

type FocusSessionRow = Database['public']['Tables']['focus_sessions']['Row']

/**
 * Les sessions du nook depuis `sinceIso`, et jusqu'à `untilIso` si donné.
 *
 * La borne haute sert au rapprochement prévu/réalisé du time blocking : la
 * grille regarde un jour précis, parfois passé, pas seulement « depuis ce
 * matin ».
 */
export async function listFocusSessions(sinceIso: string, untilIso?: string): Promise<FocusSessionRow[]> {
  let query = supabase
    .from('focus_sessions')
    .select('*')
    .eq('nook_id', requireNookId())
    .gte('started_at', sinceIso)
  if (untilIso) query = query.lt('started_at', untilIso)

  const { data, error } = await query.order('started_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createFocusSession(input: {
  id: string
  /**
   * Le nook auquel rattacher la session. Par défaut le nook actif — mais une
   * session commencée dans un nook et clôturée après une bascule doit rester
   * dans le sien, d'où ce paramètre.
   */
  nookId?: string
  itemId: string | null
  mode: string | null
  plannedDuration: number
  actualDuration: number
  startedAt: string
  endedAt: string
  completed: boolean
}): Promise<void> {
  const { error } = await supabase.from('focus_sessions').insert({
    id: input.id,
    nook_id: input.nookId ?? requireNookId(),
    item_id: input.itemId,
    mode: input.mode,
    planned_duration: input.plannedDuration,
    actual_duration: input.actualDuration,
    started_at: input.startedAt,
    ended_at: input.endedAt,
    completed: input.completed,
  })
  if (error) throw error
}
