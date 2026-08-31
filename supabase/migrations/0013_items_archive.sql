-- Archive — une tâche ou une note peut être mise de côté sans être
-- supprimée. Comme les autres migrations : dashboard Supabase → SQL Editor →
-- coller → Run, ou `supabase db push`. Rejouable sans erreur.
--
-- `archived_at`, pas un simple booléen : même principe que `completed_at`
-- (migration 0001) — savoir *quand* permet de trier « Archive » par mise de
-- côté la plus récente, un booléen seul ne le pourrait pas. Séparé de
-- `status` à dessein : archiver n'est pas un état d'avancement, une tâche en
-- cours comme une tâche faite peuvent l'une comme l'autre être archivées.

alter table public.items
  add column if not exists archived_at timestamptz;

-- Les lectures d'« Archive » sont « les items archivés de ce nook, du plus
-- récent au plus ancien » — un index partiel, les lignes non archivées (la
-- grande majorité) n'ont rien à y faire.
create index if not exists items_archived_idx
  on public.items (nook_id, archived_at desc)
  where archived_at is not null;
