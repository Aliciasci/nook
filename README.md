# Nook

Un petit bureau numérique personnel pour ranger tes tâches, tes notes et tes idées — sans la lourdeur d'un outil "enterprise".

## Stack

- Vue 3 + `<script setup>` + TypeScript
- Vite
- Tailwind CSS v4
- vue-router
- Supabase (auth, PostgreSQL, Storage)

## Démarrer

```bash
npm install
cp .env.example .env   # puis remplis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

Sans les deux variables Supabase, l'app se lance mais affiche un avertissement en console : l'authentification et la persistance sont désactivées.

Il faut aussi appliquer les migrations sur ton projet Supabase — dashboard → SQL Editor, coller `supabase/migrations/0001_init.sql`, `0002_background_storage.sql`, `0003_doc_pages.sql`, `0004_doc_page_font.sql`, `0005_doc_page_videos.sql`, `0006_folder_position.sql`, `0007_item_links.sql`, `0008_nooks.sql`, `0009_time_blocks.sql` puis `0010_time_block_kind.sql` (ou `supabase db push` si le CLI est lié). Tous les fichiers sont rejouables sans erreur, et dans cet ordre — `0008` reprend l'existant et le rattache à un premier nook.

Une fois inscrit, un trigger Postgres provisionne automatiquement un premier nook, le profil, les préférences, la progression du jardin et quatre dossiers de départ. En dev uniquement, Paramètres propose « Charger les données de démo » pour remplir le nook ouvert avec le jeu de données de `src/data/seed.ts`.

## Fonctionnalités

- **Nooks** — plusieurs espaces indépendants dans un même compte : un Nook pro, un Nook perso. Voir plus bas.
- **Dossiers, tâches et notes** — un seul modèle `Item` (tâche *ou* note) rangé dans des dossiers colorés. Sur l'accueil, les dossiers se rangent par glisser-déposer ; l'ordre est enregistré (colonne `position`, migration `0006`). Chaque ligne de tâche affiche son niveau d'importance (Basse, Normale, Haute).
- **To-do list** — sur l'accueil, sous les notes rapides, une liste de cases à cocher pour les micro-trucs qui n'ont pas à devenir des tâches. Voir plus bas.
- **Détail** — cliquer une tâche ou une note ouvre son détail en lecture : description, dossier, importance, échéance, et le contenu des notes liées, dépliable sur place. Voir plus bas.
- **Mise en forme partout** — les notes *et* les descriptions de tâches acceptent le même formatage que la documentation : gras, italique, souligné, barré, code, liens, couleurs, et autant de lignes qu'on veut.
- **Liens** — une tâche et une note peuvent être rattachées l'une à l'autre : la note qui détaille la tâche, la référence qui sert à plusieurs tâches. Voir plus bas.
- **Time blocking** — la page « Planning » est une grille horaire, en vue jour, semaine ou mois : on y pose ses tâches et ses blocs libres sur des créneaux. Voir plus bas.
- **Vues** — le menu est rangé en sections : *Accueil*, puis **Ma journée** (Aujourd'hui, Planning), **Mes tâches** (Inbox, À faire, Terminées), **Mon nook** (Documentation, Mon espace, Rapport) et **Mes dossiers**. Plus, hors menu : Dossier et Paramètres.
- **Focus** — sessions type Pomodoro (15 / 25 / 50 min) rattachées à une tâche. Le choix d'ambiance (pluie, café, océan…) est enregistré mais la lecture audio n'est pas encore branchée.
- **Mon espace** — un jardin qui pousse : chaque action gagne de l'XP et débloque, sur 10 niveaux, de nouveaux éléments de la scène. Les déblocages sont définitifs, le jardin ne régresse jamais.
- **Thèmes** — 5 ambiances (Lavender, Soft Pink, Gothic, Pixel, Garden), couleur d'accent personnalisée, intensité visuelle, et un fond d'écran : soit une image, soit une couleur unie avec un motif. Voir plus bas.
- **Documentation** — une arborescence de pages pour la doc technique : titres, paragraphes, blocs de code, listes, citations et encadrés, mise en forme du texte (gras, italique, souligné, barré, code, liens, couleur), police au choix par page, vidéos YouTube épinglées à la page avec reprise de lecture, sommaire automatique, liens entre pages et export Markdown.
- **Rapport** — export CSV ou HTML imprimable, filtré par période et par statut.

## Structure

- `src/types` — modèles `Nook`, `Folder`, `Item` (tâche ou note) et `DocPage` + types générés de la base
- `src/lib/supabase.ts` — client Supabase partagé
- `src/lib/activeNook.ts` — le nook actif, tel que les services le lisent (variable de module, rien de réactif)
- `src/services` — accès aux données (une fonction par opération, rien de réactif)
- `src/composables` — état réactif partagé : auth, nooks, thème, préférences, focus, jardin, Spotify…
- `src/store/useStore.ts` — dossiers, items et liens entre items, rechargés à chaque changement de nook
- `src/store/useDocs.ts` — pages de documentation, chargées à la première ouverture de la section
- `src/store/useTimeBlocks.ts` — créneaux du planning, chargés par semaine autour du jour regardé
- `src/utils/planning.ts` — le rapprochement prévu/réalisé, partagé par le bilan du jour et le rapport
- `src/components` — composants par domaine (dossiers, tâches, notes, docs, jardin, UI commune)
- `src/views` — pages, dont `views/auth` (connexion, inscription, mot de passe oublié / réinitialisé)
- `src/themes` — un fichier CSS de tokens par thème
- `supabase/migrations` — schéma, RLS et provisioning des nouveaux comptes et des nouveaux nooks

## Nooks

Un compte peut tenir plusieurs espaces séparés — un Nook pro, un Nook perso, un Nook pour une thèse. Chacun a **ses** dossiers, **ses** tâches et notes, **ses** liens, **sa** documentation, **son** thème et son fond d'écran, **ses** horaires de travail, **ses** sessions de focus et **son** jardin. Rien ne traverse la frontière : ouvrir l'autre nook, c'est ouvrir une autre application.

Seul le compte reste commun — le profil, les identifiants et la connexion Spotify.

À la connexion, un **écran de choix** demande où l'on va, avec le nombre de tâches ouvertes sous chaque nook. Il ne s'ouvre qu'une fois par session de navigation : recharger la page (F5) ne le redemande pas, fermer l'onglet si. Un compte qui n'a qu'un seul nook ne le voit jamais — il n'y a rien à choisir.

Ensuite, un sélecteur discret en haut de la sidebar donne le nook ouvert, la liste des autres, « Changer de nook… » (qui repasse par l'écran de choix) et « Gérer les nooks » (qui mène à Paramètres, où l'on crée, renomme et supprime).

Quelques points de fonctionnement :

- **Le nook n'est pas dans l'URL.** Il est retenu par navigateur (`localStorage`) et sur le compte (`profiles.active_nook_id`) : le premier a la priorité, le second suit d'une machine à l'autre. Un lien `/folder/<id>` ou `/docs/<id>` ouvert depuis le mauvais nook n'affiche donc pas une page blanche — l'app demande à la base à quel nook appartient cet identifiant et propose d'y basculer.
- **La bascule vide d'abord ce qui attendait.** Le jardin, les préférences et la documentation écrivent en différé (300, 400 et 700 ms) et ne résolvent le nook qu'au moment où l'écriture part : sans ce vidage, une sauvegarde à cheval sur la bascule irait poser le thème de l'ancien nook sur le nouveau. Les stores s'y branchent via `onBeforeNookSwitch` (`src/composables/useNooks.ts`).
- **Une session Focus en cours est clôturée** au changement de nook et rangée dans le nook où elle a commencé — sa tâche n'existe pas dans l'autre.
- **Créer un nook** pose d'un bloc le nook, sa ligne de préférences et sa ligne de jardin (fonction `create_nook`), pour qu'il n'existe jamais à moitié équipé. Les dossiers de départ (Inbox, À voir, Idées) sont optionnels.
- **Supprimer un nook** emporte tout son contenu par cascade, sans retour possible. Le dernier nook d'un compte ne se supprime pas : l'interface grise le bouton et un trigger Postgres le refuse de toute façon.
- **L'ordre des nooks** se règle par glisser-déposer dans Paramètres, en attrapant une ligne par sa poignée. Il vaut pour l'écran de choix comme pour le sélecteur (colonne `position`, même mécanique que les dossiers de l'accueil).

Côté base, chaque table de contenu porte une colonne `nook_id` (migration `0008`) et les services filtrent dessus à chaque lecture. Le nook actif est tenu dans `src/lib/activeNook.ts` — une variable de module plutôt qu'un état réactif, pour que la couche `services` reste ce qu'elle est.

## Time blocking

La page **Planning** (`/planning`) est une grille horaire. Elle se dessine dans les bornes de ta journée de travail (Paramètres → Horaires), avec la pause déjeuner grisée, l'heure courante en trait rouge, et les heures qui débordent affichées quand un créneau sort du cadre. Les flèches du bandeau reculent et avancent d'une période ; `/planning?jour=2026-08-28&vue=semaine` ouvre directement sur une date et une vue.

Elle a sa propre entrée dans le menu, distincte d'**Aujourd'hui** — les deux répondent à des questions différentes : *ce qui est dû aujourd'hui* d'un côté, *quand je le fais* de l'autre. « Aujourd'hui » porte un lien vers le planning du jour, qui indique combien de créneaux y sont déjà posés.

### Trois vues

Le sélecteur du bandeau bascule entre **Jour**, **Semaine** et **Mois**. La vue choisie est retenue par navigateur — c'est une habitude de lecture, pas une donnée du nook — et l'URL l'emporte quand elle en porte une.

- **Jour** — une colonne, la vue d'origine. Rien n'y a changé.
- **Semaine** — les sept jours côte à côte, lundi en tête, week-end à peine teinté. Les trois gestes y sont intacts, et un créneau s'y **déplace d'un jour à l'autre** : c'est ce qui fait de la semaine l'endroit où l'on répartit sa charge plutôt qu'un tableau de bord de plus. Un clic sur l'en-tête d'un jour l'ouvre en vue jour.
- **Mois** — six semaines de sept cases, chacune avec le temps bloqué du jour et ses trois premiers créneaux, puis « +2 ». Les jours des mois voisins restent affichés, en gris. Deux gestes seulement y survivent : cliquer un jour pour l'ouvrir, et y déposer une tâche — elle se pose à la suite de ce qui est déjà prévu ce jour-là. Tracer ou étirer dans une case de 96 px n'aurait pas la précision du quart d'heure.

Le panneau « À caser » suit dans les trois vues : c'est de là qu'on glisse une tâche sur un jour. Le bilan de droite couvre ce qui est affiché — la journée, la semaine, ou le mois **civil** : en vue mois la grille montre la fin du mois précédent, mais « Bilan d'août » ne compterait pas juste s'il l'additionnait.

Quatre gestes :

- **Cliquer une activité** dans la rangée du haut la pose au prochain trou de la journée ; **la glisser** sur la grille la pose à l'heure exacte. Voir « Les activités » ci-dessous.
- **Tracer** à la souris sur la grille ouvre un champ où nommer un bloc libre — réunion, sport, trajet. Un simple clic ne crée rien : sur une grille, cliquer pour regarder est plus fréquent que cliquer pour poser.
- **Glisser une tâche** depuis le panneau « À caser » lui donne une heure. Les tâches dues ce jour-là passent devant, puis celles en retard, puis les prioritaires.
- **Déplacer** un créneau en l'attrapant, **l'étirer** par son bord bas. Tout est magnétisé au quart d'heure.

Le menu **⋯** d'un créneau change sa catégorie, démarre un focus sur sa tâche, ou le retire.

Un créneau porte soit une tâche du nook, soit rien d'autre qu'un intitulé. Les deux comptent : ne bloquer que ce qui est dans Nook ferait mentir les trous de la grille sur le temps réellement disponible.

Deux créneaux qui se chevauchent se partagent la largeur. Ils sont regroupés en grappes de recouvrement transitif — A touche B, B touche C, donc les trois se partagent la colonne même si A et C ne se touchent pas.

### Les activités

Un créneau peut porter une **catégorie** — travail, focus, réunion, étude, sport, pause (colonne `kind`, migration `0010`). C'est elle qui lui donne son icône et sa teinte, et c'est elle que compte la « Répartition » de la colonne de droite.

La liste est fermée à six, et ce n'est pas une limite technique : des étiquettes libres auraient rendu le camembert illisible dès la deuxième semaine, et au-delà de six, ranger devient un travail. Chacune prend une des six couleurs des dossiers — donc elles suivent le thème actif, en clair comme en sombre, sans une valeur en dur.

La rangée « Suggestions d'activités », au-dessus de la grille, sert les deux façons de planifier. **Cliquer** une activité la pose au prochain trou de la journée : on part du début de la journée de travail — de l'heure courante si c'est aujourd'hui — et on saute par-dessus ce qui mord sur le trou, en reprenant les creux du milieu de journée. **La glisser** sur la grille la pose à l'heure exacte, comme une tâche depuis « À caser ». Le dernier bouton de la rangée n'est pas une septième catégorie : c'est le bloc libre, celui qui n'entre dans aucune case.

Une catégorie n'est jamais imposée. Un créneau posé en glissant une tâche n'en a pas, et tombe dans « Autre » — un regroupement d'affichage, rien ne s'écrit sous ce nom en base. Son menu ⋯ lui en donne une après coup.

### Les couleurs

La teinte se change à deux endroits, et ce n'est pas un doublon : l'un pose la règle, l'autre l'exception.

- **Paramètres → Couleurs des activités** donne sa teinte à une catégorie, une fois pour toutes : tous ses créneaux suivent, passés comme à venir. Les six teintes de l'app, ou **une couleur libre** au nuancier — c'est là que « Pause » devient turquoise si le beige ne te va pas. Le réglage vit dans `user_preferences.extra`, donc par nook et sans migration.
- **Le menu ⋯ d'un créneau** repeint ce créneau-là seulement. Les six teintes uniquement : la colonne `color` les vérifie en base, et une couleur qui ne vaudrait que pour une carte n'a pas besoin du nuancier. « Auto » lui rend la main.

L'ordre de décision, du plus précis au plus général : **la couleur posée sur le créneau**, puis **celle de sa catégorie**, puis **celle du dossier de sa tâche**, puis une teinte neutre.

Une couleur libre n'est pas peinte telle quelle : seule sa *teinte* est retenue, la saturation et la clarté étant ramenées dans la fourchette des six couleurs de Nook. C'est la différence avec le fond d'écran, où la couleur choisie est peinte à l'identique — une carte de planning porte du texte, et un aplat saturé y rendrait le titre illisible. Conséquence assumée : deux turquoise voisins donnent la même carte.

### Prévu contre réalisé

C'est ce qui distingue la grille d'un calendrier de plus. Le *prévu* vit dans `time_blocks`, le *réalisé* dans `focus_sessions` — celles-ci existaient déjà. Rien ne les relie en base : le rapprochement se fait côté client, en sommant les sessions de la tâche sur le jour du créneau. Une clé étrangère entre les deux obligerait à désigner une session « officielle » par créneau, alors qu'on en fait souvent plusieurs, parfois à cheval.

Le bouton ▶ d'un créneau ouvre le mode Focus sur sa tâche, durée pré-remplie avec celle du créneau. La jauge de la carte montre ensuite le temps passé par-dessus le temps prévu.

Un créneau est **tenu** si sa tâche est terminée, ou si on y a passé au moins la moitié du temps prévu ; **entamé** en deçà ; **sauté** si on n'y a rien passé. Le seuil est volontairement indulgent : le but est de distinguer « je m'y suis mis » de « je l'ai sauté », pas de noter la précision de l'estimation. Les blocs libres sont hors comptage — ils n'ont rien à mesurer.

Le bilan du jour est dans la colonne de droite ; le même calcul, sur la période choisie, alimente le **Rapport**.

Son grand chiffre est le **prévu**, pas le réalisé : à huit heures du matin, « 0h sur 4h prévues » se lit comme un échec alors que la journée n'a pas commencé, quand « 4h planifiées » se lit comme un plan. Le rapprochement suit juste en dessous — tenus, entamés, sautés — là où il ne juge plus la journée avant qu'elle ait eu lieu.

Au-dessus, l'anneau d'« À caser » ne mesure pas la liste qui le suit : celle-ci contient toutes les tâches ouvertes du nook, dont la plupart ne sont pas pour aujourd'hui, et un anneau à 4 % tous les matins ne dirait rien. Il mesure ce que la journée doit porter — les tâches dues ce jour-là ou en retard — et celles-là, on les a casées ou pas.

### Notes d'implémentation

- **Une seule surface pour toutes les colonnes**, pas une grille par jour : le pointeur y tire un jour de son abscisse et une minute de son ordonnée, ce qui rend le déplacement d'un créneau de mardi à jeudi gratuit. Sept surfaces séparées auraient demandé de relayer le geste de l'une à l'autre, chacune capturant le pointeur pour elle. C'est aussi pourquoi `TimeGrid` prend des `days[]` plutôt qu'un `day` : la vue jour est la vue semaine à une colonne.
- Pendant un déplacement, ce sont les **créneaux eux-mêmes** qui portent la position du geste, pas un calque d'aperçu : le placement des recouvrements est recalculé sur des créneaux déjà déplacés, donc un créneau tiré vers un autre jour prend sa place dans la colonne d'arrivée, au milieu de ceux qui s'y trouvaient. Les bornes de la grille, elles, restent calculées sur les créneaux enregistrés — sinon elle s'étirerait sous le curseur et emmènerait tous les autres avec elle.
- Le store **charge une plage et la garde** : il ne relance une requête que si ce qu'on demande sort de ce qui est en mémoire. Passer de la vue jour à la semaine ne charge rien (la semaine était déjà là), le mois charge une fois ses 42 jours, et revenir au jour depuis le mois ne charge rien non plus. La vue jour continue de demander la semaine entière, jamais le seul jour.
- Les heures sont des **minutes depuis minuit**, pas des `timestamptz`. Un créneau est une intention à l'horloge murale (« mardi de 9h à 10h30 ») : le stocker en instant absolu ferait glisser tout le planning au moindre changement de fuseau. Le reste de l'app raisonne déjà en minutes.
- Le store charge **la semaine entière** autour du jour regardé, pas le seul jour : changer de jour avec les flèches ne relance aucune requête.
- Supprimer une tâche ne supprime pas ses créneaux (`on delete set null`) : le créneau garde l'intitulé copié à sa création et devient un bloc libre. L'histoire de la journée n'est pas réécrite après coup.
- Le glisser d'une tâche depuis le panneau utilise le glisser-déposer **natif** (il traverse les composants) ; déplacer et étirer un créneau utilise les **événements pointeur** (position continue, indispensable sur une grille). Les cartes arrêtent leur propre `pointerdown` : sans ça il remonterait à la surface, dont le gestionnaire écraserait le geste « déplacer » par un geste « créer ».
- Le catalogue des activités est en **deux morceaux** : `utils/activityKinds.ts` ne porte que des données — identifiant, libellé, teinte — pour rester importable par le store et par les calculs, et `components/planning/activityIcons.ts` fait le lien avec les icônes. Un catalogue qui importerait des composants entraînerait Vue dans la couche des utilitaires.
- Le planning peint par **variables CSS** (`--blk-bg`, `--blk-ink`, `--blk-ring`, `--blk-solid`) posées en style, pas par classes de couleur comme le reste de l'app : une couleur libre n'a pas de classe Tailwind. Les six teintes s'y écrivent `var(--color-folder-X)`, donc elles continuent de suivre le thème actif sans rien recalculer, et les enfants d'une carte héritent des variables — rien n'a besoin de reprendre la teinte à son compte. `utils/activityPalette.ts` fait la résolution, `useFolderColor` reste inchangé pour tout le reste.
- Le menu ⋯ **bascule au-dessus du bouton** quand il ne tient pas sous lui. Sa hauteur est estimée plutôt que mesurée : mesurer demanderait un premier rendu, un `nextTick` et un saut visible. L'estimation est généreuse — trop haute, le menu remonte pour rien ; trop courte, il dépasse du bas de la fenêtre, et le défilement qui suivrait le refermerait.
- La carte d'un créneau **se replie à mesure qu'elle rétrécit** : un quart d'heure n'a la place que de son titre, une heure y ajoute l'icône et l'horaire, trois heures la durée sur sa propre ligne et le réalisé par-dessus le prévu. Les paliers sont choisis à la hauteur rendue plutôt que masqués par débordement, qui donne des demi-lignes coupées. Dans une colonne de semaine, c'est **l'horaire qui se coupe**, pas la durée : tronquer la ligne entière mangeait la pastille en premier.
- Le menu ⋯ d'un créneau est **téléporté** et positionné en fixe, comme celui de l'arborescence de la documentation : la surface de la grille rogne ce qui la dépasse, un menu posé dans la carte serait coupé par le bord bas ou le bord droit. Sa position est figée à l'ouverture, donc un défilement le referme.
- L'heure courante se lit **dans la règle des heures**, pas dans la grille : la surface rogne ce qui la dépasse, et une pastille posée sur les créneaux mangerait un titre. L'heure ronde qu'elle recouvre s'efface — « 17:00 » dépassant de dessous « 17:11 » se lit comme une faute d'affichage.
- « Aujourd'hui » charge le planning de la journée alors qu'elle ne l'affiche pas : sans ça, son lien annoncerait « Planifier ma journée » à quelqu'un qui a déjà tout posé. Le store met en cache par semaine, donc c'est le même chargement que la page Planning demandera juste après, pas un second.

## To-do list de l'accueil

Sous les notes rapides, dans la colonne de droite de l'accueil, une liste de cases à cocher pour les micro-trucs — rappeler le dentiste, sortir le vélo. On tape, on coche, on nettoie.

Ce ne sont **pas des tâches Nook** : ni dossier, ni échéance, ni importance, et rien qui remonte dans l'Inbox, « À faire », le Planning ou le Rapport. C'est ce qui lui permet de cohabiter avec l'Inbox, affichée juste à gauche sur la même page : l'une est le système de tâches, l'autre le coin de la feuille où l'on griffonne.

Une ligne cochée ne disparaît pas : elle descend sous les autres, rayée, et « Nettoyer (n) » retire toutes les cochées d'un coup. Décocher reste possible jusque-là — le but est de voir ce qui reste, pas d'effacer ce qui vient d'être fait.

### Notes d'implémentation

- Les lignes vivent dans `user_preferences.extra`, comme le fond d'écran : **par nook, sans migration**. Une table à part aurait demandé un service, un store, une policy RLS et une migration pour trois champs sans relation. La clé y est restée `checklist`, le premier nom de la section : la renommer aurait effacé les lignes déjà écrites, pour cinq caractères que personne ne lit.
- `extra` est du jsonb : la lecture écarte les entrées illisibles plutôt que de faire tomber tout le chargement — le thème et les horaires voyagent dans la même ligne. Deux plafonds pour la même raison : 100 lignes, 200 caractères.
- L'écriture passe par le débounce des préférences (400 ms), donc `flushPreferences` la vide déjà avant une bascule de nook. Chaque geste appelle `savePreferences()` explicitement plutôt qu'un `watch` profond : sinon le seul chargement d'un nook renverrait aussitôt sa propre liste en base.
- Le champ de saisie est celui des ajouts rapides, extrait dans `components/common/QuickAddField.vue` ; `InlineQuickAdd` n'est plus que son câblage sur le store. La to-do list n'écrit pas d'items, elle ne pouvait pas passer par le second.
- La saisie reste grisée tant que la ligne de préférences n'est pas arrivée : écrire avant poserait une liste vide par-dessus celle de la base.

## Fond d'écran

Le fond derrière toute l'application est **soit une image, soit une couleur** — jamais les deux : poser l'une retire l'autre, et l'image téléversée est supprimée du stockage au passage.

Une couleur se prend parmi les **six teintes de l'app** — celles des dossiers et de la couleur de texte dans la doc — ou se choisit librement. Les six suivent le thème actif : en mode sombre, `rose` devient prune plutôt que de rester rose pâle.

Par-dessus la couleur, un **motif** répété : fleurs, lunes ou étoiles. Il est posé à 8 % d'opacité, une valeur fixe — à l'échelle d'un écran entier, un motif qui se lit est un motif qui dérange.

### Notes d'implémentation

- Un SVG en `data:` **n'hérite d'aucune variable CSS** : sa couleur doit y être écrite en clair. Les motifs sont donc construits en JavaScript (`utils/backgroundPatterns.ts`), et `useBackground` leur passe la teinte lue sur le thème actif au moment d'appliquer. C'est aussi pourquoi un changement de thème ou de mode déclenche une reconstruction.
- La couleur du motif n'est pas calculée : c'est `--color-folder-X-ink`, l'encre que chaque thème associe déjà à chaque teinte. En clair l'encre est foncée sur une teinte pâle, en sombre l'inverse — le motif reste visible des deux côtés sans une ligne d'arithmétique. Seule une couleur libre demande un calcul, à partir de sa luminosité perçue.
- Le motif vit dans un `body::before` fixe plutôt que dans le fond du corps : c'est ce qui permet de l'atténuer sans toucher à la couleur sous-jacente.
- Le réglage vit dans `user_preferences.extra`, donc **par nook** et sans migration.

## Documentation

La section **Documentation** (`/docs`) range des pages libres dans une arborescence, sur autant de niveaux que tu veux. Chaque page est une suite de blocs.

Pour saisir :

- **`/`** ouvre le menu des blocs — titre, texte, code, liste à puces, liste numérotée, citation, encadré, séparateur.
- Les raccourcis Markdown fonctionnent en début de bloc : `# `, `## `, `### `, `- `, `1. `, `> `, ` ``` `, `---`.
- **Entrée** crée le bloc suivant (et poursuit une liste), **⇧Entrée** saute une ligne dans le même bloc. Dans un bloc de code, Entrée saute une ligne et **⌘/Ctrl+Entrée** en sort.
- **Retour arrière** en début de bloc repasse un bloc typé en paragraphe, puis le fusionne avec le précédent.
- Au repos le texte est rendu ; cliquer dedans le repasse en texte source, curseur là où tu as cliqué.
- La poignée à gauche d'un bloc le déplace par glisser-déposer. Un **clic** dessus ouvre le menu du bloc : « Transformer en » change son type en gardant son texte, et « Fond » lui pose une des six teintes (ou ⊘ pour l'enlever). Le séparateur n'y figure pas — il n'a pas de texte, l'y transformer effacerait celui du bloc ; il s'insère depuis le menu « / ».

