-- Nook — initial schema, RLS policies and new-user provisioning.
--
-- How to run this:
--   • Supabase dashboard → SQL Editor → paste this whole file → Run.
--   • Or, if you've linked the Supabase CLI to your project:
--       supabase db push
--
-- Safe to re-run: every statement uses IF NOT EXISTS / OR REPLACE / DROP..IF
-- EXISTS so re-applying this file after a partial failure won't error out on
-- "already exists".

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  icon text,
  color text not null default 'lavender',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  type text not null check (type in ('task', 'note')),
  title text not null,
  content text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text check (priority in ('low', 'medium', 'high')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- One row per user. `extra` carries theme sub-settings that don't have their
-- own column yet (custom-theme accent/mode/corner-style) so the schema can
-- evolve without a migration for every new preference.
create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  theme text not null default 'lavender',
  accent_color text,
  visual_intensity text not null default 'normal',
  animations_enabled boolean not null default true,
  work_start_time time not null default '09:00',
  lunch_start_time time not null default '12:30',
  lunch_end_time time not null default '13:30',
  work_end_time time not null default '18:00',
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid references public.items (id) on delete set null,
  mode text,
  planned_duration integer not null,
  actual_duration integer not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- One row per user. `last_active_date` isn't in the original spec but is
-- required to increment active_days at most once per calendar day.
-- `extra` carries small idempotency markers (last day/priority bonus dates)
-- that don't warrant their own columns yet.
create table if not exists public.garden_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  xp integer not null default 0,
  level integer not null default 1,
  active_days integer not null default 0,
  last_active_date date,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Audit/history log of unlocked garden elements. The app derives *current*
-- unlocks deterministically from xp client-side; this table is the
-- persisted record of when each one first unlocked.
create table if not exists public.garden_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  element_type text not null,
  element_key text not null,
  unlocked_at timestamptz not null default now(),
  unique (user_id, element_key)
);

-- ---------------------------------------------------------------------------
-- updated_at auto-touch
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_folders_updated_at on public.folders;
create trigger trg_folders_updated_at before update on public.folders
  for each row execute function public.set_updated_at();

drop trigger if exists trg_items_updated_at on public.items;
create trigger trg_items_updated_at before update on public.items
  for each row execute function public.set_updated_at();

drop trigger if exists trg_user_preferences_updated_at on public.user_preferences;
create trigger trg_user_preferences_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();

drop trigger if exists trg_garden_progress_updated_at on public.garden_progress;
create trigger trg_garden_progress_updated_at before update on public.garden_progress
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — every table below is only ever visible to its owner.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.folders enable row level security;
alter table public.items enable row level security;
alter table public.user_preferences enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.garden_progress enable row level security;
alter table public.garden_unlocks enable row level security;

