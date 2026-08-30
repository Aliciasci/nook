-- Ordre des dossiers, pour pouvoir les ranger par glisser-déposer.
--
-- Comme les autres migrations : SQL Editor → coller → Run, ou `supabase db
-- push`. Rejouable sans erreur.
--
-- Jusqu'ici les dossiers sortaient dans leur ordre de création. La colonne
-- ajoutée vaut 0 partout par défaut : le bloc de rattrapage ci-dessous leur
-- donne leur rang de création, pour que l'ordre affiché ne change pas au
-- moment de la migration.

alter table public.folders
  add column if not exists position integer not null default 0;

-- Ne s'applique qu'aux comptes dont les positions n'ont jamais été
-- attribuées — reconnaissables à leurs multiples dossiers restés à 0. Après
-- un premier passage il n'en reste qu'un, donc rejouer ne touche plus rien et
-- ne défait pas un rangement fait à la main.
with unset as (
  select user_id
  from public.folders
  group by user_id
  having count(*) filter (where position = 0) > 1
),
ranked as (
  select f.id, row_number() over (partition by f.user_id order by f.created_at) - 1 as rank
  from public.folders f
  join unset u on u.user_id = f.user_id
)
update public.folders f
set position = r.rank
from ranked r
where f.id = r.id;

create index if not exists folders_user_position_idx
  on public.folders (user_id, position);