Mise en forme du texte — barre d'outils en haut de page, ou raccourcis, ou marqueurs tapés à la main :

| Style | Bouton | Raccourci | Marqueur |
|---|---|---|---|
| Gras | **B** | ⌘/Ctrl + B | `**gras**` |
| Italique | *I* | ⌘/Ctrl + I | `*italique*` |
| Souligné | U | ⌘/Ctrl + U | `++souligné++` |
| Barré | S | — | `~~barré~~` |
| Code | `</>` | ⌘/Ctrl + E | `` `code` `` |
| Lien | 🔗 | ⌘/Ctrl + K | `[texte](url)` |
| Couleur | A | — | `{blue\|texte}` |

Les styles se combinent (`***gras italique***`, `++souligné **et gras**++`, `{green|**vert et gras**}`). Un bouton ou un raccourci appliqué sur du texte déjà stylé retire le style. Le souligné n'existe pas en Markdown : il ressort en `<u>…</u>` à l'export.

**Fond d'un bloc** : dans le menu de la poignée, section « Fond ». Mêmes six teintes que la couleur de texte, en version pastel, et redéfinies par chaque thème. Les blocs de code (qui ont déjà leur fond sombre) et les séparateurs (qui n'ont pas de contenu) n'y ont pas droit ; transformer un bloc coloré en l'un des deux lui retire son fond. À l'export Markdown, le fond disparaît : l'encadrer dans un `<div>` casserait la structure d'une liste ou d'un titre.

