# Supabase wiring runbook — admin dashboard + blog

Everything for Parts D–H (database, login, admin dashboard, blog, editable page
copy, bookings/messages inbox) is **written and staged**. This is the checklist
that connects it to a real Supabase project and switches it on.

Budget ~45–60 minutes. Nothing here touches the live static site until Step 7.

> **Why it's staged, not live:** the current site is a pure static build. The
> admin and blog need on-demand rendering (an adapter) and a database. Until the
> steps below run, the staged code lives under `src/_scaffold/` (not routed, not
> built) and `src/lib/*` is imported by nothing, so `npm run build` is
> unchanged.

---

## 0. What you need first

| Thing | Where |
|---|---|
| A Supabase project | https://supabase.com/dashboard → New project (region: EU — Frankfurt/Paris) |
| The project URL + anon key | Project → Settings → API |
| The service-role key | Same page — **secret**, only used in Step 7 |
| Vercel project access | To add env vars and change the build |
| The owner's email | The address the client will log into the dashboard with |

---

## 1. Install the two dependencies

```bash
# from the repo root
node "<npm-cli path>" install @astrojs/vercel @supabase/supabase-js
```

(This machine has no `npm` on PATH — see `.claude` memory / use the nvm copy, or
run it wherever the project normally builds.)

`package.json` should then contain:

```jsonc
"dependencies": {
  "@astrojs/vercel": "^8",        // matches Astro 6
  "@supabase/supabase-js": "^2",
  // …existing…
}
```

---

## 2. Run the migrations

Supabase dashboard → **SQL Editor** → run each file in
`supabase/migrations/` **in order**:

```
0001_init.sql       content tables (blog, blog_settings, page_overrides)
0002_admin.sql      admin_profiles + has_section()/is_admin()/is_owner()
0003_inbox.sql      bookings + contact_messages
0004_rls.sql        every row-level security policy
0005_storage.sql    the blog-images bucket
0006_seed.sql       one example blog post (optional)
```

**Before running 0002**, edit the last statement:

```sql
where email = 'REPLACE_WITH_OWNER_EMAIL@example.com'   -- put the real owner email
```

If the owner has not signed up yet, that statement inserts nothing — re-run just
that block after their first login (Step 5).

*(Or, with the Supabase CLI linked: `supabase db push`.)*

---

## 3. Environment variables

Add to `.env` (local) **and** Vercel → Settings → Environment Variables
(Production + Preview + Development):

