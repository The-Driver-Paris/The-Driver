-- ════════════════════════════════════════════════════════════════════════
-- 0004_rls.sql — every row-level security policy in one place
-- ════════════════════════════════════════════════════════════════════════
--
-- Read this as the security contract for the whole app.
--   * The public marketing site is anonymous → it needs anon SELECT on the
--     content it renders (published posts, blog settings, page overrides).
--   * The public forms are anonymous → anon INSERT on bookings / messages.
--   * Everything else is staff-only, gated on has_section(...) from 0002.
-- admin_profiles' own policies are in 0002 (they must exist before the
-- has_section() helper is used anywhere).

-- ---------------------------------------------------------------------------
-- blog_posts
-- ---------------------------------------------------------------------------
drop policy if exists "published posts are public" on public.blog_posts;
create policy "published posts are public" on public.blog_posts
  for select to anon, authenticated
  using (
    status = 'published'
    and (published_at is null or published_at <= now())
  );

drop policy if exists "blog staff manage posts" on public.blog_posts;
create policy "blog staff manage posts" on public.blog_posts
  for all to authenticated
  using (public.has_section('blog'))
  with check (public.has_section('blog'));

-- ---------------------------------------------------------------------------
-- blog_settings
-- ---------------------------------------------------------------------------
drop policy if exists "blog settings are public" on public.blog_settings;
create policy "blog settings are public" on public.blog_settings
  for select to anon, authenticated using (true);

drop policy if exists "blog staff manage settings" on public.blog_settings;
create policy "blog staff manage settings" on public.blog_settings
  for update to authenticated
  using (public.has_section('blog'))
  with check (public.has_section('blog'));

-- ---------------------------------------------------------------------------
-- page_overrides
-- ---------------------------------------------------------------------------
drop policy if exists "overrides are public" on public.page_overrides;
create policy "overrides are public" on public.page_overrides
  for select to anon, authenticated using (true);

drop policy if exists "content staff manage overrides" on public.page_overrides;
create policy "content staff manage overrides" on public.page_overrides
  for all to authenticated
  using (public.has_section('content'))
  with check (public.has_section('content'));

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------
drop policy if exists "anyone can submit a booking" on public.bookings;
create policy "anyone can submit a booking" on public.bookings
  for insert to anon, authenticated
  with check (true);

drop policy if exists "bookings staff read" on public.bookings;
create policy "bookings staff read" on public.bookings
  for select to authenticated
  using (public.has_section('bookings'));

drop policy if exists "bookings staff update" on public.bookings;
create policy "bookings staff update" on public.bookings
  for update to authenticated
  using (public.has_section('bookings'))
  with check (public.has_section('bookings'));

-- ---------------------------------------------------------------------------
-- contact_messages
-- ---------------------------------------------------------------------------
drop policy if exists "anyone can send a message" on public.contact_messages;
create policy "anyone can send a message" on public.contact_messages
  for insert to anon, authenticated
  with check (true);

drop policy if exists "messages staff read" on public.contact_messages;
create policy "messages staff read" on public.contact_messages
  for select to authenticated
  using (public.has_section('messages'));

drop policy if exists "messages staff update" on public.contact_messages;
create policy "messages staff update" on public.contact_messages
  for update to authenticated
  using (public.has_section('messages'))
  with check (public.has_section('messages'));