**Couleur du texte** : le bouton « A » de la barre d'outils ouvre les six teintes — `blue`, `green`, `pink`, `beige`, `lavender`, `peach` — plus « Retirer la couleur ». Ce sont celles des dossiers, redéfinies par chaque thème, donc un passage coloré suit le thème actif et reste lisible en mode sombre. Rechoisir la même teinte la retire. À l'export Markdown, qui n'a ni couleur ni thème, elle ressort en `<span style="color: …">` avec la teinte du thème par défaut.

**Police** : les trois boutons « Aa » de la barre d'outils basculent toute la page en sans serif, serif ou monospace. C'est un réglage par page, enregistré avec elle.

**Icône de page** : le bouton « + Icône », au-dessus du titre, ouvre une palette de 248 emoji rangés en dix familles (Documents, Code et outils, Travail, Symboles, Nature, Animaux, Nourriture, Visages, Loisirs, Lieux). En bas, « 🎲 Au hasard » en tire une au sort — l'icône déjà posée est écartée du tirage, et la palette reste ouverte pour relancer — et « Retirer » enlève l'icône.

### Vidéos YouTube

Une page peut épingler autant de vidéos qu'on veut — des cours, en général — chacune avec le repère de sa dernière lecture. Le bouton « + Vidéo YouTube », sous le titre de la page, ouvre le champ où coller le lien.

