-- Vidéos YouTube épinglées à une page de documentation, avec le repère de
-- lecture (« où j'en étais »).
--
-- Comme les autres migrations : SQL Editor → coller → Run, ou `supabase db
-- push`. Rejouable sans erreur, et sans effet sur les pages existantes, qui
-- repartent avec une liste vide.
--
-- Même choix que `blocks` : un tableau jsonb plutôt qu'une table dédiée. Une
-- page est toujours lue et écrite en entier, et une poignée de vidéos par
-- page ne justifie pas une jointure.

alter table public.doc_pages
  add column if not exists videos jsonb not null default '[]'::jsonb;

-- La contrainte est ajoutée à part pour rester rejouable : `add constraint`
-- n'accepte pas `if not exists`.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'doc_pages_videos_is_array'
  ) then
    alter table public.doc_pages
      add constraint doc_pages_videos_is_array check (jsonb_typeof(videos) = 'array');
  end if;
end
$$;
