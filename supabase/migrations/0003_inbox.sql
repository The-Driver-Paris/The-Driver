-- ════════════════════════════════════════════════════════════════════════
-- 0003_inbox.sql — bookings + contact messages capture (Phase H)
-- ════════════════════════════════════════════════════════════════════════
--
-- The site already emails every booking and contact submission via the
-- Cloudflare Worker + Resend. This ALSO records them so nothing is lost if an
-- email bounces or is filtered. The Worker gains one extra step: after sending
-- the emails, POST the payload to Supabase REST. See SUPABASE-SETUP.md §6.
--
-- anon may INSERT (that's the Worker / the public form). Only staff with the
-- matching section may read or update. Nobody deletes from the app.

create table if not exists public.bookings (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  status          text not null default 'new'
                    check (status in ('new','contacted','confirmed','done','cancelled')),
  -- trip
  from_loc        text,
  to_loc          text,
  trip_type       text,               -- 'oneWay' | 'roundTrip'
  pax             int,
  vehicle         text,
  trip_date       date,
  trip_time       text,
  return_date     date,
  return_time     text,
  flight_number   text,
  train_number    text,
  pickup_address  text,
  dropoff_address text,
  child_seats     jsonb not null default '{}'::jsonb,
  extra_stop      text,
  -- customer
  first_name      text,
  last_name       text,
  phone           text,
  email           text,
  -- meta
  price_estimate  int,
  locale          text,
  source          text,               -- 'booking-modal' | 'contact-form' | ...
  notes           text not null default '',      -- staff-only
  raw             jsonb not null default '{}'::jsonb   -- the full original payload
);

create index if not exists bookings_status_idx on public.bookings (status, created_at desc);
create index if not exists bookings_created_idx on public.bookings (created_at desc);

alter table public.bookings enable row level security;

create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  status      text not null default 'new'
                check (status in ('new','contacted','done','cancelled')),
  first_name  text,
  email       text,
  language    text,
  message     text,
  notes       text not null default '',
  raw         jsonb not null default '{}'::jsonb
);

create index if not exists contact_messages_status_idx
  on public.contact_messages (status, created_at desc);

alter table public.contact_messages enable row level security;