- Les formes reconnues : `watch?v=`, `youtu.be/…`, `/embed/`, `/shorts/`, `/live/`, le domaine sans cookies, et l'identifiant seul. Si le lien porte un repère (`&t=90s`, `?start=90`), il sert de point de départ.
- Le titre est récupéré via oEmbed, sans clé d'API. S'il n'arrive pas (vidéo privée, hors ligne), la vidéo s'appelle « Vidéo YouTube » — cliquer sur le titre le corrige.
- Les vidéos sont rangées en **vignettes côte à côte**, qui se replient sur plusieurs lignes quand la colonne d'écriture est étroite : aperçu 16:9, bouton de lecture au centre, avancement en bas de l'image. Cliquer sur une vignette la fait passer **pleine largeur** et remplace l'image par le lecteur, **là où tu t'étais arrêté** ; la croix en haut à droite la ramène à sa taille de vignette. La position est relevée pendant la lecture et écrite au plus toutes les 20 secondes, puis à chaque pause, à la fermeture du lecteur et au changement de page.
- Le repère s'écrit aussi à la main : clique dessus et tape `12:34`, `1:02:03`, ou un nombre de secondes. Utile quand le cours a été suivi ailleurs.
- La durée totale est relevée au premier lancement : la barre d'avancement n'apparaît qu'à partir de là. L'image d'aperçu est la `maxresdefault` de YouTube, avec repli sur `hqdefault` (recadrée) pour les vidéos qui n'en ont pas.
- Le lecteur n'est monté qu'au clic, et le script de l'API YouTube n'est chargé qu'à ce moment : une page dont on ne lit rien ne demande rien à YouTube. Le lecteur pointe sur `youtube-nocookie.com`.

