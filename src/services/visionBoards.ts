import { supabase } from '@/lib/supabase'
import { requireNookId } from '@/lib/activeNook'
import type { Database } from '@/types/database'
import type { VisionBoard } from '@/types'

type VisionBoardRow = Database['public']['Tables']['vision_boards']['Row']

function fromRow(row: VisionBoardRow): VisionBoard {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    createdAt: row.created_at,
  }
}

export async function listVisionBoards(): Promise<VisionBoard[]> {
  const { data, error } = await supabase
    .from('vision_boards')
    .select('*')
    .eq('nook_id', requireNookId())
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(fromRow)
}

export async function createVisionBoard(input: { id: string; name: string; position: number }): Promise<void> {
  const { error } = await supabase.from('vision_boards').insert({
    id: input.id,
    nook_id: requireNookId(),
    name: input.name,
    position: input.position,
  })
  if (error) throw error
}

export type VisionBoardPatch = Partial<Pick<VisionBoard, 'name' | 'position'>>

export async function updateVisionBoard(id: string, patch: VisionBoardPatch): Promise<void> {
  const payload: Database['public']['Tables']['vision_boards']['Update'] = {}
  if ('name' in patch) payload.name = patch.name
  if ('position' in patch) payload.position = patch.position

  const { error } = await supabase.from('vision_boards').update(payload).eq('id', id)
  if (error) throw error
}

export async function deleteVisionBoard(id: string): Promise<void> {
  const { error } = await supabase.from('vision_boards').delete().eq('id', id)
  if (error) throw error
}
