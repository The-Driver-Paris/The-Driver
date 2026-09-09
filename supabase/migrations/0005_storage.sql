-- ════════════════════════════════════════════════════════════════════════
-- 0005_storage.sql — the blog image bucket
-- ════════════════════════════════════════════════════════════════════════
--
-- Public read (images appear on the public blog), authenticated write
-- (only signed-in staff upload). Object-level per-section RLS isn't worth it;
-- the blog_posts rows that reference the images are already gated.
--
-- If the dashboard shows "bucket not found", run this again — creating a
-- bucket that exists is a no-op with `on conflict`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-images',
  'blog-images',
  true,
  5242880,                                   -- 5 MB per file
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "blog images are public" on storage.objects;
create policy "blog images are public" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'blog-images');

drop policy if exists "blog staff upload images" on storage.objects;
create policy "blog staff upload images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'blog-images' and public.has_section('blog'));

drop policy if exists "blog staff replace images" on storage.objects;
create policy "blog staff replace images" on storage.objects
  for update to authenticated
  using (bucket_id = 'blog-images' and public.has_section('blog'));

drop policy if exists "blog staff delete images" on storage.objects;
create policy "blog staff delete images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'blog-images' and public.has_section('blog'));
