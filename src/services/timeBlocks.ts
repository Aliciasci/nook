import { supabase } from '@/lib/supabase'
import { requireNookId } from '@/lib/activeNook'
import type { Database } from '@/types/database'
import type { FolderColor, TimeBlock, TimeBlockKind } from '@/types'

type TimeBlockRow = Database['public']['Tables']['time_blocks']['Row']

function fromRow(row: TimeBlockRow): TimeBlock {
  return {
    id: row.id,
    itemId: row.item_id,
    title: row.title,
    day: row.day,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    color: (row.color as FolderColor | null) ?? null,
    kind: (row.kind as TimeBlockKind | null) ?? null,
    notes: row.notes,
  }
}

/**
 * Les créneaux d'une plage de jours, bornes comprises.
 *
 * Une plage plutôt qu'un jour, même si l'app n'affiche pour l'instant qu'une
 * journée : la vue semaine n'aura qu'à élargir les bornes, et le store peut
 * charger d'un coup la semaine autour du jour regardé plutôt que de repartir
 * en requête à chaque flèche.
 */
export async function listTimeBlocks(fromDay: string, toDay: string): Promise<TimeBlock[]> {
  const { data, error } = await supabase
    .from('time_blocks')
    .select('*')
    .eq('nook_id', requireNookId())
    .gte('day', fromDay)
    .lte('day', toDay)
    .order('day', { ascending: true })
    .order('start_minute', { ascending: true })
  if (error) throw error
  return (data ?? []).map(fromRow)
}

export async function createTimeBlock(input: {
  id: string
  itemId?: string | null
  title: string
  day: string
  startMinute: number
  endMinute: number
  color?: FolderColor | null
  kind?: TimeBlockKind | null
  notes?: string | null
}): Promise<void> {
  const { error } = await supabase.from('time_blocks').insert({
    id: input.id,
    nook_id: requireNookId(),
    item_id: input.itemId ?? null,
    title: input.title,
    day: input.day,
    start_minute: input.startMinute,
    end_minute: input.endMinute,
    color: input.color ?? null,
    kind: input.kind ?? null,
    notes: input.notes ?? null,
  })
  if (error) throw error
}

export type TimeBlockPatch = Partial<
  Pick<TimeBlock, 'itemId' | 'title' | 'day' | 'startMinute' | 'endMinute' | 'color' | 'kind' | 'notes'>
>

export async function updateTimeBlock(id: string, patch: TimeBlockPatch): Promise<void> {
  const payload: Database['public']['Tables']['time_blocks']['Update'] = {}
  if ('itemId' in patch) payload.item_id = patch.itemId
  if ('title' in patch) payload.title = patch.title
  if ('day' in patch) payload.day = patch.day
  if ('startMinute' in patch) payload.start_minute = patch.startMinute
  if ('endMinute' in patch) payload.end_minute = patch.endMinute
  if ('color' in patch) payload.color = patch.color
  if ('kind' in patch) payload.kind = patch.kind
  if ('notes' in patch) payload.notes = patch.notes

  const { error } = await supabase.from('time_blocks').update(payload).eq('id', id)
  if (error) throw error
}

export async function deleteTimeBlock(id: string): Promise<void> {
  const { error } = await supabase.from('time_blocks').delete().eq('id', id)
  if (error) throw error
}
