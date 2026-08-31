-- Vision boards — des canvas libres, plusieurs par nook, où poser images,
-- notes, pastilles de couleur et cartes-liens vers une tâche ou une note.
--
-- Comme les autres migrations : dashboard Supabase → SQL Editor → coller →
-- Run, ou `supabase db push`. Rejouable sans erreur. À appliquer après
-- `0010_time_block_kind.sql`.
--
-- Position et taille sont en pourcentage de la surface du board (0-100) : le
-- client rend le canvas à un ratio fixe, donc un pourcentage vaut la même
-- place quelle que soit la largeur d'écran. Aucune contrainte de bornage ici
-- — le client clampe au dépôt, et un board rechargé après un redimensionnement
-- de fenêtre n'a pas besoin que la base ait une opinion là-dessus.
--
-- Les quatre natures d'élément partagent une seule table, comme
-- `time_blocks` partage tâche liée et créneau libre : plus simple qu'une table
-- par nature pour un geste qui les traite tous pareil (déplacer, redimensionner,
-- empiler). `item_title`/`item_type` sur une carte-lien reprennent le principe
-- de `time_blocks.title` — une copie du titre au moment où la carte est posée,
-- qui ne sert que si la tâche ou la note disparaît ensuite.

-- ---------------------------------------------------------------------------
-- Les boards
-- ---------------------------------------------------------------------------

create table if not exists public.vision_boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nook_id uuid not null references public.nooks (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  -- Rang parmi les boards du nook. Mêmes conventions que `folders.position`.
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vision_boards_nook_position_idx
  on public.vision_boards (nook_id, position);

drop trigger if exists trg_vision_boards_updated_at on public.vision_boards;
create trigger trg_vision_boards_updated_at before update on public.vision_boards
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Les éléments posés sur un board
-- ---------------------------------------------------------------------------

create table if not exists public.vision_board_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  board_id uuid not null references public.vision_boards (id) on delete cascade,
  -- Dénormalisé depuis le board, comme `nook_id` sur `time_blocks` : les
  -- policies le lisent sans jointure.
  nook_id uuid not null references public.nooks (id) on delete cascade,

  kind text not null check (kind in ('image', 'note', 'color', 'link')),

  x double precision not null default 10,
  y double precision not null default 10,
  width double precision not null default 24,
  height double precision not null default 24,
  -- Ordre d'empilement — grandit à chaque fois qu'un élément passe au premier
  -- plan, jamais réutilisé. Une simple rotation aurait pu remettre deux
  -- éléments à égalité après quelques allers-retours.
  z_index integer not null default 0,

  -- Une des six teintes des dossiers. Obligatoire pour une pastille de
  -- couleur ; optionnel comme fond teinté pour une note.
  color text check (color is null or color in ('blue', 'green', 'pink', 'beige', 'lavender', 'peach')),

  -- Note : texte brut avec les mêmes marqueurs inline que la documentation
  -- (`**gras**`, etc.) — voir `formatInline` côté client.
  text text,

  -- Image : chemin gardé pour le ménage du bucket au retrait de l'élément.
  image_url text,
  image_path text,

  -- Carte-lien vers une tâche ou une note du nook. `set null` plutôt que
  -- `cascade` : supprimer l'item ne doit pas effacer la carte, qui garde son
  -- étiquette de repli — voir `time_blocks.item_id`.
  item_id uuid references public.items (id) on delete set null,
  item_title text,
  item_type text check (item_type is null or item_type in ('task', 'note')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint vision_board_items_image_has_url check (kind <> 'image' or image_url is not null),
  constraint vision_board_items_color_has_color check (kind <> 'color' or color is not null),
  constraint vision_board_items_link_has_title check (kind <> 'link' or item_title is not null)
);

create index if not exists vision_board_items_board_idx
  on public.vision_board_items (board_id);

create index if not exists vision_board_items_item_idx
  on public.vision_board_items (item_id);

drop trigger if exists trg_vision_board_items_updated_at on public.vision_board_items;
create trigger trg_vision_board_items_updated_at before update on public.vision_board_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — même forme que les autres tables de contenu depuis la migration 0008.
-- ---------------------------------------------------------------------------

alter table public.vision_boards enable row level security;

drop policy if exists "vision_boards_select_own" on public.vision_boards;
create policy "vision_boards_select_own" on public.vision_boards
  for select using (user_id = auth.uid());

drop policy if exists "vision_boards_insert_own" on public.vision_boards;
create policy "vision_boards_insert_own" on public.vision_boards
  for insert with check (user_id = auth.uid() and public.owns_nook(nook_id));

drop policy if exists "vision_boards_update_own" on public.vision_boards;
create policy "vision_boards_update_own" on public.vision_boards
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.owns_nook(nook_id));

drop policy if exists "vision_boards_delete_own" on public.vision_boards;
create policy "vision_boards_delete_own" on public.vision_boards
  for delete using (user_id = auth.uid());

alter table public.vision_board_items enable row level security;

drop policy if exists "vision_board_items_select_own" on public.vision_board_items;
create policy "vision_board_items_select_own" on public.vision_board_items
  for select using (user_id = auth.uid());

drop policy if exists "vision_board_items_insert_own" on public.vision_board_items;
create policy "vision_board_items_insert_own" on public.vision_board_items
  for insert with check (
    user_id = auth.uid()
    and public.owns_nook(nook_id)
    and exists (
      select 1 from public.vision_boards b
      where b.id = vision_board_items.board_id and b.user_id = auth.uid()
        and b.nook_id = vision_board_items.nook_id
    )
    and (
      vision_board_items.item_id is null
      or exists (
        select 1 from public.items i
        where i.id = vision_board_items.item_id and i.user_id = auth.uid()
          and i.nook_id = vision_board_items.nook_id
      )
    )
  );

drop policy if exists "vision_board_items_update_own" on public.vision_board_items;
create policy "vision_board_items_update_own" on public.vision_board_items
  for update using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and public.owns_nook(nook_id)
    and exists (
      select 1 from public.vision_boards b
      where b.id = vision_board_items.board_id and b.user_id = auth.uid()
        and b.nook_id = vision_board_items.nook_id
    )
    and (
      vision_board_items.item_id is null
      or exists (
        select 1 from public.items i
        where i.id = vision_board_items.item_id and i.user_id = auth.uid()
          and i.nook_id = vision_board_items.nook_id
      )
    )
  );

drop policy if exists "vision_board_items_delete_own" on public.vision_board_items;
create policy "vision_board_items_delete_own" on public.vision_board_items
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage pour les images de board — même forme que `backgrounds` (0002).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vision-boards',
  'vision-boards',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vision_boards_storage_select_public" on storage.objects;
create policy "vision_boards_storage_select_public" on storage.objects
  for select using (bucket_id = 'vision-boards');

drop policy if exists "vision_boards_storage_insert_own" on storage.objects;
create policy "vision_boards_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vision-boards'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "vision_boards_storage_update_own" on storage.objects;
create policy "vision_boards_storage_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'vision-boards'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'vision-boards'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "vision_boards_storage_delete_own" on storage.objects;
create policy "vision_boards_storage_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'vision-boards'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
