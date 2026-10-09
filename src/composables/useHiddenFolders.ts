import { computed } from 'vue'
import {
  HIDDEN_FOLDERS_MAX,
  prefsState,
  savePreferences,
} from '@/composables/usePreferencesStore'
import { useToast } from '@/composables/useToast'

// Référence directe sur le tableau des préférences, comme `useTodoList` :
// le chargement d'un nook le remplit en place, jamais en le remplaçant.
const ids = prefsState.hiddenFolders

/**
 * Les dossiers retirés de la grille de l'accueil.
 *
 * C'est une préférence d'affichage, pas un état du dossier : rien n'est
 * supprimé ni archivé, le dossier garde ses tâches et reste entier dans le
 * menu, la recherche et partout ailleurs. Seule la grande carte de l'accueil
 * s'efface — et le bouton « masqués », au-dessus de la grille, la rend d'un
 * geste.
 *
 * L'état vit dans `user_preferences.extra`, donc par nook et sans migration :
 * un Nook pro chargé peut être allégé pendant que le perso reste complet.
 */
export function useHiddenFolders() {
  const hiddenIds = computed(() => new Set(ids))

  function isHidden(folderId: string): boolean {
    return hiddenIds.value.has(folderId)
  }

  // La ligne de préférences arrive en une requête au démarrage et à chaque
  // bascule de nook. Écrire avant qu'elle soit là poserait une liste vide
  // par-dessus celle de la base.
  const ready = computed(() => prefsState.loaded)

  const hiddenCount = computed(() => ids.length)

  function hide(folderId: string) {
    if (!ready.value || ids.includes(folderId)) return
    if (ids.length >= HIDDEN_FOLDERS_MAX) {
      useToast().error(`Tu ne peux pas masquer plus de ${HIDDEN_FOLDERS_MAX} dossiers.`)
      return
    }
    ids.push(folderId)
    savePreferences()
  }

  function show(folderId: string) {
    if (!ready.value) return
    const idx = ids.indexOf(folderId)
    if (idx === -1) return
    ids.splice(idx, 1)
    savePreferences()
  }

  function showAll() {
    if (!ready.value || !ids.length) return
    ids.splice(0)
    savePreferences()
  }

  return { isHidden, hiddenCount, ready, hide, show, showAll }
}
