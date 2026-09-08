import type { Folder, Item } from '@/types'

function isoDaysFromNow(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

export const seedFolders: Folder[] = [
  { id: 'cafeyn', name: 'CAFeyn', icon: '📘', color: 'blue', position: 0, createdAt: isoDaysFromNow(-60) },
  { id: 'kiosk', name: 'Kiosk', icon: '📗', color: 'green', position: 1, createdAt: isoDaysFromNow(-58) },
  { id: 'dev', name: 'DEV', icon: '💜', color: 'lavender', position: 2, createdAt: isoDaysFromNow(-55) },
  { id: 'admin', name: 'Admin', icon: '📄', color: 'beige', position: 3, createdAt: isoDaysFromNow(-50) },
  { id: 'idees', name: 'Idées', icon: '💡', color: 'pink', position: 4, createdAt: isoDaysFromNow(-40) },
  { id: 'a-voir', name: 'À voir', icon: '👀', color: 'peach', position: 5, createdAt: isoDaysFromNow(-20) },
]

let n = 0
const id = () => `seed-${(n++).toString(36)}`

function task(
  folderId: string | null,
  title: string,
  opts: Partial<Pick<Item, 'status' | 'priority' | 'dueDate'>> & { createdAgo?: number } = {},
): Item {
  const createdAt = isoDaysFromNow(-(opts.createdAgo ?? 3))
  return {
    id: id(),
    folderId,
    type: 'task',
    title,
    content: null,
    status: opts.status ?? 'todo',
    priority: opts.priority ?? null,
    dueDate: opts.dueDate ?? null,
    archivedAt: null,
    createdAt,
    updatedAt: createdAt,
  }
}

function note(folderId: string | null, title: string, content: string | null = null, createdAgo = 4): Item {
  const createdAt = isoDaysFromNow(-createdAgo)
  return {
    id: id(),
    folderId,
    type: 'note',
    title,
    content,
    status: 'todo',
    priority: null,
    dueDate: null,
    archivedAt: null,
    createdAt,
    updatedAt: createdAt,
  }
}

const TODAY = isoDaysFromNow(0)

export const seedItems: Item[] = [
  // --- Today: prioritaire ---
  task('cafeyn', 'Corriger le PDF CAFeyn', { priority: 'high', dueDate: TODAY, createdAgo: 2 }),
  task('admin', 'Répondre à Thomas', { priority: 'high', dueDate: TODAY, createdAgo: 1 }),

  // --- Today: à faire ---
  task('dev', "Vérifier l'API", { priority: 'medium', dueDate: TODAY, createdAgo: 2 }),
  task('kiosk', 'Tester la nouvelle version', { priority: 'medium', dueDate: TODAY, createdAgo: 3 }),
  task('dev', 'Mettre à jour la documentation', { priority: 'medium', dueDate: TODAY, createdAgo: 5 }),
  task('kiosk', 'Préparer le déploiement', { priority: 'medium', dueDate: TODAY, createdAgo: 1 }),

  // --- CAFeyn: 8 tasks, 5 notes ---
  task('cafeyn', 'Demander le design de la nouvelle page paiement', { priority: 'medium', dueDate: isoDaysFromNow(3) }),
  task('cafeyn', 'Ajouter les logs Sentry sur le module facturation', { status: 'in_progress', dueDate: isoDaysFromNow(1) }),
  task('cafeyn', 'Revoir la CGV avant mise en ligne', { dueDate: isoDaysFromNow(5) }),
  task('cafeyn', 'Mettre en place la double authentification', { status: 'in_progress' }),
  task('cafeyn', 'Optimiser le temps de chargement du dashboard', { priority: 'low' }),
  task('cafeyn', "Corriger le bug d'export CSV", { status: 'done' }),
  task('cafeyn', 'Relire la traduction anglaise', { status: 'done' }),
  note('cafeyn', 'Idées pour la refonte du header', 'Simplifier la nav, mettre le logo à gauche, garder la recherche visible.'),
  note('cafeyn', 'Récap réunion client du 12/08', 'Le client veut un export PDF plus rapide et un historique des factures.'),
  note('cafeyn', 'Points à aborder avec Mehdi', 'Accès serveur, config du cron, migration de la base de test.'),
  note('cafeyn', 'Vérifier les retours QA sur la version 2.3'),
  note('cafeyn', 'Lister les prestataires pour l’audit sécurité'),

  // --- Kiosk: 4 tasks, 2 notes ---
  task('kiosk', 'Vérifier les abonnements de test avant la release', { dueDate: isoDaysFromNow(2) }),
  task('kiosk', 'Mettre à jour les mentions légales', { dueDate: isoDaysFromNow(7) }),
  note('kiosk', 'Comparatif des kiosques concurrents', 'Regarder les offres de Readly et PressReader pour comparer le pricing.'),
  note('kiosk', 'Idée : ajouter un mode hors-ligne'),

  // --- DEV: 12 tasks, 7 notes ---
  task('dev', "Refactor du module d'authentification", { status: 'in_progress', dueDate: isoDaysFromNow(2) }),
  task('dev', 'Ajouter les tests unitaires sur le service de paiement', { dueDate: isoDaysFromNow(4) }),
  task('dev', 'Corriger le bug de pagination', { status: 'in_progress' }),
  task('dev', 'Nettoyer les dépendances npm obsolètes', { priority: 'low' }),
  task('dev', 'Migrer vers Vite 6'),
  task('dev', "Écrire la doc technique de l'API interne", { dueDate: isoDaysFromNow(10) }),
  task('dev', 'Mettre en place les tests end-to-end'),
  task('dev', 'Corriger la fuite mémoire sur le worker', { status: 'done' }),
  task('dev', 'Automatiser le déploiement CI/CD', { status: 'done' }),
  task('dev', 'Nettoyer les branches Git obsolètes', { status: 'done' }),
  note('dev', 'Revoir la config des crons de nuit', 'Le cron de synchro tourne deux fois, vérifier le scheduler.'),
  note('dev', 'Idée : script de migration automatique'),
  note('dev', 'Notes de la revue de code du 10/08', 'Attention aux composants trop gros, penser à découper.'),
  note('dev', 'Lien utile : doc Vue Router', 'https://router.vuejs.org'),
  note('dev', "Retour sur l'incident serveur", 'Root cause : pool de connexions saturé. Ajouter une alerte.'),
  note('dev', 'Snippet : hook useDebounce'),
  note('dev', 'Idée d’architecture pour le module notifications'),

  // --- Admin: 3 tasks, 4 notes ---
  task('admin', 'Envoyer la facture du mois', { dueDate: isoDaysFromNow(3) }),
  task('admin', 'Renouveler l’assurance pro', { status: 'done' }),
  note('admin', 'Coordonnées du comptable', 'Cabinet Lefèvre — 01 23 45 67 89'),
  note('admin', 'Récap dépenses du mois'),
  note('admin', 'Penser à renouveler le nom de domaine'),
  note('admin', 'Infos mutuelle'),

  // --- Idées: 0 tasks, 7 notes ---
  note('idees', 'Idée : back-office avec vue Kanban'),
  note('idees', 'Créer une extension Chrome pour capturer rapidement des idées'),
  note('idees', 'Application de suivi d’habitudes minimaliste'),
  note('idees', 'Refonte identité visuelle personnelle'),
  note('idees', 'Newsletter mensuelle sur le dev freelance'),
  note('idees', 'Petit outil pour générer des palettes pastel'),
  note('idees', 'Système de templates pour les propositions clients'),

  // --- À voir: 2 tasks, 1 note ---
  task('a-voir', 'Regarder la conférence Vue Nation 2026', { dueDate: isoDaysFromNow(6) }),
  task('a-voir', "Tester l'outil de design Motion"),
  note('a-voir', "Article : comment structurer une app Vue 3 en 2026"),

  // --- Inbox (unclassified) ---
  task(null, 'Demander accès serveur à Mehdi', { createdAgo: 0 }),
  task(null, 'Regarder problème PDF sur mobile', { createdAgo: 0 }),
  task(null, 'Idée pour le back-office', { createdAgo: 1 }),
  task(null, 'Vérifier abonnement test', { createdAgo: 1 }),
  task(null, 'Penser à modifier le cron', { createdAgo: 2 }),

  // --- Quick notes (unfiled) ---
  note(null, 'Penser à faire un retour à l’équipe sur le problème de pagination PDF.', null, 0),
  note(null, "Voir aussi pour l'optimisation des images sur mobile.", null, 0),
]
