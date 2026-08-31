-- Sections sur un vision board — une zone de fond, sans lien de données avec
-- les éléments posés dessus, qui ne sert qu'à les regrouper visuellement.
--
-- Comme les autres migrations : dashboard Supabase → SQL Editor → coller →
-- Run, ou `supabase db push`. Rejouable sans erreur. À appliquer après
-- `0011_vision_boards.sql`.
--
-- Rien de nouveau en colonnes : une section réutilise `text` pour son titre
-- (texte brut, pas de mise en forme) et `color` pour un fond facultatif — les
-- mêmes colonnes qu'une note. Il n'y a qu'à élargir la contrainte sur `kind`.

do $$
begin
  alter table public.vision_board_items drop constraint if exists vision_board_items_kind_check;
  alter table public.vision_board_items
    add constraint vision_board_items_kind_check
    check (kind in ('image', 'note', 'color', 'link', 'section'));
exception
  when duplicate_object then null;
end
$$;
