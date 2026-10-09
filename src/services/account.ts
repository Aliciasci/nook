import { supabase } from '@/lib/supabase'

interface DeleteAccountResponse {
  ok?: boolean
  error?: string
}

/**
 * Supprime le compte du visiteur connecté — tous ses nooks, sans retour
 * possible. Passe par la fonction Edge `delete-account`, seule habilitée à
 * effacer la ligne `auth.users` (clé `service_role`, jamais côté client).
 */
export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke<DeleteAccountResponse>('delete-account')
  if (error) {
    throw new Error(
      "Le service de suppression n'a pas répondu — a-t-il bien été déployé sur ce projet Supabase ?",
    )
  }
  if (!data?.ok) throw new Error(data?.error ?? 'La suppression du compte a échoué.')
}
