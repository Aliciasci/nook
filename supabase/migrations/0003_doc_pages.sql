-- Documentation — a tree of pages, each holding an ordered list of blocks.
--
-- Run it like the others: Supabase dashboard → SQL Editor → paste → Run,
-- or `supabase db push`. Every statement is re-runnable.
--
-- Blocks live in a jsonb array rather than their own table: a page is always
-- read and written whole (the editor saves the page it is editing), so a
-- second table would only buy per-block queries the app never makes.

create table if not exists public.doc_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Self-reference: deleting a page deletes its whole subtree.
  parent_id uuid references public.doc_pages (id) on delete cascade,
  title text not null default 'Sans titre',
  icon text,
  -- Rank among siblings. Gaps are fine; the client sorts and never assumes
  -- the values are contiguous.
  position integer not null default 0,
  blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint doc_pages_blocks_is_array check (jsonb_typeof(blocks) = 'array'),
  -- A page cannot be its own parent. Deeper cycles can't be built through
  -- the app (it refuses to move a page under its own descendant).
  constraint doc_pages_no_self_parent check (parent_id is null or parent_id <> id)
);

create index if not exists doc_pages_user_parent_idx
  on public.doc_pages (user_id, parent_id, position);

drop trigger if exists trg_doc_pages_updated_at on public.doc_pages;
create trigger trg_doc_pages_updated_at before update on public.doc_pages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — same shape as items: owner-only, and a parent page (when set) must
-- belong to the same user.
-- ---------------------------------------------------------------------------

alter table public.doc_pages enable row level security;

drop policy if exists "doc_pages_select_own" on public.doc_pages;
create policy "doc_pages_select_own" on public.doc_pages
  for select using (user_id = auth.uid());

drop policy if exists "doc_pages_insert_own" on public.doc_pages;
create policy "doc_pages_insert_own" on public.doc_pages
  for insert with check (
    user_id = auth.uid()
    and (
      parent_id is null
      or exists (select 1 from public.doc_pages p where p.id = parent_id and p.user_id = auth.uid())
    )
  );

drop policy if exists "doc_pages_update_own" on public.doc_pages;
create policy "doc_pages_update_own" on public.doc_pages
  for update using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and (
      parent_id is null
      or exists (select 1 from public.doc_pages p where p.id = parent_id and p.user_id = auth.uid())
    )
  );

drop policy if exists "doc_pages_delete_own" on public.doc_pages;
create policy "doc_pages_delete_own" on public.doc_pages
  for delete using (user_id = auth.uid());
