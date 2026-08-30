import { computed, reactive, watch } from 'vue'
import type { Nook } from '@/types'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { currentNookId, rememberedNookId, setActiveNookId } from '@/lib/activeNook'
import * as nooksApi from '@/services/nooks'
import { getProfile } from '@/services/profiles'

interface NooksState {
  nooks: Nook[]
  activeId: string | null
  isLoading: boolean
  loaded: boolean
  /** Une bascule est en cours : les stores se rechargent. */
  switching: boolean
}

const state = reactive<NooksState>({
  nooks: [],
  activeId: null,
  isLoading: true,
  loaded: false,
  switching: false,
})

const auth = useAuth()

/* --------------------------------------------- Vidage avant bascule --- */

type FlushFn = () => void | Promise<void>

const beforeSwitchHooks = new Set<FlushFn>()

/**
 * Enregistre un vidage à exécuter avant tout changement de nook.
 *
 * Les stores écrivent en différé — 300 ms pour le jardin, 400 ms pour les
 * préférences, 700 ms pour la documentation — et chacun résout le nook au
 * moment où l'écriture part, pas au moment où elle est demandée. Une bascule
 * pendant ce délai écrirait donc les valeurs de l'ancien nook dans le
 * nouveau. On les vide d'abord.
 */
export function onBeforeNookSwitch(fn: FlushFn): void {
  beforeSwitchHooks.add(fn)
}

async function runBeforeSwitch(): Promise<void> {
  // `allSettled` : une sauvegarde qui échoue ne doit pas retenir l'utilisateur
  // dans un nook — son store a déjà signalé l'erreur de son côté.
  await Promise.allSettled([...beforeSwitchHooks].map((fn) => fn()))
}

/* ------------------------------------------------- Chargement / reset --- */

let loadToken = 0
let loadPromise: Promise<void> | null = null
/** Le compte pour lequel `state.nooks` est à jour. */
let loadedForUserId: string | null = null

/**
 * Choisit le nook à ouvrir : celui de ce navigateur en priorité — c'est le
 * plus récent des deux signaux — puis celui du profil, qui suit le compte
 * d'une machine à l'autre, puis le premier de la liste.
 */
function resolveActive(nooks: Nook[], profileNookId: string | null): string | null {
  const exists = (id: string | null) => (id && nooks.some((n) => n.id === id) ? id : null)
  return exists(rememberedNookId()) ?? exists(profileNookId) ?? nooks[0]?.id ?? null
}

function applyActive(id: string | null) {
  // Le module d'abord : les stores qui réagissent à `state.activeId` appellent
  // `requireNookId()` et doivent y trouver la nouvelle valeur.
  setActiveNookId(id)
  state.activeId = id
}

async function load() {
  const token = ++loadToken
  const userId = auth.state.user?.id ?? null
  state.isLoading = true
  try {
    // Deux requêtes en parallèle plutôt qu'une dépendance à `useProfile` :
    // celui-ci charge le profil pour l'afficher, on le lit ici pour le nook
    // actif, et aucun des deux n'a à attendre l'autre.
    const [nooks, profile] = await Promise.all([nooksApi.listNooks(), getProfile()])
    if (token !== loadToken) return
    state.nooks = nooks
    applyActive(resolveActive(nooks, profile?.active_nook_id ?? null))
  } catch {
    if (token !== loadToken) return
    loadPromise = null // autorise une nouvelle tentative
    useToast().error('Impossible de charger tes nooks. Vérifie ta connexion et réessaie.')
  } finally {
    if (token === loadToken) {
      state.isLoading = false
      state.loaded = true
      loadedForUserId = userId
    }
  }
}

function reset() {
  loadToken++
  loadPromise = null
  loadedForUserId = null
  state.nooks = []
  applyActive(null)
  state.isLoading = true
  state.loaded = false
}

/**
 * Attend de savoir quel nook est actif. La garde du routeur l'appelle après
 * `authReady` : elle ne peut pas se contenter d'attendre que le `watch`
 * ci-dessous se déclenche, puisque Vue les diffère au tick suivant.
 *
 * Une promesse unique et définitive ne suffirait pas non plus — se déconnecter
 * puis se reconnecter sans recharger la page relance un cycle complet.
 */
export async function ensureNooksLoaded(): Promise<void> {
  const userId = auth.state.user?.id ?? null
  if (!userId) return
  if (loadedForUserId === userId && state.loaded && !state.isLoading) return
  if (!loadPromise) loadPromise = load()
  await loadPromise
}

// Pas de `immediate`, et une comparaison sur l'identifiant plutôt que sur la
// session : la garde du routeur appelle `ensureNooksLoaded` dès qu'`authReady`
// est tenue, souvent avant que ce `watch` ne se déclenche. Sans cette garde
// d'égalité, il relancerait derrière elle un second chargement qui invaliderait
// le premier en plein milieu de la navigation.
watch(auth.session, (session) => {
  const userId = session?.user.id ?? null
  if (userId === loadedForUserId) return
  reset()
  if (userId) loadPromise = load()
})

/* ------------------------------------------- Choix au démarrage --- */

