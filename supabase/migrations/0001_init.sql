-- ════════════════════════════════════════════════════════════════════════
-- 0001_init.sql — core content tables (blog + editable page copy)
-- ════════════════════════════════════════════════════════════════════════
--
-- Run order: 0001 → 0002 → 0003 → 0004 → 0005 → 0006.
-- Apply from the Supabase dashboard (SQL Editor) or `supabase db push`.
-- RLS is enabled here but the POLICIES all live in 0005_rls.sql, so nothing
-- is readable/writable between 0001 and 0005 except via the service role.
--
-- Design notes:
--   * One blog post = one locale. A post may point at another via
--     `translation_of` to group language versions; there is no shared-content
--     table, because the client writes each article in whatever language they
--     want and translations are optional and independent.
--   * `body_md` is Markdown. The public site renders it; the admin edits it.
--   * Every table has `created_at` / `updated_at`; `updated_at` is kept current
--     by the trigger defined below.

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- blog_posts
-- ---------------------------------------------------------------------------
create table if not exists public.blog_posts (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null,
  locale          text not null default 'en' check (locale in ('en','fr','es','it')),
  status          text not null default 'draft' check (status in ('draft','scheduled','published')),
  title           text not null default '',
  excerpt         text not null default '',
  body_md         text not null default '',
  cover_image     text,                              -- storage URL or external
  cover_alt       text not null default '',
  tags            text[] not null default '{}',
  author_name     text not null default 'The Driver',
  seo_title       text,                              -- falls back to title
  seo_description text,                              -- falls back to excerpt
  published_at    timestamptz,                       -- when it goes/went live
  translation_of  uuid references public.blog_posts(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- a slug is unique per language, not globally (so /blog/x and /fr/blog/x can coexist)
  unique (locale, slug)
);

create index if not exists blog_posts_status_pub_idx
  on public.blog_posts (status, published_at desc);
create index if not exists blog_posts_locale_idx
  on public.blog_posts (locale);
create index if not exists blog_posts_tags_idx
  on public.blog_posts using gin (tags);

drop trigger if exists blog_posts_updated_at on public.blog_posts;
create trigger blog_posts_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();

alter table public.blog_posts enable row level security;

-- ---------------------------------------------------------------------------
-- blog_settings — singleton row (id is always true)
-- ---------------------------------------------------------------------------
create table if not exists public.blog_settings (
  id              boolean primary key default true check (id),
  posts_per_page  int not null default 9 check (posts_per_page between 1 and 50),
  -- page chrome, per locale; NULL means "use the text compiled into the site"
  title_en text, title_fr text, title_es text, title_it text,
  intro_en text, intro_fr text, intro_es text, intro_it text,
  updated_at      timestamptz not null default now()
);

drop trigger if exists blog_settings_updated_at on public.blog_settings;
create trigger blog_settings_updated_at
  before update on public.blog_settings
  for each row execute function public.set_updated_at();

insert into public.blog_settings (id) values (true) on conflict (id) do nothing;

alter table public.blog_settings enable row level security;

-- ---------------------------------------------------------------------------
-- page_overrides — admin-editable marketing copy (Phase G)
-- ---------------------------------------------------------------------------
-- One row per (page_key, field_key, locale). Absent row OR null value means
-- "use the text compiled into the site from src/i18n/*.json". The admin editor
-- shows the compiled text as the input placeholder, so clearing a field is an
-- explicit "restore the original", never a way to blank the page.
create table if not exists public.page_overrides (
  id          uuid primary key default gen_random_uuid(),
  page_key    text not null,            -- e.g. 'disneyland', 'parisTransfer', 'home'
  field_key   text not null,            -- dotted path, e.g. 'hero.title'
  locale      text not null check (locale in ('en','fr','es','it')),
  value       text,                     -- null = use compiled text
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null,
  unique (page_key, field_key, locale)
);

create index if not exists page_overrides_page_idx
  on public.page_overrides (page_key, locale);

drop trigger if exists page_overrides_updated_at on public.page_overrides;
create trigger page_overrides_updated_at
  before update on public.page_overrides
  for each row execute function public.set_updated_at();

alter table public.page_overrides enable row level security;
