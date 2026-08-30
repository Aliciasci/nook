-- Nooks — plusieurs espaces indépendants par compte (un Nook pro, un Nook
-- perso…), chacun avec ses dossiers, ses items, ses liens, sa documentation,
-- son thème, son jardin et ses sessions de focus.
--
-- Comme les autres migrations : dashboard Supabase → SQL Editor → coller →
-- Run, ou `supabase db push`. Rejouable sans erreur.
--
-- Le découpage : tout ce qui est *contenu ou ambiance* appartient à un nook,
-- tout ce qui est *identité de compte* reste sur l'utilisateur. Concrètement,
-- seule `profiles` reste hors nook — elle porte en plus le pointeur vers le
-- nook actif, qui ne peut pas vivre dans `user_preferences` puisque cette
-- table est elle-même devenue propre à chaque nook.
--
-- `user_id` est conservé partout à côté de `nook_id`, alors qu'il serait
-- déductible par jointure : les policies RLS le lisent sans jointure, et les
-- index existants continuent de servir.

-- ---------------------------------------------------------------------------
-- La table
-- ---------------------------------------------------------------------------

create table if not exists public.nooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  icon text,
  -- Rang dans le sélecteur. Mêmes conventions que `folders.position` : les
  -- trous sont tolérés, le client trie.
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nooks_user_position_idx
  on public.nooks (user_id, position);

drop trigger if exists trg_nooks_updated_at on public.nooks;
create trigger trg_nooks_updated_at before update on public.nooks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- `nook_id` sur les tables de contenu
--
-- En trois temps par table : ajouter la colonne, la remplir pour l'existant,
-- puis la passer en `not null`. Le remplissage a besoin qu'un nook existe
-- déjà pour chaque compte — c'est l'étape juste en dessous.
-- ---------------------------------------------------------------------------

alter table public.folders         add column if not exists nook_id uuid references public.nooks (id) on delete cascade;
alter table public.items           add column if not exists nook_id uuid references public.nooks (id) on delete cascade;
alter table public.item_links      add column if not exists nook_id uuid references public.nooks (id) on delete cascade;
alter table public.doc_pages       add column if not exists nook_id uuid references public.nooks (id) on delete cascade;
alter table public.focus_sessions  add column if not exists nook_id uuid references public.nooks (id) on delete cascade;
alter table public.user_preferences add column if not exists nook_id uuid references public.nooks (id) on delete cascade;
alter table public.garden_progress add column if not exists nook_id uuid references public.nooks (id) on delete cascade;
alter table public.garden_unlocks  add column if not exists nook_id uuid references public.nooks (id) on delete cascade;

