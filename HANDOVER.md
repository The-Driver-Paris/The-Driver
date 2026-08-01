# Driver Services — Handover

Everything needed to host `thedriver.fr` independently. Written for the
developer taking this over. Budget 1–2 hours end to end, most of it waiting
on DNS.

---

## 1. What this project is

A **static** multilingual site built with [Astro](https://astro.build) 6 +
Tailwind CSS 4. No database, no CMS, no server-side rendering — `npm run build`
produces a plain folder of HTML/CSS/JS in `dist/` that any web host can serve.

Four languages, path-routed: French at `/` (default, no prefix), English at
`/en/`, Spanish at `/es/`, Italian at `/it/`.

Two things reach the outside world:

| Feature | How it works | Needs an account? |
|---|---|---|
| **Booking form** (the modal) | Site POSTs JSON to a small Cloudflare Worker, which calls the Resend API and sends two emails: a French notification to the chauffeur and an English confirmation to the customer | **Yes** — Cloudflare + Resend |
| **Contact form** (bottom of the FAQ/Contact page) | Site POSTs directly to web3forms.com, which forwards the message by email | **Yes** — Web3Forms (free) |
| **WhatsApp button** | Plain `https://wa.me/33634301292` link | No. Works with zero setup |
| **Phone / email links** | Plain `tel:` and `mailto:` links | No |

The WhatsApp button and phone links need nothing — they work the moment the
site is online.

**There is no analytics or tracking code in this project.** No Google Tag
Manager, no Google Analytics, no cookies, no consent banner needed. If you want
analytics, install your own — see §6.

---

## 2. Accounts to create

Both free at this traffic level.

| Service | Why | Cost |
|---|---|---|
| **GitHub** | Holds the repo Vercel builds from | Free |
| **Vercel** | Hosts the site + serves `thedriver.fr` | Free (Hobby) |
| **Cloudflare** | Hosts the booking Worker only — not the site, not DNS | Free |
| **Resend** | Actually sends the booking emails | Free up to 3,000/month |
| **Web3Forms** | Contact form delivery | Free up to 250/month |

You also need the login for whoever `thedriver.fr` is registered with, so you
can point its DNS at Vercel at the end.

The site does **not** have to live on Vercel — see §8. The Worker is the only
piece tied to Cloudflare.

> **Commercial use note:** Vercel's free Hobby plan is for non-commercial
> projects. A paying client's business site should be on a Pro team to stay
> within Vercel's terms.

---

## 3. Setup, in order

The order matters. Doing DNS last means the live site never goes down.

### Step 1 — Get it running locally

Requires Node 22.12 or newer.

```bash
npm install
npm run dev          # http://localhost:4321
```

The site renders fully. Both forms show "Missing form config" on submit until
the steps below are done — that is expected.

### Step 2 — Decide where DNS lives

You need access to the DNS zone for `thedriver.fr`, because two services want
records in it: **Resend** (step 3, to send email) and **Vercel** (step 8, to
serve the site).

Keeping DNS at the current registrar is fine and is the least disruptive
choice — Vercel only needs one `A` record and one `CNAME`. Do **not** move
nameservers now; the live site must keep working until step 8.

Export or screenshot the existing zone before changing anything.

### Step 3 — Verify the domain in Resend

Resend dashboard → **Domains** → **Add domain** → `thedriver.fr`.

Resend shows a set of DKIM/SPF (and optionally DMARC) records. Add every one to
the DNS zone from step 2. Wait until the status reads **Verified** — usually a
few minutes.

Then **API Keys** → create a key. Copy it, you only see it once.

> Nothing sends until this domain reads Verified. If it isn't, the booking form
> still looks like it worked (the browser gets a 200) but no email arrives.
> `npx wrangler tail` from inside `worker/` shows the rejection.

### Step 4 — Deploy the booking Worker

```bash
cd worker
npm install
npx wrangler login                      # opens a browser
npx wrangler secret put RESEND_API_KEY  # paste the key from step 3
npx wrangler deploy
```

Wrangler prints a URL like
`https://driver-services-form.<your-subdomain>.workers.dev`. **Copy it.**

The Resend key is stored server-side by Cloudflare. It is never bundled into
the public site.

### Step 5 — Web3Forms key

Go to https://web3forms.com, enter the email address that should receive
contact-form messages, and they email you an access key. No password, no
dashboard.

### Step 6 — Fill in .env

Copy `.env.example` to `.env` and set both values:

```
PUBLIC_WORKER_URL=https://driver-services-form.<your-subdomain>.workers.dev
PUBLIC_WEB3FORMS_KEY=<key from step 5>
```

> **The most common mistake on this project:** these values are compiled into
> the HTML at build time. They are not read at runtime. Change one and you must
> re-run `npm run build` and redeploy. Redeploying without rebuilding does
> nothing.

### Step 7 — Push to GitHub and deploy on Vercel

Push the repo to GitHub, then in the Vercel dashboard: **Add New → Project →
Import**.

`vercel.json` already pins the build command (`npm run build`), the output
directory (`dist`), the trailing-slash rule and the cache/security headers, so
leave the build fields at their detected defaults.

The one thing you **must** set by hand: **Settings → Environment Variables** →
add `PUBLIC_WORKER_URL` and `PUBLIC_WEB3FORMS_KEY`, ticked for **Production,
Preview and Development**. Vercel does not read your local `.env`.

> Set the variables **before** the first deploy, or deploy once and then
> redeploy. They are baked in at build time — adding them without rebuilding
> leaves both forms showing "Missing form config".

Set **Node.js Version** to 22.x or later under Settings → General if the
detected default is older (`package.json` → `engines` requires ≥ 22.12).

Deploy. You get a `*.vercel.app` URL — test the whole site there before touching
DNS.

### Step 8 — Point the domain

In the Vercel project: **Settings → Domains** → add both `thedriver.fr` and
`www.thedriver.fr`. Set the apex `thedriver.fr` as primary so `www` redirects to
it rather than serving duplicate content.

Vercel then displays the exact DNS records to create — an `A` record for the
apex and a `CNAME` for `www`. **Copy the values from that panel**; they are
project-specific and change over time, so don't paste IPs from an old guide.

Add those records at the DNS provider from step 2, leaving the Resend records
untouched. Propagation is typically minutes. Vercel issues the HTTPS certificate
automatically once the records resolve.

### Step 9 — Test before calling it done

1. Submit a **real booking** through the modal. Two emails must arrive: one to
   `thedriver.france@gmail.com`, one to the address you entered.
2. Submit the **contact form** at the bottom of the FAQ/Contact page.
3. Click the WhatsApp button on a phone.
4. Check all four languages load: `/`, `/en/`, `/es/`, `/it/`.
5. Confirm `https://thedriver.fr/tarifs` (no slash) 308-redirects to
   `/tarifs/`, and that `www.thedriver.fr` redirects to the apex.
6. Open `https://thedriver.fr/sitemap-index.xml` — it must list 20 URLs, all
   with trailing slashes, and must **not** contain `/thank-you/`.
7. Submit the sitemap in Google Search Console after verifying the domain.

Only once booking emails are confirmed arriving should the previous provider's
Resend domain, Worker and hosting project be shut down.

---

## 4. Where to edit things

| What | File |
|---|---|
| **Prices and route matrix** | `src/data/routes.js` — `PRICES[from][to] = { car, van }`. Also holds `HOURLY_RATE`, `ROUND_TRIP_DISCOUNT`, `VEHICLE_CAPACITY`. Single source of truth. |
| **Vehicles** | `src/data/vehicles.js` |
| **All visible text, every language** | `src/i18n/fr.json`, `en.json`, `es.json`, `it.json`. No text is hardcoded in components — add a key here and reference it as `t(locale).section.key`. |
| **Reviews** | `src/data/reviews.js` |
| **Chauffeur's receiving address** | `worker/worker.js` → `CLIENT_TO` |
| **Email sender address** | `worker/worker.js` → `FROM_ADDRESS` (its domain must be verified in Resend) |
| **Booking email design** | `worker/templates/clientEmail.js` (French, to chauffeur), `worker/templates/customerEmail.js` (English, to customer) |
| **Phone / WhatsApp number** | Search the repo for `33634301292` |
| **Contact email shown on the site** | Search for `thedriver.france@gmail.com` |
| **Global styles** | `src/styles/global.css` |
| **Head tags, schema.org** | `src/layouts/BaseLayout.astro` |

Changing an email template only needs the Worker redeployed
(`cd worker && npm run deploy`) — no site rebuild. Changing anything under
`src/` needs a site rebuild.

---

## 5. Images

Photos live in `public/images/fleet/` and `public/images/routes/`. Components
scan these folders at build time and match filenames to card slots by keyword
(rules documented in `README.md`, implemented in `src/utils/images.js`). A
missing file falls back to a silhouette placeholder and logs an `[images]`
warning during the build.

After adding a new photo, generate its `.webp` / `.avif` variants:

```bash
npm run optimize-images
```

Author-side command, deliberately not wired into the build. The generated files
are committed alongside the originals.

Favicons regenerate from `public/favicon.svg` via `npm run generate-favicons`.

---

## 6. Adding analytics

The project ships with none. To add Google Tag Manager, Plausible, Matomo or
anything else, put the snippet in `src/layouts/BaseLayout.astro` — there is a
marked comment in the `<head>` showing where. It applies to all 21 pages at
once.

If you use a cookie-based tool (Google Analytics/GTM), French and EU law
requires a consent banner. Cookieless tools (Plausible, Matomo in cookieless
mode) do not.

---

## 7. Troubleshooting

| Symptom | Cause |
|---|---|
| "Missing form config" on booking submit | `PUBLIC_WORKER_URL` empty, or set but the site wasn't rebuilt after |
| "Missing form config" on contact submit | `PUBLIC_WEB3FORMS_KEY` empty, or set but not rebuilt |
| Booking form says success, no email arrives | `thedriver.fr` not Verified in Resend, or the Resend key wasn't set as a Worker secret. Run `npx wrangler tail` in `worker/` and submit again to see the real error. |
| Chauffeur gets the email, customer doesn't | Customer address typo, or it landed in spam — the Resend dashboard logs every send |
| A page 404s after deploy | Host isn't serving directory-style URLs. On nginx: `try_files $uri $uri/ $uri/index.html =404;` |
| Build fails on Node version | Needs Node ≥ 22.12. On Vercel: Settings → General → Node.js Version |
| Search Console reports duplicate pages | Trailing-slash rule broken. `trailingSlash` must be `'always'` in `astro.config.mjs` and `true` in `vercel.json`, and every path in `src/i18n/routes.js` must end in `/` |
| Both `www.` and apex serve the site | Only one should. Vercel → Settings → Domains → set the apex as primary so `www` redirects |

---

## 8. If you don't want Vercel

The site is static, so it runs anywhere — Netlify, Cloudflare Pages, a VPS with
nginx, shared hosting. Build with `npm run build` and serve `dist/`. Set both
`PUBLIC_*` variables in that host's build settings, since they are needed at
build time.

Whatever host you pick must **serve every URL with a trailing slash** and
redirect the slashless form to it (`/tarifs` → `/tarifs/`). The canonical tags,
hreflang tags and sitemap are all generated in that shape; a host that does the
opposite makes every page canonicalise to a URL that redirects. On nginx that is
`rewrite ^([^.]*[^/])$ $1/ permanent;` plus
`try_files $uri $uri/ $uri/index.html =404;`.

The **Worker is the only piece tied to Cloudflare.** Two options:

- **Keep it on Cloudflare** even if the site lives elsewhere. It's an
  independent URL and costs nothing. Simplest by far.
- **Port it.** `worker/worker.js` is ~150 lines of standard fetch code calling
  the Resend HTTP API. It converts to an Express route, a Vercel function or a
  Netlify function with minor changes. The two email templates are plain JS and
  carry over untouched. Whatever you build must accept a POST of JSON and
  return permissive CORS headers; the expected payload shape is documented in
  `worker/README.md`.

---

## 9. What is NOT included, on purpose

- `node_modules/` — restore with `npm install`
- `dist/` — regenerate with `npm run build`
- `.env` and `worker/.dev.vars` — these hold secrets. `.env.example` documents
  every value you need.
- API keys of any kind. There are no credentials anywhere in this source code;
  everything sensitive is supplied through the environment.