Les vidéos vivent dans la colonne `videos` de `doc_pages` (migration `0005`), un tableau jsonb, comme les blocs.

Autour des pages :

- `[[Titre d'une page]]` crée un lien vers cette page ; si elle n'existe pas, le clic la crée. Chaque page liste les pages qui pointent vers elle.
- Le sommaire à droite est construit à partir des titres de la page.
- Le menu principal et l'arborescence se replient chacun sur une bande d'icônes (bouton en haut de chaque panneau) quand la fenêtre est étroite. L'état est retenu par navigateur.
- La recherche globale (⌘K, quand aucun bloc n'est en cours d'édition) fouille le contenu des pages, pas seulement les titres, et affiche le passage trouvé.
- Chaque page (avec ses sous-pages) s'exporte en `.md`, et toute la doc en un seul fichier.

Les modifications sont enregistrées automatiquement, en différé — l'indicateur en haut de la page passe par « Enregistrement… » puis « Enregistré ».

## Détail d'une tâche ou d'une note

Cliquer une ligne de tâche ou une carte de note ouvre son **détail**, dans un modal centré comme les autres fenêtres de l'app. Cliquer une note liée fait basculer le modal sur cette note, sans le refermer.

Il s'ouvre en **lecture**. Il montre le titre, le dossier, le statut, l'importance, l'échéance, la description, puis :

