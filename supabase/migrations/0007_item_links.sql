-- Liens entre items — une tâche et la note qui la détaille, le plus souvent.
--
-- Comme les autres migrations : dashboard Supabase → SQL Editor → coller →
-- Run, ou `supabase db push`. Rejouable sans erreur.
--
-- Un lien n'a pas de sens de lecture : « la note de cette tâche » et « la
-- tâche de cette note » sont le même lien. Une paire est donc rangée une
-- seule fois, dans l'ordre de ses identifiants (contrainte
-- `item_links_ordered`), ce qui rend le doublon inverse impossible plutôt que
-- simplement interdit. Le client range la paire avant d'écrire.
--
-- Table d'association plutôt qu'une colonne `linked_item_id` sur `items` :
-- une tâche peut porter plusieurs notes, et une note de référence peut servir
-- à plusieurs tâches.

create table if not exists public.item_links (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  linked_item_id uuid not null references public.items (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, linked_item_id),
  constraint item_links_ordered check (item_id < linked_item_id)
);

-- La clé primaire couvre déjà la recherche par `item_id` ; l'autre sens a
-- besoin du sien, puisqu'une paire n'est stockée que dans un sens.
create index if not exists item_links_reverse_idx
  on public.item_links (linked_item_id);

create index if not exists item_links_user_idx
  on public.item_links (user_id);

-- ---------------------------------------------------------------------------
-- RLS — même forme qu'`items` : propriétaire uniquement, et les deux items
-- référencés doivent lui appartenir. Pas de policy `update` : un lien n'a rien
-- à modifier, il se crée et se supprime.
-- ---------------------------------------------------------------------------

alter table public.item_links enable row level security;

drop policy if exists "item_links_select_own" on public.item_links;
create policy "item_links_select_own" on public.item_links
  for select using (user_id = auth.uid());

drop policy if exists "item_links_insert_own" on public.item_links;
create policy "item_links_insert_own" on public.item_links
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.items i where i.id = item_id and i.user_id = auth.uid())
    and exists (select 1 from public.items i where i.id = linked_item_id and i.user_id = auth.uid())
  );

drop policy if exists "item_links_delete_own" on public.item_links;
create policy "item_links_delete_own" on public.item_links
  for delete using (user_id = auth.uid());
