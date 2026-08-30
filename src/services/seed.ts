// Dev-only helper: populate the *currently active nook* with Nook's existing
// demo dataset. Never runs automatically — triggered from Settings, gated
// behind import.meta.env.DEV, one user's own rows only.
import { supabase } from '@/lib/supabase'
import { requireNookId } from '@/lib/activeNook'
import { seedFolders, seedItems } from '@/data/seed'

export async function seedDemoData(): Promise<void> {
  const nookId = requireNookId()
  const idMap = new Map<string, string>()
  for (const f of seedFolders) idMap.set(f.id, crypto.randomUUID())

  const { error: foldersError } = await supabase.from('folders').insert(
    seedFolders.map((f) => ({
      id: idMap.get(f.id)!,
      nook_id: nookId,
      name: f.name,
      icon: f.icon ?? null,
      color: f.color,
      position: f.position,
      created_at: f.createdAt,
    })),
  )
  if (foldersError) throw foldersError

  const { error: itemsError } = await supabase.from('items').insert(
    seedItems.map((it) => ({
      id: crypto.randomUUID(),
      nook_id: nookId,
      folder_id: it.folderId ? (idMap.get(it.folderId) ?? null) : null,
      type: it.type,
      title: it.title,
      content: it.content ?? null,
      status: it.status,
      priority: it.priority ?? null,
      due_date: it.dueDate ?? null,
      created_at: it.createdAt,
      updated_at: it.updatedAt,
    })),
  )
  if (itemsError) throw itemsError
}