- **Notes liées** — repliées par défaut, chacune se déplie sur place pour se lire sans quitter la tâche. « Ouvrir cette note → » fait glisser le panneau sur la note elle-même, sans le refermer.
- **Tâches liées** — un lien n'est pas réservé aux notes ; elles s'affichent avec leur case à cocher, et un clic bascule le panneau dessus.

### Écriture

Le champ de description — d'une note comme d'une tâche — porte la **barre d'outils de la documentation** : gras, italique, souligné, barré, code, lien, couleur, avec les mêmes raccourcis (⌘B, ⌘I, ⌘U, ⌘E, ⌘K) et les mêmes marqueurs (`**gras**`, `~~barré~~`, `{blue|texte}`…). La barre n'apparaît qu'à la saisie : au repos le champ reste sobre.

C'est le même moteur, littéralement : `formatInline`, `toggleMark`, `insertLink` et `applyTextColor` vivent dans `utils/docs.ts` et étaient déjà purs. `RichTextField` les câble sur un `<textarea>`, `RichText` rend le résultat partout ailleurs — cartes de note, panneau de détail. Le texte reste du texte brut en base : aucune migration, et une note écrite avant reste lisible.

Une seule différence avec la doc : `[[Titre]]` n'y devient pas un lien. Hors de la documentation le clic ne mènerait nulle part, et un lien inerte qui a l'air d'un lien vaut moins que du texte brut (option `wikiLinks` de `formatInline`).

