-- ════════════════════════════════════════════════════════════════════════
-- 0006_seed.sql — one example blog post so the blog isn't empty on launch
-- ════════════════════════════════════════════════════════════════════════
-- Safe to skip. Delete the post from the dashboard once real articles exist.
-- Idempotent: keyed on (locale, slug).

insert into public.blog_posts
  (slug, locale, status, title, excerpt, body_md, tags, author_name,
   seo_title, seo_description, published_at)
values (
  'getting-to-disneyland-paris-from-the-airport',
  'en',
  'published',
  'Getting to Disneyland Paris from the airport: every option compared',
  'RER, shuttle bus, taxi or a private transfer — what each one really costs a family in time, money and stress.',
$md$
Arriving at a Paris airport with children, suitcases and a pushchair, the last
thing you want is to work out a train connection. Here is how the options
actually compare for a family of four heading to Disneyland Paris.

## From Charles de Gaulle (CDG)

- **RER B + RER A** — cheapest on paper, but it means a change at Châtelet–Les
  Halles with all your luggage, stairs, and a busy platform. Around 1 h 15 door
  to door if nothing goes wrong.
- **Magical Shuttle bus** — direct to the Disney hotels, but it stops at
  several hotels along the way and runs to a timetable. Budget 60–90 minutes on
  board once it leaves.
- **Private transfer** — a fixed price per vehicle, a driver waiting in
  arrivals, child seats already fitted, and 45–55 minutes straight to your
  hotel door. See our [Disneyland Paris transfer page](/en/disneyland-paris-transfer/)
  for the fares.

## From Orly

There is no direct train. It's Orlyval + RER B + RER A, or a private car. For a
family the private car usually wins once you count the transfers.

## From Beauvais

Beauvais is built for the shuttle to Porte Maillot and not much else. A private
transfer is the only realistic door-to-door option — about 1 h 15 to 1 h 40.

## The short version

If you're one or two people travelling light, the train is fine. With children
and luggage, a private transfer removes every connection for a price you know
before you leave home.
$md$,
  array['disneyland','airport transfer','family travel','cdg'],
  'The Driver',
  'Getting to Disneyland Paris from CDG, Orly & Beauvais — options compared',
  'RER vs shuttle bus vs private transfer to Disneyland Paris from Charles de Gaulle, Orly and Beauvais airports — time, cost and hassle compared for families.',
  now()
)
on conflict (locale, slug) do nothing;