// L'écran de choix s'ouvre une fois par session de navigation. Un simple
// rechargement de page (F5) ne doit pas redemander où l'on va : sessionStorage
// survit au rechargement et meurt avec l'onglet, ce qui est exactement la
// durée voulue.
const PICKED_KEY = 'nook:picked-this-session'

function hasPickedThisSession(): boolean {
  try {
    return sessionStorage.getItem(PICKED_KEY) === '1'
  } catch {
    // Sans sessionStorage, on considère le choix fait : mieux vaut entrer
    // directement dans le dernier nook que redemander à chaque navigation.
    return true
  }
}

function markPickedThisSession() {
  try {
    sessionStorage.setItem(PICKED_KEY, '1')
  } catch {
    /* voir ci-dessus */
  }
}

function forgetPickedThisSession() {
  try {
    sessionStorage.removeItem(PICKED_KEY)
  } catch {
    /* voir ci-dessus */
  }
}

export function useNooks() {
  const nooks = computed(() => state.nooks)
  const activeId = computed(() => state.activeId)
  const active = computed(() => state.nooks.find((n) => n.id === state.activeId) ?? null)

  async function switchTo(id: string): Promise<void> {
    if (id === state.activeId) return
    if (!state.nooks.some((n) => n.id === id)) return

    state.switching = true
    try {
      await runBeforeSwitch()
      applyActive(id)
      // Le profil suit le compte : le prochain navigateur ouvrira le même
      // nook. Sans attente — la bascule locale a déjà eu lieu.
      void nooksApi.setActiveNookOnProfile(id).catch(() => {
        /* le nook de ce navigateur est déjà à jour, ce n'est pas bloquant */
      })
    } finally {
      state.switching = false
    }
  }

  async function create(input: { name: string; icon?: string | null; withStarterFolders?: boolean }): Promise<string | null> {
    try {
      const id = await nooksApi.createNook(input)
      state.nooks = await nooksApi.listNooks()
      return id
    } catch {
      useToast().error("Ce nook n'a pas pu être créé.")
      return null
    }
  }

  async function rename(id: string, patch: nooksApi.NookPatch): Promise<void> {
    const nook = state.nooks.find((n) => n.id === id)
    if (!nook) return
    const before = { name: nook.name, icon: nook.icon, position: nook.position }
    Object.assign(nook, patch)
    try {
      await nooksApi.updateNook(id, patch)
    } catch {
      Object.assign(nook, before)
      useToast().error("Ce nook n'a pas pu être renommé.")
    }
  }

  /**
   * Range un nook à une nouvelle place. Même forme que `moveFolder` : l'ordre
   * change tout de suite à l'écran, les positions partent ensuite, et un seul
   * échec remet tout l'ordre d'avant — un rangement à moitié enregistré serait
   * plus déroutant qu'un rangement refusé.
   */
  function moveNook(id: string, toIndex: number) {
    const from = state.nooks.findIndex((n) => n.id === id)
    const to = Math.max(0, Math.min(toIndex, state.nooks.length - 1))
    if (from === -1 || from === to) return

    const snapshot = state.nooks.map((nook) => ({ id: nook.id, position: nook.position }))
    const ordered = state.nooks.slice()
    ordered.splice(to, 0, ...ordered.splice(from, 1))

    const changed: Nook[] = []
    ordered.forEach((nook, index) => {
      if (nook.position === index) return
      nook.position = index
      changed.push(nook)
    })
    state.nooks = ordered
    if (!changed.length) return

    Promise.all(changed.map((nook) => nooksApi.updateNook(nook.id, { position: nook.position }))).catch(() => {
      const previous = new Map(snapshot.map((entry) => [entry.id, entry.position]))
      for (const nook of state.nooks) {
        const position = previous.get(nook.id)
        if (position !== undefined) nook.position = position
      }
      state.nooks = state.nooks
        .slice()
        .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
      useToast().error("L'ordre des nooks n'a pas pu être enregistré.")
    })
  }

  /**
   * Emporte tout le contenu du nook. L'appelant confirme — c'est irréversible.
   * Supprimer le nook ouvert bascule d'abord sur un autre : la base refuse de
   * laisser le compte sans aucun nook.
   */
  async function remove(id: string): Promise<boolean> {
    if (state.nooks.length <= 1) {
      useToast().error('Il faut au moins un nook — renomme-le plutôt que de le supprimer.')
      return false
    }
    const fallback = state.nooks.find((n) => n.id !== id)
    if (!fallback) return false

    if (id === state.activeId) await switchTo(fallback.id)

    try {
      await nooksApi.deleteNook(id)
      state.nooks = state.nooks.filter((n) => n.id !== id)
      return true
    } catch {
      useToast().error("Ce nook n'a pas pu être supprimé.")
      return false
    }
  }

  return {
    state,
    nooks,
    active,
    activeId,
    isLoading: computed(() => state.isLoading),
    loaded: computed(() => state.loaded),
    switching: computed(() => state.switching),
    hasNooks: computed(() => state.nooks.length > 0),
    switchTo,
    create,
    rename,
    moveNook,
    remove,
    hasPickedThisSession,
    markPickedThisSession,
    forgetPickedThisSession,
  }
}

/** Pour les gardes du routeur, qui n'ont pas de contexte de composant. */
export function activeNookIdNow(): string | null {
  return currentNookId()
}
