import { supabase } from '@/lib/supabase'
import { requireNookId } from '@/lib/activeNook'
import type { Database } from '@/types/database'
import type { FolderColor, ItemType, VisionBoardItem, VisionBoardItemKind } from '@/types'

type VisionBoardItemRow = Database['public']['Tables']['vision_board_items']['Row']

function fromRow(row: VisionBoardItemRow): VisionBoardItem {
  return {
    id: row.id,
    boardId: row.board_id,
    kind: row.kind,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    zIndex: row.z_index,
    color: (row.color as FolderColor | null) ?? null,
    text: row.text,
    imageUrl: row.image_url,
    imagePath: row.image_path,
    itemId: row.item_id,
    itemTitle: row.item_title,
    itemType: (row.item_type as ItemType | null) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listVisionBoardItems(boardId: string): Promise<VisionBoardItem[]> {
  const { data, error } = await supabase.from('vision_board_items').select('*').eq('board_id', boardId)
  if (error) throw error
  return (data ?? []).map(fromRow)
}

export async function createVisionBoardItem(input: {
  id: string
  boardId: string
  kind: VisionBoardItemKind
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  color?: FolderColor | null
  text?: string | null
  imageUrl?: string | null
  imagePath?: string | null
  itemId?: string | null
  itemTitle?: string | null
  itemType?: ItemType | null
}): Promise<void> {
  const { error } = await supabase.from('vision_board_items').insert({
    id: input.id,
    board_id: input.boardId,
    nook_id: requireNookId(),
    kind: input.kind,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    z_index: input.zIndex,
    color: input.color ?? null,
    text: input.text ?? null,
    image_url: input.imageUrl ?? null,
    image_path: input.imagePath ?? null,
    item_id: input.itemId ?? null,
    item_title: input.itemTitle ?? null,
    item_type: input.itemType ?? null,
  })
  if (error) throw error
}

export type VisionBoardItemPatch = Partial<
  Pick<VisionBoardItem, 'x' | 'y' | 'width' | 'height' | 'zIndex' | 'color' | 'text' | 'itemId' | 'itemTitle' | 'itemType'>
>

export async function updateVisionBoardItem(id: string, patch: VisionBoardItemPatch): Promise<void> {
  const payload: Database['public']['Tables']['vision_board_items']['Update'] = {}
  if ('x' in patch) payload.x = patch.x
  if ('y' in patch) payload.y = patch.y
  if ('width' in patch) payload.width = patch.width
  if ('height' in patch) payload.height = patch.height
  if ('zIndex' in patch) payload.z_index = patch.zIndex
  if ('color' in patch) payload.color = patch.color
  if ('text' in patch) payload.text = patch.text
  if ('itemId' in patch) payload.item_id = patch.itemId
  if ('itemTitle' in patch) payload.item_title = patch.itemTitle
  if ('itemType' in patch) payload.item_type = patch.itemType

  const { error } = await supabase.from('vision_board_items').update(payload).eq('id', id)
  if (error) throw error
}

export async function deleteVisionBoardItem(id: string): Promise<void> {
  const { error } = await supabase.from('vision_board_items').delete().eq('id', id)
  if (error) throw error
}
