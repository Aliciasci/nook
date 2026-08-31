export type FolderColor =
  | 'blue'
  | 'green'
  | 'pink'
  | 'beige'
  | 'lavender'
  | 'peach'

export interface Folder {
  id: string
  name: string
  icon?: string
  color: FolderColor
  /** Rang dans « Mes dossiers ». Les trous sont tolérés, le client trie. */
  position: number
  createdAt: string
}

export type ItemType = 'task' | 'note'

export type ItemStatus = 'todo' | 'in_progress' | 'done'

export type Priority = 'low' | 'medium' | 'high'

export interface Item {
  id: string
  folderId: string | null
  type: ItemType
  title: string
  content?: string | null
  status: ItemStatus
  priority?: Priority | null
  dueDate?: string | null
  /**
   * Quand l'item a été archivé, ou `null` s'il ne l'est pas. Une tâche ou une
   * note archivée quitte l'Inbox, ses dossiers, « À faire » et « Terminées »
   * — elle n'apparaît plus que dans « Archive ». Rangée séparément de
   * `status` : archiver n'est pas un état d'avancement, une tâche en cours
   * comme une tâche faite peuvent l'une comme l'autre être mises de côté.
   */
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Lien entre deux items — une tâche et sa note, le plus souvent, mais rien
 * n'interdit deux tâches qui vont ensemble.
 *
 * Le lien n'a pas de sens de lecture : la paire est rangée une seule fois,
 * dans l'ordre de ses identifiants (`itemId` < `linkedItemId`). Le store
 * expose les deux sens, la base n'en stocke qu'un.
 */
export interface ItemLink {
  itemId: string
  linkedItemId: string
  createdAt: string
}

export type FocusAmbiance = 'silence' | 'rain' | 'coffee' | 'ocean' | 'nature' | 'white-noise'

export interface FocusSession {
  id: string
  taskId: string
  taskTitle: string
  plannedMinutes: number
  actualSeconds: number
  startedAt: string
  endedAt: string
  sessionNumber: number
  completed: boolean
}

export type SpotifyConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface SpotifyTrack {
  id: string
  name: string
  artist: string
  albumName: string
  albumArtUrl: string | null
  durationMs: number
}

export interface SpotifyPlaybackState {
  track: SpotifyTrack | null
  isPlaying: boolean
  progressMs: number
}

/* ------------------------------------------------------ Documentation --- */

export type DocBlockType =
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'paragraph'
  | 'code'
  | 'bulleted'
  | 'numbered'
  | 'quote'
  | 'callout'
  | 'divider'

/**
 * Fond d'un bloc. Mêmes teintes que les dossiers et que la couleur de texte :
 * chaque thème les redéfinit, en clair comme en sombre.
 */
export type DocBlockBackground = 'blue' | 'green' | 'pink' | 'beige' | 'lavender' | 'peach'

export interface DocBlock {
  id: string
  type: DocBlockType
  /** Texte brut du bloc, avec ses marqueurs inline (`**gras**`, `[[Page]]`…). */
  text: string
  /** Blocs `code` uniquement — sert d'étiquette, pas de coloration. */
  language?: string
  /** Absent = pas de fond. Ni les blocs `code` ni les séparateurs n'en ont. */
  background?: DocBlockBackground
}

/** Famille de caractères d'une page, appliquée à tout son contenu. */
export type DocPageFont = 'sans' | 'serif' | 'mono'

/**
 * Vidéo YouTube épinglée à une page — un cours, le plus souvent, d'où le
 * repère de lecture gardé pour chacune.
 */
export interface DocVideo {
  id: string
  /** Identifiant YouTube, 11 caractères. */
  videoId: string
  title: string
  /** Reprise de lecture, en secondes. */
  seconds: number
  /** Durée totale, relevée au premier lancement. `0` tant qu'elle est inconnue. */
  duration: number
  addedAt: string
}

export interface DocPage {
  id: string
  parentId: string | null
  title: string
  icon: string | null
  /** Rang parmi les pages de même parent. */
  position: number
  font: DocPageFont
  blocks: DocBlock[]
  /** Vidéos de la page, dans l'ordre d'ajout. */
  videos: DocVideo[]
  createdAt: string
  updatedAt: string
}

/** Page + ses enfants, telle que l'arborescence de la sidebar la consomme. */
export interface DocPageNode extends DocPage {
  children: DocPageNode[]
  depth: number
}

/* ------------------------------------------------------------- Nooks --- */

/**
 * Un espace complet et indépendant — un Nook pro, un Nook perso. Il porte ses
 * dossiers, ses items, sa documentation, son thème et son jardin ; seul le
 * compte (profil, identifiants, Spotify) reste commun.
 *
 * Le nook actif n'est pas dans l'URL : il est retenu par navigateur et sur
 * `profiles.active_nook_id`. Les services filtrent dessus à chaque lecture.
 */
export interface Nook {
  id: string
  name: string
  /** Emoji, comme pour les dossiers. */
  icon: string | null
  /** Rang dans le sélecteur. Les trous sont tolérés, le client trie. */
  position: number
  createdAt: string
}

/* ------------------------------------------------------- Time blocking --- */

/**
 * Un créneau posé sur une journée — le *prévu*.
 *
 * Il porte soit une tâche du nook (`itemId`), soit rien d'autre que son
 * intitulé : réunion, déjeuner, trajet. Les deux comptent, sinon les trous de
 * la grille mentiraient sur le temps réellement disponible.
 *
 * Les heures sont des minutes depuis minuit, à l'horloge murale — un créneau
 * est une intention locale, pas un instant absolu. Voir la migration `0009`.
 */
/**
 * La catégorie d'un créneau — ce que c'est, pas de quelle couleur c'est.
 * `null` pour un créneau posé sans le dire : voir `activityKinds.ts`.
 */
export type TimeBlockKind = 'travail' | 'focus' | 'reunion' | 'etude' | 'sport' | 'pause'

export interface TimeBlock {
  id: string
  /** `null` pour un bloc libre. */
  itemId: string | null
  /**
   * Étiquette du bloc libre. Pour un bloc de tâche, copie du titre au moment
   * où il a été posé : elle ne sert que si la tâche est supprimée ensuite —
   * tant qu'`itemId` tient, c'est le titre vivant de la tâche qui s'affiche.
   */
  title: string
  /** Jour ISO, `yyyy-mm-dd`. */
  day: string
  startMinute: number
  endMinute: number
  color: FolderColor | null
  /** Catégorie d'activité, ou `null` — elle donne l'icône et la teinte par défaut. */
  kind: TimeBlockKind | null
  notes: string | null
}

/* --------------------------------------------------------- Vision board --- */

/**
 * Un canvas libre — plusieurs par nook, nommés (« Voyage 2027 », « Déco
 * salon »…). Ses éléments vivent dans `VisionBoardItem`, chargés à part.
 */
export interface VisionBoard {
  id: string
  name: string
  /** Rang dans les onglets du sélecteur. */
  position: number
  createdAt: string
}

export type VisionBoardItemKind = 'image' | 'note' | 'color' | 'link' | 'section'

/**
 * Un élément posé librement sur un board — image, note, pastille de couleur,
 * carte-lien vers une tâche/note du nook, ou section (une zone de fond pour
 * regrouper visuellement d'autres éléments, sans lien de données entre eux).
 *
 * Les cinq natures partagent une seule forme, comme `TimeBlock` partage
 * créneau libre et créneau de tâche : `kind` dit lesquels des champs
 * spécifiques comptent, les autres restent `null`.
 *
 * `x`/`y`/`width`/`height` sont des pourcentages de la surface du board
 * (0-100) : le canvas garde un ratio fixe, donc la mise en page ne bouge pas
 * d'un écran à l'autre.
 */
export interface VisionBoardItem {
  id: string
  boardId: string
  kind: VisionBoardItemKind
  x: number
  y: number
  width: number
  height: number
  /**
   * Ordre d'empilement — grandit à chaque mise au premier plan. Une section
   * n'y participe pas : elle reste au rang où elle a été créée (`0`), pour
   * rester en fond derrière tout le reste.
   */
  zIndex: number
  /** Pastille de couleur : la couleur elle-même. Note ou section : un fond facultatif. */
  color: FolderColor | null
  /** Note ou section — mêmes marqueurs inline que la documentation pour la
   *  note ; texte brut pour le titre d'une section. */
  text: string | null
  imageUrl: string | null
  /** Chemin dans le bucket `vision-boards`, pour le ménage au retrait. */
  imagePath: string | null
  /** Carte-lien : la tâche/note visée, tant qu'elle existe. */
  itemId: string | null
  /** Copie du titre au moment de l'épinglage — repli si `itemId` disparaît. */
  itemTitle: string | null
  itemType: ItemType | null
  createdAt: string
  updatedAt: string
}
