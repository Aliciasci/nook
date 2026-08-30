import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export type ProfileRow = Database['public']['Tables']['profiles']['Row']

export async function getProfile(): Promise<ProfileRow | null> {
  const { data, error } = await supabase.from('profiles').select('*').maybeSingle()
  if (error) throw error
  return data
}