alter table public.profiles
  add column if not exists active_nook_id uuid references public.nooks (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Reprise de l'existant — un premier nook par compte, qui récupère tout
-- ---------------------------------------------------------------------------

-- Un compte déjà créé avant cette migration a des dossiers, une doc et un
-- jardin qui n'appartiennent à aucun nook : on lui en fabrique un et on lui
-- rattache tout. Les comptes créés après passent par `handle_new_user`.
insert into public.nooks (user_id, name, icon, position)
select u.id, 'Mon Nook', '🏡', 0
from auth.users u
where not exists (select 1 from public.nooks n where n.user_id = u.id);

-- Le nook de reprise d'un compte : le plus ancien, donc celui qu'on vient de
-- créer pour les comptes existants.
create or replace function public.first_nook_id(p_user_id uuid)
returns uuid
language sql
stable
as $$
  select n.id
  from public.nooks n
  where n.user_id = p_user_id
  order by n.position, n.created_at
  limit 1
$$;

update public.folders          set nook_id = public.first_nook_id(user_id) where nook_id is null;
update public.items            set nook_id = public.first_nook_id(user_id) where nook_id is null;
update public.item_links       set nook_id = public.first_nook_id(user_id) where nook_id is null;
update public.doc_pages        set nook_id = public.first_nook_id(user_id) where nook_id is null;
update public.focus_sessions   set nook_id = public.first_nook_id(user_id) where nook_id is null;
update public.user_preferences set nook_id = public.first_nook_id(user_id) where nook_id is null;
update public.garden_progress  set nook_id = public.first_nook_id(user_id) where nook_id is null;
update public.garden_unlocks   set nook_id = public.first_nook_id(user_id) where nook_id is null;

update public.profiles set active_nook_id = public.first_nook_id(user_id) where active_nook_id is null;

alter table public.folders          alter column nook_id set not null;
alter table public.items            alter column nook_id set not null;
alter table public.item_links       alter column nook_id set not null;
alter table public.doc_pages        alter column nook_id set not null;
alter table public.focus_sessions   alter column nook_id set not null;
alter table public.user_preferences alter column nook_id set not null;
alter table public.garden_progress  alter column nook_id set not null;
alter table public.garden_unlocks   alter column nook_id set not null;

-- ---------------------------------------------------------------------------
-- Unicité — les tables « une ligne par utilisateur » deviennent « une ligne
-- par nook ». Sans ça, deux nooks se partageraient un seul thème et un seul
-- jardin, et l'upsert du client écraserait l'un avec l'autre.
-- ---------------------------------------------------------------------------

alter table public.user_preferences drop constraint if exists user_preferences_user_id_key;
alter table public.garden_progress  drop constraint if exists garden_progress_user_id_key;
alter table public.garden_unlocks   drop constraint if exists garden_unlocks_user_id_element_key_key;

create unique index if not exists user_preferences_nook_id_key on public.user_preferences (nook_id);
create unique index if not exists garden_progress_nook_id_key  on public.garden_progress (nook_id);
create unique index if not exists garden_unlocks_nook_element_key
  on public.garden_unlocks (nook_id, element_key);

-- ---------------------------------------------------------------------------
-- Index — toutes les lectures du client sont désormais filtrées par nook
-- ---------------------------------------------------------------------------

create index if not exists folders_nook_position_idx  on public.folders (nook_id, position);
create index if not exists items_nook_idx             on public.items (nook_id);
create index if not exists item_links_nook_idx        on public.item_links (nook_id);
create index if not exists doc_pages_nook_parent_idx  on public.doc_pages (nook_id, parent_id, position);
create index if not exists focus_sessions_nook_idx    on public.focus_sessions (nook_id, started_at);

-- ---------------------------------------------------------------------------
-- Le dernier nook ne se supprime pas
--
-- Un compte sans nook n'a nulle part où aller : l'app n'aurait aucun espace à
-- ouvrir. Le client le refuse déjà côté interface, la base le rend impossible.
-- Une suppression de compte passe par la cascade sur `auth.users`, qui coupe
-- `nooks` sans déclencher ce trigger ligne à ligne côté application.
-- ---------------------------------------------------------------------------

-- `security definer` : la fonction lit `auth.users`, que le rôle
-- `authenticated` n'a pas le droit de consulter. Sans ça, toute suppression de
-- nook depuis le client échouerait sur un refus de permission. Elle ne renvoie
-- rien de cette table — elle teste seulement l'existence d'une ligne dont
-- l'identifiant lui est déjà donné.
create or replace function public.prevent_last_nook_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Le compte s'en va : la cascade emporte tous ses nooks d'un coup, il n'y a
  -- plus rien à protéger.
  if not exists (select 1 from auth.users u where u.id = old.user_id) then
    return old;
  end if;

  if not exists (
    select 1 from public.nooks n where n.user_id = old.user_id and n.id <> old.id
  ) then
    raise exception 'Impossible de supprimer le dernier nook du compte'
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_nooks_prevent_last_delete on public.nooks;
create trigger trg_nooks_prevent_last_delete before delete on public.nooks
  for each row execute function public.prevent_last_nook_delete();

-- ---------------------------------------------------------------------------
-- RLS
--
-- Même forme qu'avant — propriétaire uniquement — plus la vérification que le
-- nook désigné lui appartient, et que les lignes référencées (dossier, item,
-- page parente) sont dans *le même nook*. C'est cette dernière partie qui
-- empêche une tâche du nook pro d'atterrir dans un dossier du nook perso.
-- ---------------------------------------------------------------------------

alter table public.nooks enable row level security;

drop policy if exists "nooks_select_own" on public.nooks;
create policy "nooks_select_own" on public.nooks
  for select using (user_id = auth.uid());

drop policy if exists "nooks_insert_own" on public.nooks;
create policy "nooks_insert_own" on public.nooks
  for insert with check (user_id = auth.uid());

drop policy if exists "nooks_update_own" on public.nooks;
create policy "nooks_update_own" on public.nooks
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "nooks_delete_own" on public.nooks;
create policy "nooks_delete_own" on public.nooks
  for delete using (user_id = auth.uid());

-- Raccourci pour les policies : le nook existe-t-il, et est-il à moi ?
create or replace function public.owns_nook(p_nook_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.nooks n where n.id = p_nook_id and n.user_id = auth.uid()
  )
$$;

-- profiles — `active_nook_id` doit pointer sur un nook du compte ------------

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and (active_nook_id is null or public.owns_nook(active_nook_id))
  );