Pas de menu « / » ni de blocs : une note garde l'air d'une note. Pour des titres, des listes et des encadrés, il y a la Documentation.

### Modifier

**Modifier** bascule le contenu du modal en formulaire, au même endroit, avec Annuler / Enregistrer — jamais un second calque par-dessus le premier. Le menu ⋯ d'une ligne y mène directement.

Échap, la croix et le clic sur le fond passent tous par la même sortie : en formulaire ils ramènent à la lecture, en lecture ils referment. Fermer d'un coup ferait disparaître une saisie sans prévenir.

Les champs sont définis une seule fois, dans `components/common/ItemFormFields.vue`, utilisé par le modal de création et par celui de détail. Deux copies auraient divergé au premier champ ajouté.

En bas, en lecture : **Modifier**, **Focus**, **Terminer**.

Une **tâche a maintenant une description**. La colonne `content` existait déjà sur `Item` mais seules les notes l'utilisaient ; le formulaire l'édite désormais pour les deux, sans migration.

## Liens entre tâches et notes

Une tâche et sa note se rattachent l'une à l'autre. Le lien n'a pas de sens de lecture : depuis la tâche on voit sa note, depuis la note on voit sa tâche, c'est le même lien. Rien n'oblige à mélanger les types — deux tâches qui vont ensemble se lient aussi.

