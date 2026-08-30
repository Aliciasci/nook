import { supabase } from '@/lib/supabase'
import { requireNookId } from '@/lib/activeNook'
import type { Database } from '@/types/database'
import type { DocBlock, DocPage, DocPageFont, DocVideo } from '@/types'

type DocPageRow = Database['public']['Tables']['doc_pages']['Row']

function fromRow(row: DocPageRow): DocPage {
  return {
    id: row.id,
    parentId: row.parent_id,
    title: row.title,
    icon: row.icon,
    position: row.position,
    // Colonne ajoutée après coup : une page écrite avant la migration 0004
    // n'a pas de valeur exploitable.
    font: (row.font ?? 'sans') as DocPageFont,
    // Défensif : la colonne est du jsonb libre, une valeur non conforme ne
    // doit pas casser toute la vue.
    blocks: Array.isArray(row.blocks) ? (row.blocks as DocBlock[]) : [],
    // Colonne ajoutée par la migration 0005, même prudence que pour `blocks`.
    videos: Array.isArray(row.videos) ? (row.videos as DocVideo[]) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listPages(): Promise<DocPage[]> {
  const { data, error } = await supabase
    .from('doc_pages')
    .select('*')
    .eq('nook_id', requireNookId())
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(fromRow)
}

export async function createPage(input: {
  id: string
  title: string
  parentId: string | null
  position: number
  icon?: string | null
  font?: DocPageFont
  blocks?: DocBlock[]
  videos?: DocVideo[]
}): Promise<void> {
  const { error } = await supabase.from('doc_pages').insert({
    id: input.id,
    nook_id: requireNookId(),
    title: input.title,
    parent_id: input.parentId,
    position: input.position,
    icon: input.icon ?? null,
    font: input.font ?? 'sans',
    blocks: input.blocks ?? [],
    videos: input.videos ?? [],
  })
  if (error) throw error
}

export type DocPagePatch = Partial<
  Pick<DocPage, 'title' | 'icon' | 'parentId' | 'position' | 'font' | 'blocks' | 'videos'>
>

export async function updatePage(id: string, patch: DocPagePatch): Promise<void> {
  const payload: Database['public']['Tables']['doc_pages']['Update'] = {}
  if ('title' in patch) payload.title = patch.title
  if ('icon' in patch) payload.icon = patch.icon
  if ('parentId' in patch) payload.parent_id = patch.parentId
  if ('position' in patch) payload.position = patch.position
  if ('font' in patch) payload.font = patch.font
  if ('blocks' in patch) payload.blocks = patch.blocks
  if ('videos' in patch) payload.videos = patch.videos

  const { error } = await supabase.from('doc_pages').update(payload).eq('id', id)
  if (error) throw error
}

/** Les sous-pages partent avec elle (`on delete cascade`). */
export async function deletePage(id: string): Promise<void> {
  const { error } = await supabase.from('doc_pages').delete().eq('id', id)
  if (error) throw error
}