-- folders ------------------------------------------------------------------

drop policy if exists "folders_select_own" on public.folders;
create policy "folders_select_own" on public.folders
  for select using (user_id = auth.uid());

drop policy if exists "folders_insert_own" on public.folders;
create policy "folders_insert_own" on public.folders
  for insert with check (user_id = auth.uid() and public.owns_nook(nook_id));

drop policy if exists "folders_update_own" on public.folders;
create policy "folders_update_own" on public.folders
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.owns_nook(nook_id));

-- items — le dossier doit être dans le même nook ----------------------------

drop policy if exists "items_insert_own" on public.items;
create policy "items_insert_own" on public.items
  for insert with check (
    user_id = auth.uid()
    and public.owns_nook(nook_id)
    and (
      items.folder_id is null
      or exists (
        select 1 from public.folders f
        where f.id = items.folder_id and f.user_id = auth.uid() and f.nook_id = items.nook_id
      )
    )
  );

drop policy if exists "items_update_own" on public.items;
create policy "items_update_own" on public.items
  for update using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and public.owns_nook(nook_id)
    and (
      items.folder_id is null
      or exists (
        select 1 from public.folders f
        where f.id = items.folder_id and f.user_id = auth.uid() and f.nook_id = items.nook_id
      )
    )
  );

-- item_links — les deux items doivent être dans le même nook que le lien ----

drop policy if exists "item_links_insert_own" on public.item_links;
create policy "item_links_insert_own" on public.item_links
  for insert with check (
    user_id = auth.uid()
    and public.owns_nook(nook_id)
    and exists (
      select 1 from public.items i
      where i.id = item_links.item_id and i.user_id = auth.uid()
        and i.nook_id = item_links.nook_id
    )
    and exists (
      select 1 from public.items i
      where i.id = item_links.linked_item_id and i.user_id = auth.uid()
        and i.nook_id = item_links.nook_id
    )
  );

-- doc_pages — la page parente doit être dans le même nook -------------------
--
-- `doc_pages.parent_id` est qualifié à dessein : la sous-requête porte sur
-- `doc_pages` elle-même, et un `parent_id` nu y désignerait la colonne de
-- l'alias interne `p` — la condition se lirait `p.id = p.parent_id`, qu'une
-- contrainte de la migration 0003 rend justement toujours fausse. Les
-- policies de 0003 avaient cette ambiguïté ; celles-ci la lèvent.

drop policy if exists "doc_pages_insert_own" on public.doc_pages;
create policy "doc_pages_insert_own" on public.doc_pages
  for insert with check (
    user_id = auth.uid()
    and public.owns_nook(nook_id)
    and (
      doc_pages.parent_id is null
      or exists (
        select 1 from public.doc_pages p
        where p.id = doc_pages.parent_id and p.user_id = auth.uid() and p.nook_id = doc_pages.nook_id
      )
    )
  );

drop policy if exists "doc_pages_update_own" on public.doc_pages;
create policy "doc_pages_update_own" on public.doc_pages
  for update using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and public.owns_nook(nook_id)
    and (
      doc_pages.parent_id is null
      or exists (
        select 1 from public.doc_pages p
        where p.id = doc_pages.parent_id and p.user_id = auth.uid() and p.nook_id = doc_pages.nook_id
      )
    )
  );

-- focus_sessions — la tâche chronométrée doit être dans le même nook --------

drop policy if exists "focus_sessions_insert_own" on public.focus_sessions;
create policy "focus_sessions_insert_own" on public.focus_sessions
  for insert with check (
    user_id = auth.uid()
    and public.owns_nook(nook_id)
    and (
      focus_sessions.item_id is null
      or exists (
        select 1 from public.items i
        where i.id = focus_sessions.item_id and i.user_id = auth.uid()
          and i.nook_id = focus_sessions.nook_id
      )
    )
  );

drop policy if exists "focus_sessions_update_own" on public.focus_sessions;
create policy "focus_sessions_update_own" on public.focus_sessions
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.owns_nook(nook_id));

-- user_preferences / garden — une ligne par nook ----------------------------

drop policy if exists "user_preferences_insert_own" on public.user_preferences;
create policy "user_preferences_insert_own" on public.user_preferences
  for insert with check (user_id = auth.uid() and public.owns_nook(nook_id));

drop policy if exists "user_preferences_update_own" on public.user_preferences;
create policy "user_preferences_update_own" on public.user_preferences
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.owns_nook(nook_id));

