# Driver Services

Multilingual landing page for **Driver Services**, a private chauffeur / taxi service for tourists in Paris.

> Setting this up for the first time? Read [HANDOVER.md](HANDOVER.md) instead —
> it covers accounts, DNS, deployment and testing step by step. This file is
> the day-to-day reference once the site is already running.

## Stack

- **Framework:** [Astro](https://astro.build) (static, multi-page)
- **Styling:** [Tailwind CSS](https://tailwindcss.com) (v4, via `@tailwindcss/vite`)
- **Interactivity:** Vanilla JS only — no UI framework.
- **Booking form:** posts to a [Cloudflare Worker](worker/README.md) that sends two emails via [Resend](https://resend.com).
- **Contact form:** posts to [Web3Forms](https://web3forms.com) — no backend; goes straight to the client's email.
- **Analytics:** none installed. Add your own in [src/layouts/BaseLayout.astro](src/layouts/BaseLayout.astro) if wanted.
- **Hosting:** [Vercel](https://vercel.com) — settings live in [vercel.json](vercel.json) (build `npm run build`, output `dist`).

## Languages

Astro's built-in i18n, path-based routing, `prefixDefaultLocale: false`.

| Locale | URL prefix |
| ------ | ---------- |
| French (default) | `/` |
| English | `/en/` |
| Spanish | `/es/` |
| Italian | `/it/` |

## Run locally

```sh
npm install
npm run dev        # http://localhost:4321
```

Other commands:

```sh
npm run build              # output to ./dist
npm run preview            # preview the built site
npm run optimize-images    # regenerate .jpg/.webp/.avif variants (see below)
npm run generate-favicons  # regenerate favicon set from public/favicon.svg
```

## Favicons

The master is [public/favicon.svg](public/favicon.svg) — edit it in any vector
editor and re-run `npm run generate-favicons` to regenerate the derived files:

| Output | Use |
| ------ | --- |
| `public/favicon.svg` | Modern browsers (vector, scales perfectly) |
| `public/favicon.ico` | Legacy browsers (multi-res 16/32/48) |
| `public/apple-touch-icon.png` | iOS "Add to Home Screen" (180×180) |
| `public/icon-192.png` | Android Chrome (192×192) |
| `public/icon-512.png` | PWA install / splash (512×512) |
| `public/site.webmanifest` | PWA manifest pointing at the icons |

The generator script ([scripts/generate-favicons.js](scripts/generate-favicons.js))
reads the SVG, rasterizes via sharp, and writes everything back into `/public/`.
Don't run it on every build — it's a manual command for when the favicon source
changes.

## Image pipeline

Real photos live in `public/images/fleet/` and `public/images/routes/`.

Components dynamically scan these folders at build time and match filenames to
card slots by keyword (see [src/utils/images.js](src/utils/images.js)):

| Folder | Filename hint | Used by |
| --- | --- | --- |
| `fleet/` | `tesla*` | Car card (Tesla Model Y) |
| `fleet/` | `vito*` / `trafic*` / `traffic*` / `van*` / `mercedes*` | Van card |
| `routes/` | `hotel*` / `hotels*` / `paris*` | Destinations → Paris hotels |
| `routes/` | `disney*` / `disneyland*` | Destinations → Disneyland Paris |
| `routes/` | `versailles*` | Destinations → Château de Versailles |
| `routes/` | `gare*` / `train*` | Destinations → Paris train stations |
| `routes/` | `aeroport*` / `airport*` / `cdg*` / `orly*` / `beauvais*` | Destinations → Between airports |
| `routes/` | `eiffel*` / `tour*` | Destinations → Paris à l'heure |

Missing files fall back to the silhouette placeholder and log a `[images]` warning in the build output.

**Format fallbacks.** Each card renders `<picture>` with `avif → webp → jpg`
sources (whichever exist on disk). To generate missing variants:

```sh
npm install --save-dev sharp    # one-time
npm run optimize-images         # run whenever you add a new raw photo
```

The optimizer resizes to 1200px (fleet) / 800px (routes), strips metadata, and
writes `.jpg` (q85), `.webp` (q80), and `.avif` (q55) siblings beside each
source. It skips outputs that are already up-to-date, so re-running it is
cheap. Do NOT wire it into the normal build — it's an author-side step; the
generated files are committed alongside the sources.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Vercel dashboard → **Add New → Project → Import** the repo. The Astro preset
   is detected automatically; [vercel.json](vercel.json) pins the build command,
   output directory and headers, so leave the UI fields at their defaults.
3. Under **Settings → Environment Variables** add both `PUBLIC_*` values from
   [.env.example](.env.example), for **Production, Preview and Development**.
   Vercel never reads your local `.env`.
4. Deploy. You get a `*.vercel.app` URL; add `thedriver.fr` under
   **Settings → Domains** afterward.
5. `site` in [astro.config.mjs](astro.config.mjs) must match the production
   domain — canonical URLs, hreflang tags and the sitemap are all built from it.

> **Rebuild after changing an env var.** Both `PUBLIC_*` values are compiled into
> the HTML at build time. Changing one in the dashboard does nothing until you
> redeploy.

### URL shape

Every URL carries a **trailing slash** (`/tarifs/`, `/en/fleet/`). Three places
must agree or Google indexes each page twice:

| Where | Setting |
| --- | --- |
| [astro.config.mjs](astro.config.mjs) | `trailingSlash: 'always'` |
| [src/i18n/routes.js](src/i18n/routes.js) | every path ends in `/` |
| [vercel.json](vercel.json) | `"trailingSlash": true` (308-redirects the slashless form) |

Adding a route means adding it to `ROUTES` **with** a trailing slash.

### Domain setup

Add both `thedriver.fr` and `www.thedriver.fr` in **Settings → Domains**, then
mark the apex `thedriver.fr` as primary so `www` 308-redirects to it. Serving
both without a redirect splits ranking signals between two hostnames.

Use the exact DNS records Vercel shows in that panel (an `A` record for the apex
and a `CNAME` for `www`) — the values are shown per-project and change over
time, so copy them from the dashboard rather than from any guide.

## Where to edit things

- **Prices & route matrix** → [src/data/routes.js](src/data/routes.js). Single source of truth — `PRICES[from][to] = { car, van }`. Update `HOURLY_RATE`, `ROUND_TRIP_DISCOUNT`, and `VEHICLE_CAPACITY` here too.
- **Vehicle definitions** → [src/data/vehicles.js](src/data/vehicles.js).
- **All user-facing text** → [src/i18n/fr.json](src/i18n/fr.json), [en.json](src/i18n/en.json), [es.json](src/i18n/es.json), [it.json](src/i18n/it.json). No hardcoded strings in components — add a key here, reference via `t(locale).section.key`.
- **Global styles** → [src/styles/global.css](src/styles/global.css).
- **Shared layout, `<head>` meta, structured data** → [src/layouts/BaseLayout.astro](src/layouts/BaseLayout.astro).
- **Booking emails & their templates** → [worker/](worker/) — see [worker/README.md](worker/README.md).

## Folder layout

```
src/
  components/         Nav, Footer, LanguageSwitcher, (Hero, BookingForm, Fleet… later)
  layouts/
    BaseLayout.astro  <head>, lang attribute, nav, footer
  pages/
    index.astro       FR home
    en/index.astro    EN home
    es/index.astro    ES home
    it/index.astro    IT home
  i18n/
    fr.json / en.json / es.json / it.json
    index.js          t(locale), localizedPath(locale, path)
  data/
    routes.js         Pickups, drops, price matrix, capacity, hourly rate
    vehicles.js       Vehicle definitions
  styles/
    global.css        Tailwind entrypoint
public/
  images/             Real photos go here
  favicon.svg
```
