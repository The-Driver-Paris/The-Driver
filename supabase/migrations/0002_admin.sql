-- ════════════════════════════════════════════════════════════════════════
-- 0002_admin.sql — staff accounts with per-section permissions
-- ════════════════════════════════════════════════════════════════════════
--
-- Auth is Supabase Auth (email/password) — no custom users table. This adds
-- the AUTHORIZATION layer on top: an `admin_profiles` row decides whether a
-- signed-in user can reach the dashboard at all, and which sections they may
-- write. Enforced in the database (RLS in 0005), mirrored in the UI only for
-- convenience.
--
-- ⚠ After this migration runs, ONLY seeded admins can write to admin tables.
--   A self-registered auth user has no admin_profiles row and sees the
--   "no access" screen. Public/anon read paths are unaffected.
--
-- Section keys (keep in sync with src/lib/adminSections.ts and any edge fn):
--   'blog'      — create/edit/publish articles
--   'content'   — edit marketing copy on the landing pages (page_overrides)
--   'bookings'  — the bookings inbox
--   'messages'  — the contact-messages inbox
--   ('team' and the dashboard overview are not grantable — see adminSections.ts)

create table if not exists public.admin_profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  is_owner   boolean not null default false,
  sections   text[]  not null default '{}',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_profiles enable row level security;

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helpers — REQUIRED, not a shortcut.
-- They read admin_profiles with the definer's rights, bypassing that table's
-- own RLS. Without SECURITY DEFINER, every policy that calls has_section()
-- re-enters admin_profiles' policies and Postgres raises infinite recursion.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_profiles
    where user_id = auth.uid() and active
  );
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_profiles
    where user_id = auth.uid() and active and is_owner
  );
$$;

create or replace function public.has_section(s text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_profiles
    where user_id = auth.uid() and active and (is_owner or s = any(sections))
  );
$$;

-- ---------------------------------------------------------------------------
-- Policies on admin_profiles itself
-- ---------------------------------------------------------------------------
drop policy if exists "own profile readable" on public.admin_profiles;
create policy "own profile readable" on public.admin_profiles
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "owner manages profiles" on public.admin_profiles;
create policy "owner manages profiles" on public.admin_profiles
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- ---------------------------------------------------------------------------
-- Seed the owner. REPLACE the email, then this row is the only one that can
-- write until the owner adds staff from the Team page.
-- If the owner has not signed up yet, run this again after their first login.
-- ---------------------------------------------------------------------------
insert into public.admin_profiles (user_id, email, is_owner, sections, active)
select id, email, true, '{}', true
from auth.users
where email = 'REPLACE_WITH_OWNER_EMAIL@example.com'   -- TODO(client)
on conflict (user_id) do update set is_owner = true, active = true;