drop policy if exists "garden_progress_insert_own" on public.garden_progress;
create policy "garden_progress_insert_own" on public.garden_progress
  for insert with check (user_id = auth.uid() and public.owns_nook(nook_id));

drop policy if exists "garden_progress_update_own" on public.garden_progress;
create policy "garden_progress_update_own" on public.garden_progress
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.owns_nook(nook_id));

drop policy if exists "garden_unlocks_insert_own" on public.garden_unlocks;
create policy "garden_unlocks_insert_own" on public.garden_unlocks
  for insert with check (user_id = auth.uid() and public.owns_nook(nook_id));

drop policy if exists "garden_unlocks_update_own" on public.garden_unlocks;
create policy "garden_unlocks_update_own" on public.garden_unlocks
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.owns_nook(nook_id));

-- ---------------------------------------------------------------------------
-- Provisioning d'un nouveau compte — remplace la version de la migration 0001
--
-- Le nook part en premier : les préférences, le jardin et les dossiers de
-- départ ont désormais besoin de son identifiant.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
  v_nook_id uuid;
begin
  v_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.nooks (user_id, name, icon, position)
  values (new.id, 'Mon Nook', '🏡', 0)
  returning id into v_nook_id;

  insert into public.profiles (user_id, display_name, active_nook_id)
  values (new.id, v_display_name, v_nook_id)
  on conflict (user_id) do nothing;

  insert into public.user_preferences (user_id, nook_id)
  values (new.id, v_nook_id);

  insert into public.garden_progress (user_id, nook_id)
  values (new.id, v_nook_id);

  insert into public.folders (user_id, nook_id, name, icon, color)
  values
    (new.id, v_nook_id, 'Inbox', '📥', 'blue'),
    (new.id, v_nook_id, 'À voir', '⭐', 'peach'),
    (new.id, v_nook_id, 'DEV', '💻', 'lavender'),
    (new.id, v_nook_id, 'Idées', '💡', 'pink');

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Provisioning d'un nouveau nook
--
-- Créer un nook depuis le client, c'est trois écritures liées : le nook, sa
-- ligne de préférences et sa ligne de jardin, plus ses dossiers de départ si
-- on en veut. Une fonction les fait d'un bloc, pour qu'un nook n'existe
-- jamais à moitié équipé.
-- ---------------------------------------------------------------------------

create or replace function public.create_nook(
  p_name text,
  p_icon text default null,
  p_with_starter_folders boolean default true
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_nook_id uuid;
  v_position integer;
begin
  if v_user_id is null then
    raise exception 'Non authentifié' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(max(position) + 1, 0) into v_position
  from public.nooks where user_id = v_user_id;

  insert into public.nooks (user_id, name, icon, position)
  values (v_user_id, coalesce(nullif(trim(p_name), ''), 'Nouveau nook'), p_icon, v_position)
  returning id into v_nook_id;

  insert into public.user_preferences (user_id, nook_id) values (v_user_id, v_nook_id);
  insert into public.garden_progress (user_id, nook_id) values (v_user_id, v_nook_id);

  if p_with_starter_folders then
    insert into public.folders (user_id, nook_id, name, icon, color, position)
    values
      (v_user_id, v_nook_id, 'Inbox', '📥', 'blue', 0),
      (v_user_id, v_nook_id, 'À voir', '⭐', 'peach', 1),
      (v_user_id, v_nook_id, 'Idées', '💡', 'pink', 2);
  end if;

  return v_nook_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retrouver le nook d'un contenu
--
-- Le nook actif n'est pas dans l'URL : un lien `/docs/<id>` mis en favori
-- depuis un autre nook tombe donc sur une page que le client ne trouve pas.
-- Plutôt qu'un « introuvable », il demande ici à quel nook appartient cet
-- identifiant et propose d'y basculer. `security definer` parce que le
-- client, lui, filtre déjà sur le nook actif — mais le `where user_id` garde
-- la réponse limitée au compte appelant.
-- ---------------------------------------------------------------------------

create or replace function public.nook_of(p_kind text, p_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_nook_id uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  if p_kind = 'folder' then
    select nook_id into v_nook_id from public.folders where id = p_id and user_id = auth.uid();
  elsif p_kind = 'item' then
    select nook_id into v_nook_id from public.items where id = p_id and user_id = auth.uid();
  elsif p_kind = 'doc_page' then
    select nook_id into v_nook_id from public.doc_pages where id = p_id and user_id = auth.uid();
  else
    raise exception 'Type inconnu : %', p_kind using errcode = 'invalid_parameter_value';
  end if;

  return v_nook_id;
end;
$$;
