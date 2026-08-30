import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { Nook } from '@/types'

type NookRow = Database['public']['Tables']['nooks']['Row']

function fromRow(row: NookRow): Nook {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    position: row.position,
    createdAt: row.created_at,
  }
}

export async function listNooks(): Promise<Nook[]> {
  const { data, error } = await supabase
    .from('nooks')
    .select('*')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(fromRow)
}

/**
 * Nombre de tâches ouvertes par nook, pour l'écran de choix — « 12 tâches »
 * sous chaque carte aide à savoir où l'on va.
 *
 * Une seule requête qui ne ramène que la colonne `nook_id`, comptée côté
 * client : PostgREST ne sait pas faire de `group by`, et une requête par nook
 * coûterait plus cher que quelques centaines d'identifiants.
 */
export async function openTaskCountByNook(): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('items')
    .select('nook_id')
    .eq('type', 'task')
    .neq('status', 'done')
  if (error) throw error
  const counts = new Map<string, number>()
  for (const row of data ?? []) counts.set(row.nook_id, (counts.get(row.nook_id) ?? 0) + 1)
  return counts
}

/**
 * Un nook n'est jamais seul : il lui faut sa ligne de préférences et sa ligne
 * de jardin pour être utilisable. La fonction `create_nook` (migration 0008)
 * fait les trois écritures d'un bloc, pour qu'il n'existe jamais à moitié
 * équipé si le réseau lâche entre deux appels.
 */
export async function createNook(input: {
  name: string
  icon?: string | null
  withStarterFolders?: boolean
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_nook', {
    p_name: input.name,
    p_icon: input.icon ?? null,
    p_with_starter_folders: input.withStarterFolders ?? true,
  })
  if (error) throw error
  return data
}

export type NookPatch = Partial<Pick<Nook, 'name' | 'icon' | 'position'>>

export async function updateNook(id: string, patch: NookPatch): Promise<void> {
  const payload: Database['public']['Tables']['nooks']['Update'] = {}
  if ('name' in patch) payload.name = patch.name
  if ('icon' in patch) payload.icon = patch.icon
  if ('position' in patch) payload.position = patch.position

  const { error } = await supabase.from('nooks').update(payload).eq('id', id)
  if (error) throw error
}

/**
 * Emporte tout le contenu du nook — dossiers, items, liens, doc, jardin,
 * préférences — par cascade. La base refuse de supprimer le dernier nook du
 * compte (trigger `trg_nooks_prevent_last_delete`).
 */
export async function deleteNook(id: string): Promise<void> {
  const { error } = await supabase.from('nooks').delete().eq('id', id)
  if (error) throw error
}

/** Le nook rouvert à la prochaine connexion, sur n'importe quel navigateur. */
export async function setActiveNookOnProfile(nookId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase
    .from('profiles')
    .update({ active_nook_id: nookId })
    .eq('user_id', user.id)
  if (error) throw error
}

/**
 * À quel nook appartient ce contenu ? Le nook actif n'étant pas dans l'URL, un
 * lien `/docs/<id>` ou `/folder/<id>` mis en favori depuis un autre nook
 * pointe sur un identifiant que le client ne trouve pas dans ce qu'il a
 * chargé. Plutôt qu'un « introuvable », il demande ici où va ce lien.
 *
 * Renvoie `null` si l'identifiant n'existe pas, ou n'appartient pas au compte.
 */
export async function nookOf(kind: 'folder' | 'item' | 'doc_page', id: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('nook_of', { p_kind: kind, p_id: id })
  if (error) throw error
  return data
}
