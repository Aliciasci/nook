import { supabase } from '@/lib/supabase'
import { requireNookId } from '@/lib/activeNook'
import type { Database } from '@/types/database'
import type { ItemLink } from '@/types'

type ItemLinkRow = Database['public']['Tables']['item_links']['Row']

function fromRow(row: ItemLinkRow): ItemLink {
  return {
    itemId: row.item_id,
    linkedItemId: row.linked_item_id,
    createdAt: row.created_at,
  }
}

/**
 * Range une paire dans l'ordre attendu par la base — la contrainte
 * `item_links_ordered` de la migration `0007` n'accepte qu'un sens, ce qui
 * rend le doublon inverse impossible.
 */
export function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

export async function listItemLinks(): Promise<ItemLink[]> {
  const { data, error } = await supabase.from('item_links').select('*').eq('nook_id', requireNookId())
  if (error) throw error
  return (data ?? []).map(fromRow)
}

export async function createItemLink(link: { itemId: string; linkedItemId: string }): Promise<void> {
  const { error } = await supabase.from('item_links').insert({
    nook_id: requireNookId(),
    item_id: link.itemId,
    linked_item_id: link.linkedItemId,
  })
  if (error) throw error
}

export async function deleteItemLink(link: { itemId: string; linkedItemId: string }): Promise<void> {
  const { error } = await supabase
    .from('item_links')
    .delete()
    .eq('item_id', link.itemId)
    .eq('linked_item_id', link.linkedItemId)
  if (error) throw error
}
