// Supabase clients.
//
// Two entry points:
//   • getServerClient()  — anon-key client for use in Astro server routes /
//     `.astro` frontmatter that is `prerender = false`. Reads env at call time.
//   • getBrowserClient()  — singleton anon-key client for the admin dashboard
//     islands that run in the browser (login, CRUD forms). Persists the session.
//
// The SERVICE-ROLE key is never imported here. It only ever lives in a Supabase
// Edge Function (creating staff accounts) — see supabase/functions/ and
// SUPABASE-SETUP.md §7. Keeping it out of this file is deliberate.
//
// Until `@supabase/supabase-js` is installed and the env vars are set, this
// module is dormant: nothing in src/pages/ imports it, so the static build is
// unaffected. See SUPABASE-SETUP.md.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

type Client = SupabaseClient<Database>;

function readEnv(key: string): string {
  // import.meta.env in Astro/Vite; process.env as a fallback for scripts.
  const v =
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[key] ??
    (typeof process !== 'undefined' ? process.env?.[key] : undefined);
  if (!v) {
    throw new Error(
      `[supabase] Missing ${key}. Set it in .env (local) and in the Vercel ` +
        `project env for Production, Preview and Development, then rebuild. ` +
        `See SUPABASE-SETUP.md.`,
    );
  }
  return v;
}

/** Server-side anon client. Safe in `prerender = false` routes only. */
export function getServerClient(): Client {
  return createClient<Database>(
    readEnv('PUBLIC_SUPABASE_URL'),
    readEnv('PUBLIC_SUPABASE_ANON_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

let browserClient: Client | null = null;

/** Browser singleton for the admin dashboard. Persists the auth session. */
export function getBrowserClient(): Client {
  if (browserClient) return browserClient;
  browserClient = createClient<Database>(
    readEnv('PUBLIC_SUPABASE_URL'),
    readEnv('PUBLIC_SUPABASE_ANON_KEY'),
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'thedriver-admin-auth',
      },
    },
  );
  return browserClient;
}
