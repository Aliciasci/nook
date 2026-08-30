import { supabase } from '@/lib/supabase'
import { requireNookId } from '@/lib/activeNook'
import type { Database } from '@/types/database'

export type GardenProgressRow = Database['public']['Tables']['garden_progress']['Row']

// Un jardin par nook : chaque espace fait pousser le sien, à son rythme.
export async function getGardenProgress(): Promise<GardenProgressRow | null> {
  const { data, error } = await supabase
    .from('garden_progress')
    .select('*')
    .eq('nook_id', requireNookId())
    .maybeSingle()
  if (error) throw error
  return data
}

export async function updateGardenProgress(patch: {
  xp?: number
  level?: number
  activeDays?: number
  lastActiveDate?: string | null
  extra?: Record<string, unknown>
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  const payload: Database['public']['Tables']['garden_progress']['Update'] = {}
  if (patch.xp !== undefined) payload.xp = patch.xp
  if (patch.level !== undefined) payload.level = patch.level
  if (patch.activeDays !== undefined) payload.active_days = patch.activeDays
  if (patch.lastActiveDate !== undefined) payload.last_active_date = patch.lastActiveDate
  if (patch.extra !== undefined) payload.extra = patch.extra

  // Same reason as updatePreferences: the row doesn't exist until something
  // creates it, and an UPDATE matching zero rows looks like a success.
  const { error } = await supabase
    .from('garden_progress')
    .upsert({ ...payload, user_id: user.id, nook_id: requireNookId() }, { onConflict: 'nook_id' })
  if (error) throw error
}

/** Best-effort audit log — failures here never block garden progression. */
export async function recordUnlocks(elements: { key: string; type: string }[]): Promise<void> {
  if (elements.length === 0) return
  const nookId = requireNookId()
  const { error } = await supabase.from('garden_unlocks').upsert(
    elements.map((el) => ({ nook_id: nookId, element_key: el.key, element_type: el.type })),
    { onConflict: 'nook_id,element_key', ignoreDuplicates: true },
  )
  if (error) console.warn('[Nook] recordUnlocks failed (non-blocking):', error.message)
}
