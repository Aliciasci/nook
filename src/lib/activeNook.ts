/**
 * Le nook actif, vu par la couche `services`.
 *
 * Les services n'ont rien de réactif — c'est la règle de la couche — mais ils
 * ont tous besoin de la même valeur pour filtrer leurs lectures et remplir
 * leurs écritures. Elle vit donc ici, dans une variable de module que
 * `useNooks` tient à jour, plutôt que d'être passée en argument à chacune des
 * vingt-cinq fonctions d'accès.
 *
 * Rien ici ne fait autorité côté sécurité : le RLS vérifie de son côté que le
 * nook appartient bien au compte. Ce fichier ne sert qu'à *cadrer* ce que le
 * client demande.
 */

const STORAGE_KEY = 'nook:active-nook-id'

let activeNookId: string | null = null

/** L'identifiant du nook actif, ou `null` tant qu'aucun n'a été choisi. */
export function currentNookId(): string | null {
  return activeNookId
}

/**
 * Comme `currentNookId`, mais pour les appels qui n'ont aucun sens sans nook.
 * Mieux vaut une erreur explicite qu'une requête filtrée sur `null`, qui ne
 * remonterait rien et passerait pour un espace vide.
 */
export function requireNookId(): string {
  if (!activeNookId) {
    throw new Error("[Nook] Aucun nook actif — cette requête n'a pas de périmètre.")
  }
  return activeNookId
}

export function setActiveNookId(id: string | null): void {
  activeNookId = id
  // `null` ne veut pas dire « oublie » : c'est l'état d'une déconnexion ou
  // d'un chargement en cours. Le dernier nook ouvert reste noté pour la
  // prochaine fois — seul un autre nook le remplace.
  if (!id) return
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // Navigation privée, stockage plein, cookies bloqués : le nook actif
    // vient aussi de `profiles.active_nook_id`, on sait s'en passer.
  }
}

/**
 * Le dernier nook ouvert sur ce navigateur. Sert de préférence locale au
 * démarrage, avant que `profiles.active_nook_id` n'ait été lu — et de repli
 * si le profil n'en désigne aucun.
 */
export function rememberedNookId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}
