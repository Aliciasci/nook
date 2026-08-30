-- Police d'écriture choisie pour une page de documentation.
--
-- Comme les autres migrations : SQL Editor → coller → Run, ou `supabase db
-- push`. Rejouable sans erreur, et sans effet sur les pages existantes qui
-- restent en 'sans'.

alter table public.doc_pages
  add column if not exists font text not null default 'sans';

-- La contrainte est ajoutée à part pour rester rejouable : `add constraint`
-- n'accepte pas `if not exists`.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'doc_pages_font_check'
  ) then
    alter table public.doc_pages
      add constraint doc_pages_font_check check (font in ('sans', 'serif', 'mono'));
  end if;
end
$$;