Le geste le plus direct est le **glisser-déposer** : attrape une note, dépose-la sur une tâche, et les voilà liées. La cible s'éclaire au survol, et seulement si le dépôt changerait quelque chose — une paire déjà liée ne s'allume pas. Ça marche dans les deux sens, puisque le lien n'en a pas : une tâche se dépose aussi bien sur une note.

La section **Liens** du formulaire (« + Nouveau », ou « Modifier » dans le menu ⋯ d'une ligne) porte les deux autres gestes :

- **« Note liée »** crée une note à la volée et la rattache. Elle atterrit dans le dossier de la tâche. Le champ garde le focus : une tâche a souvent plusieurs notes à poser.
- **« Lier un élément »** ouvre une recherche sur les tâches et les notes déjà là. Sans recherche, l'autre type passe devant — d'une tâche, c'est une note qu'on vient chercher d'abord.

Pendant une **création**, l'item n'existe pas encore : les liens demandés sont mis en attente et posés juste après, à la validation du formulaire. Créer une tâche *et* sa note en une fois se fait donc sans quitter le formulaire.

Une fois liés, les deux portent une pastille 🔗 avec le nombre de liens ; l'infobulle donne les titres. Cliquer la pastille ouvre le **panneau de détail**, où les liens se lisent — c'est le formulaire qui sert à les défaire, via la croix de chaque ligne, sans toucher aux items.

Les liens vivent dans la table `item_links` (migration `0007`). Une paire n'y est rangée qu'une fois, dans l'ordre de ses identifiants : le doublon inverse est impossible plutôt que simplement interdit. Supprimer un item efface ses liens en cascade.

## Données et sécurité

Chaque table a RLS activé : une ligne n'est visible et modifiable que par son propriétaire. Les policies d'`items`, `focus_sessions`, `doc_pages`, `item_links` et `time_blocks` vérifient en plus que le dossier, l'item ou la page parente référencée appartient au même utilisateur — pour un lien, les deux items qu'il désigne — **et au même nook**. C'est cette dernière condition qui empêche une tâche du nook pro d'atterrir dans un dossier du nook perso, même si le client s'y trompait.

Le filtrage par nook côté client est un cadrage, pas une sécurité : c'est le RLS qui fait autorité, et il vérifie que le nook désigné appartient bien au compte (`owns_nook`). Le bucket `backgrounds` est public en lecture (les URLs sont des UUID) mais chaque utilisateur ne peut écrire que dans son propre dossier `<user_id>/`.

La clé anon est publique et protégée par RLS — elle peut vivre dans le client. Ne mets jamais la clé `service_role` ni le mot de passe de la base dans `.env`.

## Déployer

Le déploiement vise Railway : build Docker (Node) puis service statique servi par Caddy, configuré dans `Dockerfile`, `Caddyfile` et `railway.json`.

```bash
./deploy.sh
```

Passe toujours par ce script plutôt que `railway up` directement : depuis ce dépôt monté sur le disque Windows (`/mnt/c/...`), l'uploader Railway échoue sur un en-tête `exclude-patterns` contenant de l'ASCII non imprimable. Le script contourne en copiant d'abord les sources dans `/tmp`.

Vite inline les variables `VITE_*` au moment du build : elles doivent être définies comme variables de service Railway (transmises au builder comme build args), pas au runtime.

## Spotify (optionnel)

Le widget Spotify utilise le flow OAuth **Authorization Code + PKCE** — aucun secret côté client. Pour qu'il fonctionne pour tous les visiteurs d'un déploiement sans configuration de leur part, définis `VITE_SPOTIFY_CLIENT_ID` (voir `.env.example`). Sans cette variable, chaque navigateur peut configurer son propre Client ID depuis Paramètres → Spotify (pratique en local).