```
PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

`.env.example` already lists these. They are `PUBLIC_*` because the anon key is
safe in the browser — RLS is the security boundary. The **service-role** key is
NOT set here; it only goes in the Edge Function (Step 7).

> Rebuild after changing any `PUBLIC_*` var — they are compiled in at build time.

---

## 4. Turn on on-demand rendering & move the staged code

### 4a. Adapter

`astro.config.mjs` — add the adapter, keep `output` as the default static so
every existing marketing page still prerenders:

```js
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://thedriver.fr',
  trailingSlash: 'always',
  adapter: vercel(),          // ← add
  // output stays 'static' (default). Only the routes that opt out with
  // `export const prerender = false` are rendered on demand.
  i18n: { /* unchanged */ },
  integrations: [ /* unchanged */ ],
  vite: { plugins: [tailwindcss()] },
});
```

### 4b. `vercel.json`

With the adapter, Astro writes the Vercel build output itself. Remove the manual
overrides so Vercel uses the adapter's output:

```jsonc
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "trailingSlash": true,
  // DELETE: "buildCommand", "outputDirectory", "framework"
  "headers": [ /* keep all existing headers */ ]
}
```

Add `/admin` to `public/robots.txt`:

```
Disallow: /admin
```

### 4c. Move the staged folders into routing

```bash
git mv src/_scaffold/admin src/pages/admin
git mv src/_scaffold/blog  src/pages/blog
git mv src/_scaffold/layouts/AdminShell.astro src/layouts/AdminShell.astro
```

Every file under them already has `export const prerender = false` where needed.

### 4d. Blog nav link (optional, when ready to show it)

Add to `src/i18n/*.json` → `nav.blog` and to `src/components/Nav.astro` +
`Footer.astro`, exactly like the `disneyland` entry that's already there.
Route key `blog` → `{ fr:'/fr/blog/', en:'/blog/', … }` (add to `src/i18n/routes.js`).
Until then the blog is reachable at `/blog/` directly and via the sitemap.

---

## 5. Markdown rendering

The blog renders article bodies with `src/lib/markdown.ts` — a small,
dependency-free, escape-first renderer (headings, bold/italic, links, images,
lists, quotes, code). It's safe for trusted admin content.

If you need tables/embeds/footnotes later, install `marked` + `sanitize-html`
and replace the body of `renderMarkdown()` — keep the signature
`(md: string) => string` and keep sanitising the output.

---

## 6. Capture bookings & messages (Part H)

The Cloudflare Worker keeps sending the emails. Add one step so submissions also
land in the dashboard. In `worker/worker.js`, after the Resend calls succeed:

```js
// non-blocking: a failed capture must never fail the booking
try {
  await fetch(`${SUPABASE_URL}/rest/v1/${isContact ? 'contact_messages' : 'bookings'}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(mapPayloadToRow(payload)),   // see helper below
  });
} catch (e) { /* swallow — the email already went out */ }
```

Add `SUPABASE_URL` + `SUPABASE_ANON_KEY` as Worker vars
(`npx wrangler secret put …`). The `anyone can submit a booking` RLS policy
(0004) allows this anonymous insert. A `mapPayloadToRow` sketch is in
`worker/README.md` (add it there when you wire this).

---

## 7. Staff accounts — the Edge Function (Part E)

Creating a login for a staff member needs the **service-role** key, which must
never reach the browser. It runs in `supabase/functions/create-worker/`.

```bash
supabase functions deploy create-worker
# service-role + url are injected automatically by Supabase — nothing to set
```

The function: verifies the caller is the active owner, re-validates the
requested section list against a hardcoded allow-list, creates the auth user
with `email_confirm: true`, inserts the `admin_profiles` row, and rolls back the
auth user if that insert fails.

---

## 8. First login & smoke test

1. Go to `/admin` → redirected to `/admin/login`.
2. The owner signs up / logs in with the email seeded in Step 2.
   *(If you seeded before they existed, re-run the 0002 insert now.)*
3. You land on the dashboard overview. The sidebar shows every section
   (owner sees all).
4. **Blog:** create a draft, add a cover image (uploads to `blog-images`),
   publish. Open `/blog/` in a normal tab — the post is listed. Open the post.
5. **Content:** open a landing page, change the hero title for EN, save. Reload
   `/en/disneyland-paris-transfer/` — the new title shows. Clear the field, save
   — the original returns.
6. **Team:** add a staff member with only *Blog* ticked. Log in as them in a
   private window — they see only Blog; `/admin/bookings` redirects to `/admin`.
7. Submit a real booking on the site — it appears under **Bookings** and the
   emails still arrive.
8. `curl -s https://thedriver.fr/robots.txt` shows `Disallow: /admin`.

---

## 9. What each section maps to

| Dashboard section | DB table(s) | `has_section` key | Facture part |
|---|---|---|---|
| Blog | `blog_posts`, `blog_settings`, `blog-images` bucket | `blog` | F |
| Content (edit page text) | `page_overrides` | `content` | G |
| Bookings | `bookings` | `bookings` | H |
| Messages | `contact_messages` | `messages` | H |
| Team | `admin_profiles` (owner only) | — | E |

---

## 10. Rollback

Nothing here is destructive to the current site until Step 4. To undo before
then: `git checkout -- .` removes the staged files' effect (they were inert
anyway). After Step 4: revert the `astro.config.mjs` / `vercel.json` commit and
redeploy — the marketing site returns to a pure static build. The Supabase
project and its data are untouched.