-- profiles ---------------------------------------------------------------

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (user_id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (user_id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
  for delete using (user_id = auth.uid());

-- folders ------------------------------------------------------------------

drop policy if exists "folders_select_own" on public.folders;
create policy "folders_select_own" on public.folders
  for select using (user_id = auth.uid());

drop policy if exists "folders_insert_own" on public.folders;
create policy "folders_insert_own" on public.folders
  for insert with check (user_id = auth.uid());

drop policy if exists "folders_update_own" on public.folders;
create policy "folders_update_own" on public.folders
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "folders_delete_own" on public.folders;
create policy "folders_delete_own" on public.folders
  for delete using (user_id = auth.uid());

-- items — also verifies folder_id (when set) belongs to the same user ------

drop policy if exists "items_select_own" on public.items;
create policy "items_select_own" on public.items
  for select using (user_id = auth.uid());

drop policy if exists "items_insert_own" on public.items;
create policy "items_insert_own" on public.items
  for insert with check (
    user_id = auth.uid()
    and (
      folder_id is null
      or exists (select 1 from public.folders f where f.id = folder_id and f.user_id = auth.uid())
    )
  );

drop policy if exists "items_update_own" on public.items;
create policy "items_update_own" on public.items
  for update using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and (
      folder_id is null
      or exists (select 1 from public.folders f where f.id = folder_id and f.user_id = auth.uid())
    )
  );

drop policy if exists "items_delete_own" on public.items;
create policy "items_delete_own" on public.items
  for delete using (user_id = auth.uid());

-- user_preferences -----------------------------------------------------

drop policy if exists "user_preferences_select_own" on public.user_preferences;
create policy "user_preferences_select_own" on public.user_preferences
  for select using (user_id = auth.uid());

drop policy if exists "user_preferences_insert_own" on public.user_preferences;
create policy "user_preferences_insert_own" on public.user_preferences
  for insert with check (user_id = auth.uid());

drop policy if exists "user_preferences_update_own" on public.user_preferences;
create policy "user_preferences_update_own" on public.user_preferences
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "user_preferences_delete_own" on public.user_preferences;
create policy "user_preferences_delete_own" on public.user_preferences
  for delete using (user_id = auth.uid());

-- focus_sessions — also verifies item_id (when set) belongs to the user ----

drop policy if exists "focus_sessions_select_own" on public.focus_sessions;
create policy "focus_sessions_select_own" on public.focus_sessions
  for select using (user_id = auth.uid());

drop policy if exists "focus_sessions_insert_own" on public.focus_sessions;
create policy "focus_sessions_insert_own" on public.focus_sessions
  for insert with check (
    user_id = auth.uid()
    and (
      item_id is null
      or exists (select 1 from public.items i where i.id = item_id and i.user_id = auth.uid())
    )
  );

drop policy if exists "focus_sessions_update_own" on public.focus_sessions;
create policy "focus_sessions_update_own" on public.focus_sessions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "focus_sessions_delete_own" on public.focus_sessions;
create policy "focus_sessions_delete_own" on public.focus_sessions
  for delete using (user_id = auth.uid());

-- garden_progress ------------------------------------------------------

drop policy if exists "garden_progress_select_own" on public.garden_progress;
create policy "garden_progress_select_own" on public.garden_progress
  for select using (user_id = auth.uid());

drop policy if exists "garden_progress_insert_own" on public.garden_progress;
create policy "garden_progress_insert_own" on public.garden_progress
  for insert with check (user_id = auth.uid());

drop policy if exists "garden_progress_update_own" on public.garden_progress;
create policy "garden_progress_update_own" on public.garden_progress
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "garden_progress_delete_own" on public.garden_progress;
create policy "garden_progress_delete_own" on public.garden_progress
  for delete using (user_id = auth.uid());

-- garden_unlocks -------------------------------------------------------

drop policy if exists "garden_unlocks_select_own" on public.garden_unlocks;
create policy "garden_unlocks_select_own" on public.garden_unlocks
  for select using (user_id = auth.uid());

drop policy if exists "garden_unlocks_insert_own" on public.garden_unlocks;
create policy "garden_unlocks_insert_own" on public.garden_unlocks
  for insert with check (user_id = auth.uid());

drop policy if exists "garden_unlocks_update_own" on public.garden_unlocks;
create policy "garden_unlocks_update_own" on public.garden_unlocks
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "garden_unlocks_delete_own" on public.garden_unlocks;
create policy "garden_unlocks_delete_own" on public.garden_unlocks
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- New-user provisioning — runs once, right after a row lands in auth.users
-- (i.e. right after sign-up). SECURITY DEFINER so it can write these rows
-- before the new session/JWT exists to satisfy auth.uid()-based RLS.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
begin
  v_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (user_id, display_name)
  values (new.id, v_display_name)
  on conflict (user_id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.garden_progress (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.folders (user_id, name, icon, color)
  values
    (new.id, 'Inbox', '📥', 'blue'),
    (new.id, 'À voir', '⭐', 'peach'),
    (new.id, 'DEV', '💻', 'lavender'),
    (new.id, 'Idées', '💡', 'pink');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
