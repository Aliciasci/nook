-- Time blocking — des créneaux datés posés sur la journée.
--
-- Comme les autres migrations : dashboard Supabase → SQL Editor → coller →
-- Run, ou `supabase db push`. Rejouable sans erreur. À appliquer après
-- `0008_nooks.sql`, dont elle reprend la mécanique de cloisonnement.
--
-- Un créneau porte soit une tâche du nook, soit rien d'autre qu'un intitulé
-- (« Réunion équipe », « Déjeuner », « Trajet »). Les deux comptent : bloquer
-- uniquement ce qui est dans Nook ferait mentir les trous de la grille sur le
-- temps réellement disponible.
--
-- Le prévu vit ici, le réalisé reste dans `focus_sessions`. Rien ne les relie
-- en base : le rapprochement se fait côté client, en sommant les sessions de
-- la tâche sur le jour du créneau. Une clé étrangère entre les deux
-- obligerait à choisir une session « officielle » par créneau, alors qu'on en
-- fait souvent plusieurs, parfois à cheval.

-- ---------------------------------------------------------------------------
-- La table
-- ---------------------------------------------------------------------------

create table if not exists public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nook_id uuid not null references public.nooks (id) on delete cascade,

  -- `set null` plutôt que `cascade` : supprimer une tâche ne doit pas réécrire
  -- l'histoire de la journée. Le créneau reste, avec son intitulé, et devient
  -- un bloc libre.
  item_id uuid references public.items (id) on delete set null,

  -- Toujours renseigné. Pour un créneau de tâche, c'est une copie du titre au
  -- moment où il a été posé : elle ne sert que d'étiquette de repli quand la
  -- tâche disparaît — tant qu'`item_id` tient, le client affiche le titre
  -- vivant de la tâche, pas celui-ci.
  title text not null check (length(trim(title)) > 0),

  day date not null,

  -- Minutes depuis minuit, heure locale, plutôt qu'un `timestamptz`.
  --
  -- Un créneau est une intention à l'horloge murale : « mardi de 9h à 10h30 ».
  -- Le stocker en instant absolu ferait glisser tout le planning au moindre
  -- changement de fuseau, et imposerait une conversion à un endroit du code
  -- qui n'a rien à voir avec les fuseaux. Le reste de l'app raisonne déjà en
  -- minutes (`toMinutes`, `nowMinutes`, la journée de travail), et la
  -- contrainte « fin après début » s'écrit directement.
  start_minute integer not null check (start_minute >= 0 and start_minute < 1440),
  end_minute integer not null check (end_minute > 0 and end_minute <= 1440),

  -- Une des six teintes des dossiers. `null` = le créneau prend celle du
  -- dossier de sa tâche, ou une teinte neutre s'il n'en a pas.
  color text check (color is null or color in ('blue', 'green', 'pink', 'beige', 'lavender', 'peach')),

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint time_blocks_range check (end_minute > start_minute)
);

-- Toutes les lectures du client sont « les créneaux de ce nook, entre ces deux
-- dates » — la vue jour comme la future vue semaine.
create index if not exists time_blocks_nook_day_idx
  on public.time_blocks (nook_id, day, start_minute);

-- Le rapprochement prévu/réalisé remonte des créneaux depuis une tâche.
create index if not exists time_blocks_item_idx
  on public.time_blocks (item_id);

drop trigger if exists trg_time_blocks_updated_at on public.time_blocks;
create trigger trg_time_blocks_updated_at before update on public.time_blocks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — même forme que les autres tables de contenu depuis la migration 0008 :
-- propriétaire uniquement, nook du compte, et la tâche référencée doit être
-- dans le même nook que le créneau.
--
-- `time_blocks.item_id` est qualifié à dessein, comme dans 0008 : la
-- sous-requête porte sur `items`, qui n'a pas de colonne `item_id`, mais s'en
-- remettre à ça rendrait la policy fragile au moindre ajout de colonne.
-- ---------------------------------------------------------------------------

alter table public.time_blocks enable row level security;

drop policy if exists "time_blocks_select_own" on public.time_blocks;
create policy "time_blocks_select_own" on public.time_blocks
  for select using (user_id = auth.uid());

drop policy if exists "time_blocks_insert_own" on public.time_blocks;
create policy "time_blocks_insert_own" on public.time_blocks
  for insert with check (
    user_id = auth.uid()
    and public.owns_nook(nook_id)
    and (
      time_blocks.item_id is null
      or exists (
        select 1 from public.items i
        where i.id = time_blocks.item_id and i.user_id = auth.uid()
          and i.nook_id = time_blocks.nook_id
      )
    )
  );

drop policy if exists "time_blocks_update_own" on public.time_blocks;
create policy "time_blocks_update_own" on public.time_blocks
  for update using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and public.owns_nook(nook_id)
    and (
      time_blocks.item_id is null
      or exists (
        select 1 from public.items i
        where i.id = time_blocks.item_id and i.user_id = auth.uid()
          and i.nook_id = time_blocks.nook_id
      )
    )
  );

drop policy if exists "time_blocks_delete_own" on public.time_blocks;
create policy "time_blocks_delete_own" on public.time_blocks
  for delete using (user_id = auth.uid());
