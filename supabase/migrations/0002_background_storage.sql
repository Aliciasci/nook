-- Storage for user-uploaded full-screen background images.
--
-- Files live at `<user_id>/<uuid>.<ext>` inside the `backgrounds` bucket. The
-- bucket is public-read so the app can point at a plain URL with no signing
-- round-trip; write access is restricted to the owning user by matching the
-- first path segment against auth.uid(). Unlike 0001, every statement here is
-- re-runnable.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'backgrounds',
  'backgrounds',
  true,
  5242880, -- 5 MB; the client downscales before upload, so this is a backstop
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Anyone may read: the bucket is public and the URLs are unguessable UUIDs.
drop policy if exists "backgrounds_select_public" on storage.objects;
create policy "backgrounds_select_public" on storage.objects
  for select using (bucket_id = 'backgrounds');

-- Write access only inside a folder named after the caller's own user id.
drop policy if exists "backgrounds_insert_own" on storage.objects;
create policy "backgrounds_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'backgrounds'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "backgrounds_update_own" on storage.objects;
create policy "backgrounds_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'backgrounds'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'backgrounds'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "backgrounds_delete_own" on storage.objects;
create policy "backgrounds_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'backgrounds'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
