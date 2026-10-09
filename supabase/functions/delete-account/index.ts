// Supprime le compte appelant, pour de bon.
//
// La cascade `on delete cascade` depuis `auth.users` (voir migration 0001 et
// le commentaire au-dessus de `prevent_last_nook_delete` dans 0008) efface
// déjà profil, nooks, dossiers, items, liens, doc pages, préférences, jardin
// et sessions de focus dès que la ligne `auth.users` disparaît. Mais deux
// choses ne suivent pas cette cascade, parce qu'elles ne sont pas des lignes
// Postgres :
//   - les fichiers dans les buckets `backgrounds` et `vision-boards`
//     (`storage.objects` référence son propriétaire par chemin, pas par
//     clé étrangère) — cette fonction les liste et les efface d'abord ;
//   - la ligne `auth.users` elle-même, que seule l'API admin peut supprimer
//     (le rôle `authenticated` n'a aucun droit dessus). D'où la clé
//     `service_role`, jamais exposée au client, utilisée seulement ici.
//
// Comme `extract-pin-image` : réponse toujours 200, JSON `{ ok }` ou
// `{ error }`, pour n'avoir qu'une seule forme de réponse à lire côté client.
//
// Déploiement : `supabase functions deploy delete-account`, ou coller ce
// fichier dans dashboard Supabase → Edge Functions → New function.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const STORAGE_BUCKETS = ['backgrounds', 'vision-boards']

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** L'utilisateur à l'origine de l'appel, ou `null` s'il n'est pas authentifié. */
async function authenticatedUserId(req: Request): Promise<string | null> {
  const header = req.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) return null

  const supabase = createClient(supabaseUrl, anonKey)
  const { data, error } = await supabase.auth.getUser(header.slice('Bearer '.length))
  return error || !data.user ? null : data.user.id
}

/** Vide le dossier `<userId>/` d'un bucket. Un bucket vide ou absent n'est pas une erreur. */
async function emptyUserFolder(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  userId: string,
): Promise<void> {
  const { data: files, error: listError } = await admin.storage.from(bucket).list(userId, { limit: 1000 })
  if (listError || !files?.length) return

  const paths = files.map((f) => `${userId}/${f.name}`)
  await admin.storage.from(bucket).remove(paths)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const userId = await authenticatedUserId(req)
  if (!userId) return json({ error: 'Authentification requise.' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Le service de suppression n'est pas configuré côté serveur." }, 500)
  }
  const admin = createClient(supabaseUrl, serviceRoleKey)

  for (const bucket of STORAGE_BUCKETS) {
    await emptyUserFolder(admin, bucket, userId)
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) {
    return json({ error: "La suppression du compte a échoué. Réessaie, ou contacte le support." }, 500)
  }

  return json({ ok: true })
})
