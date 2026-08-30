-- Catégories d'activité sur les créneaux.
--
-- Comme les autres migrations : dashboard Supabase → SQL Editor → coller →
-- Run, ou `supabase db push`. Rejouable sans erreur. À appliquer après
-- `0009_time_blocks.sql`.
--
-- Un créneau peut porter une catégorie — travail, focus, réunion, étude,
-- sport, pause. Elle lui donne son icône et sa teinte, et c'est elle que
-- compte la « Répartition » du planning.
--
-- Pourquoi une colonne plutôt que la teinte déjà là (`color`) : la couleur
-- répond à « à quoi ça ressemble », la catégorie à « qu'est-ce que c'est ».
-- Deux créneaux lavande peuvent être l'un du travail, l'autre une réunion, et
-- un camembert des couleurs ne dirait rien de la journée. La teinte reste
-- libre par-dessus : `color` renseigné l'emporte à l'affichage.
--
-- Nullable, et sans valeur par défaut : un créneau posé en glissant une tâche
-- n'a pas de catégorie tant qu'on ne lui en donne pas. « Autre » est un
-- regroupement d'affichage, pas une valeur en base — l'écrire ferait passer
-- pour un choix ce qui n'est qu'une absence.

alter table public.time_blocks
  add column if not exists kind text;

-- `add constraint` n'a pas de `if not exists` : le bloc rend la migration
-- rejouable sans avoir à supprimer la contrainte d'abord.
do $$
begin
  alter table public.time_blocks
    add constraint time_blocks_kind_check
    check (kind is null or kind in ('travail', 'focus', 'reunion', 'etude', 'sport', 'pause'));
exception
  when duplicate_object then null;
end
$$;
