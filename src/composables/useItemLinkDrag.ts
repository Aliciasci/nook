import { computed, ref } from 'vue'
import type { Item } from '@/types'
import { useStore } from '@/store/useStore'
import { useToast } from '@/composables/useToast'

/**
 * Lier deux éléments en déposant l'un sur l'autre.
 *
 * Le lien n'a pas de sens de lecture — une note sur une tâche ou une tâche sur
 * une note, c'est le même lien — donc le geste marche dans les deux sens.
 *
 * L'élément attrapé est retenu ici, dans une variable de module, et pas
 * seulement dans le `dataTransfer` : pendant un survol, `getData()` renvoie une
 * chaîne vide (le navigateur ne révèle le contenu qu'au dépôt). Sans ce
 * doublon, impossible de savoir s'il faut éclairer la cible.
 */

/** Le type MIME propre à Nook ; `text/plain` sert de repli pour Firefox. */
export const ITEM_MIME = 'application/x-nook-item'

const dragged = ref<Item | null>(null)

export function useItemLinkDrag() {
  const store = useStore()
  const toast = useToast()

  const isDragging = computed(() => dragged.value !== null)

  function start(item: Item, e: DragEvent) {
    dragged.value = item
    if (!e.dataTransfer) return
    e.dataTransfer.setData(ITEM_MIME, item.id)
    e.dataTransfer.setData('text/plain', item.id)
    e.dataTransfer.effectAllowed = 'link'
  }

  function end() {
    dragged.value = null
  }

  /**
   * Cet élément peut-il recevoir ce qui est en train d'être glissé ?
   * Non sur lui-même, et non si le lien existe déjà — éclairer une cible qui
   * ne changerait rien serait mentir sur ce que le dépôt va faire.
   */
  function accepts(target: Item): boolean {
    const source = dragged.value
    if (!source || source.id === target.id) return false
    return !store.linkedItems(target.id).some((i) => i.id === source.id)
  }

  /** Pose le lien. Renvoie `false` si le dépôt n'avait rien à faire. */
  function drop(target: Item): boolean {
    const source = dragged.value
    dragged.value = null
    if (!source || source.id === target.id) return false
    if (store.linkedItems(target.id).some((i) => i.id === source.id)) return false

    store.linkItems(target.id, source.id)
    toast.push(`« ${source.title} » et « ${target.title} » sont maintenant liés.`)
    return true
  }

  return { isDragging, dragged: computed(() => dragged.value), start, end, accepts, drop }
}
