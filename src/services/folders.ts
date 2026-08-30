import { supabase } from '@/lib/supabase'
import { requireNookId } from '@/lib/activeNook'
import type { Database } from '@/types/database'
import type { Folder, FolderColor } from '@/types'

type FolderRow = Database['public']['Tables']['folders']['Row']

function fromRow(row: FolderRow): Folder {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon ?? undefined,
    color: row.color as FolderColor,
    // Colonne ajoutée par la migration 0006 : un dossier écrit avant elle
    // n'a pas de rang exploitable.
    position: row.position ?? 0,
    createdAt: row.created_at,
  }
}

export async function listFolders(): Promise<Folder[]> {
  // Le rang d'abord ; la date départage les ex æquo, dont les dossiers créés
  // avant la migration 0006.
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('nook_id', requireNookId())
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(fromRow)
}

export async function createFolder(input: {
  id: string
  name: string
  icon?: string
  color: FolderColor
  position: number
}): Promise<void> {
  const { error } = await supabase.from('folders').insert({
    id: input.id,
    nook_id: requireNookId(),
    name: input.name,
    icon: input.icon ?? null,
    color: input.color,
    position: input.position,
  })
  if (error) throw error
}

export type FolderPatch = Partial<Pick<Folder, 'name' | 'icon' | 'color' | 'position'>>

export async function updateFolder(id: string, patch: FolderPatch): Promise<void> {
  const payload: Database['public']['Tables']['folders']['Update'] = {}
  if ('name' in patch) payload.name = patch.name
  if ('icon' in patch) payload.icon = patch.icon ?? null
  if ('color' in patch) payload.color = patch.color
  if ('position' in patch) payload.position = patch.position

  const { error } = await supabase.from('folders').update(payload).eq('id', id)
  if (error) throw error
}

export async function deleteFolder(id: string): Promise<void> {
  const { error } = await supabase.from('folders').delete().eq('id', id)
  if (error) throw error
}
