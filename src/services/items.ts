import { supabase } from '@/lib/supabase'
import { requireNookId } from '@/lib/activeNook'
import type { Database } from '@/types/database'
import type { Item, ItemStatus, Priority } from '@/types'

type ItemRow = Database['public']['Tables']['items']['Row']

function fromRow(row: ItemRow): Item {
  return {
    id: row.id,
    folderId: row.folder_id,
    type: row.type,
    title: row.title,
    content: row.content,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('nook_id', requireNookId())
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(fromRow)
}

export async function createItem(input: {
  id: string
  type: 'task' | 'note'
  title: string
  content?: string | null
  folderId?: string | null
  status?: ItemStatus
  priority?: Priority | null
  dueDate?: string | null
}): Promise<void> {
  const { error } = await supabase.from('items').insert({
    id: input.id,
    nook_id: requireNookId(),
    type: input.type,
    title: input.title,
    content: input.content ?? null,
    folder_id: input.folderId ?? null,
    status: input.status ?? 'todo',
    priority: input.priority ?? null,
    due_date: input.dueDate ?? null,
  })
  if (error) throw error
}

export async function updateItem(id: string, patch: Partial<Omit<Item, 'id' | 'createdAt'>>): Promise<void> {
  const payload: Database['public']['Tables']['items']['Update'] = {}
  if ('folderId' in patch) payload.folder_id = patch.folderId
  if ('type' in patch) payload.type = patch.type
  if ('title' in patch) payload.title = patch.title
  if ('content' in patch) payload.content = patch.content
  if ('status' in patch) {
    payload.status = patch.status
    payload.completed_at = patch.status === 'done' ? new Date().toISOString() : null
  }
  if ('priority' in patch) payload.priority = patch.priority
  if ('dueDate' in patch) payload.due_date = patch.dueDate
  if ('archivedAt' in patch) payload.archived_at = patch.archivedAt

  const { error } = await supabase.from('items').update(payload).eq('id', id)
  if (error) throw error
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw error
}
