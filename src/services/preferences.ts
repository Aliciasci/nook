import { supabase } from '@/lib/supabase'
import { requireNookId } from '@/lib/activeNook'
import type { Database } from '@/types/database'

export type PreferencesRow = Database['public']['Tables']['user_preferences']['Row']
export type PreferencesUpdate = Database['public']['Tables']['user_preferences']['Update']

// Une ligne par nook depuis la migration 0008 : le filtre est indispensable,
// sans lui `maybeSingle()` tomberait sur plusieurs lignes dès le deuxième
// nook et renverrait une erreur.
export async function getPreferences(): Promise<PreferencesRow | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('nook_id', requireNookId())
    .maybeSingle()
  if (error) throw error
  return data
}

// Upsert, not update: nothing creates the user_preferences row at signup, so
// an UPDATE on a fresh account matches zero rows and reports success — every
// preference silently failed to persist. Writing through the unique nook_id
// makes the first save create the row.
export async function updatePreferences(patch: PreferencesUpdate): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase
    .from('user_preferences')
    .upsert({ ...patch, user_id: user.id, nook_id: requireNookId() }, { onConflict: 'nook_id' })
  if (error) throw error
}
