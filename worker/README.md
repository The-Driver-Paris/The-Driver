# Driver Services — Cloudflare Worker

The site's only backend. It receives **both** forms and sends every email
through Resend from the verified `thedriver.fr` domain.

| `formType` | Sent by | Emails |
|---|---|---|
| *(absent)* or `booking` | Booking modal | French notification → chauffeur (**required**), English confirmation → customer (best-effort) |
| `contact` | FAQ-page contact form | French notification → chauffeur |

A payload with no `formType` is treated as a booking — that was the only
submitter before the contact form moved over, and cached pages may still post
the original shape.

The Worker is independent of the static site — deploy it once, the URL is
permanent, both forms fetch that URL.

## One-time setup

```bash
cd worker

# 1. Install Wrangler
npm install

# 2. Log in to Cloudflare (opens your browser)
npx wrangler login

# 3. Add the Resend API key as a server-side secret.
#    Paste the key when Wrangler prompts (it never lands in the repo).
npx wrangler secret put RESEND_API_KEY

# 4. Deploy
npx wrangler deploy
```

Wrangler will print the public URL, e.g.:

```
Deployed driver-services-form
https://driver-services-form.your-subdomain.workers.dev
```

Copy that URL into the project root `.env`:

```
PUBLIC_WORKER_URL=https://driver-services-form.your-subdomain.workers.dev
```

Then rebuild the Astro site (`npm run build`) — the Worker URL gets baked into
the booking form's submit handler.

## Updating the Worker later

If you change `worker.js` or any template:

```bash
cd worker
npm run deploy
```

The Worker updates instantly on Cloudflare's edge. The URL doesn't change, so
no site rebuild is required unless the email TEMPLATE was changed (templates
live inside the Worker — not in the Astro project).

## Security

What the Worker already does:

- **Origin allowlist.** Only `thedriver.fr`, `www.thedriver.fr`, `*.vercel.app`
  previews and `localhost:4321` may post. Anything else gets a 403. Edit
  `ALLOWED_ORIGINS` in `worker.js` if the site moves host, or the booking form
  will start failing with 403 the moment the domain changes.
- **Honeypot field** (`botcheck`) — silently accepted, no email sent.
- **Field length cap** (2,000 chars) so a scripted post can't turn the free-text
  `notes` field into a multi-megabyte email.
- **The Resend key is a Worker secret**, never bundled into the public site.

**What is still missing: rate limiting.** The origin check stops other websites
using a visitor's browser to post here, but it does not stop `curl` — CORS is a
browser mechanism and a script can send any `Origin` header it likes. Without a
rate limit, someone who finds the Worker URL (it is public, in the page source)
can flood the chauffeur's inbox and burn the Resend quota (3,000 emails/month on
the free tier; each booking sends 2).

Add the rule in the Cloudflare dashboard — it can't be expressed in
`wrangler.toml`:

**Security → WAF → Rate limiting rules → Create**, matching the Worker's route,
something like 5 requests per minute per IP, action **Block**. A real customer
submits once; anything above that is abuse.

Consider also switching `FROM_ADDRESS` off `noreply@` if you ever want customer
replies to reach the chauffeur — currently replies are steered by `reply_to`,
which most clients honour but some strip.

## Sender domain

The Worker sends both emails from `Driver Services <noreply@thedriver.fr>`.

**`thedriver.fr` must be verified in Resend before anything sends.** In the
Resend dashboard: Domains → Add domain → `thedriver.fr` → copy the DKIM/SPF
records it shows → add them to wherever the DNS for `thedriver.fr` is hosted →
wait for the status to flip to **Verified** (usually minutes).

Once verified, the Worker can deliver to any recipient —
`thedriver.france@gmail.com` for the chauffeur notification and arbitrary
customer addresses for the auto-confirmation.

If the domain is not verified, the Worker still returns 200 to the browser but
Resend rejects the send and no email arrives. Check `npx wrangler tail` to see
the rejection.

To change the sender (or move to a different verified domain), edit
`FROM_ADDRESS` at the top of `worker.js` and redeploy with `npm run deploy`.

## Local development

```bash
npm run dev
```

Wrangler starts a local Worker on `http://localhost:8787`. You can `curl` it:

```bash
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jean",
    "lastName": "Dupont",
    "email": "jean@example.com",
    "phone": "612345678",
    "countryCode": "+33",
    "pickup": "CDG",
    "dropoff": "Paris",
    "date": "2026-03-28",
    "time": "14:30",
    "pax": 4,
    "tripType": "one-way",
    "totalPrice": 95,
    "vehicleSummary": "1× Vito",
    "flightNumber": "AF1234",
    "locale": "fr"
  }'
```

Local dev needs `RESEND_API_KEY` available — Wrangler reads it from a `.dev.vars`
file at this directory's root (which is gitignored):

```
# worker/.dev.vars (NOT committed)
RESEND_API_KEY=re_your_actual_key_here
```

## Files

| File | Purpose |
|---|---|
| `worker.js` | Entry point — handles fetch, dispatches on `formType`, validates, calls Resend |
| `wrangler.toml` | Deployment config (name, compatibility date) |
| `templates/clientEmail.js` | French branded HTML — chauffeur booking notification |
| `templates/customerEmail.js` | English branded HTML — customer auto-confirmation |
| `templates/contactEmail.js` | French branded HTML — chauffeur contact-message notification |
| `package.json` | Wrangler dependency only |

## Architecture quick view

```
[Booking modal] ─── POST JSON ───┐
                                 ├─> [Cloudflare Worker] ─┬─> [Resend] ─> thedriver.france@gmail.com (FR)
[Contact form]  ─── POST JSON ───┘     dispatch on        └─> [Resend] ─> customer email (EN, booking only)
                                       formType
```

Worker free tier: 100,000 requests/day. Resend free tier: 3,000 emails/month.
For a chauffeur business, both limits are effectively infinite.
