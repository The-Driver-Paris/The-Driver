/// <reference path="./deno.d.ts" />
// @ts-nocheck — this file runs on Deno (Supabase Edge Runtime), not Node.
// `Deno.serve`, `Deno.env` and `npm:` imports are valid there but VS Code's
// built-in (Node) TypeScript server flags them. It is type-checked by Deno on
// `supabase functions deploy`. Install the "Deno" VS Code extension for real
// IntelliSense here (see .vscode/settings.json); the reference above +
// this pragma silence the Node checker in the meantime.

// supabase/functions/create-worker/index.ts
//
// Creates a login for a staff member. Needs the SERVICE-ROLE key, which must
// never reach the browser — so it lives here. Supabase injects SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY automatically; nothing to configure.
//
// Deploy:  supabase functions deploy create-worker
//
// Non-negotiables (each learned the hard way):
//  • verify the CALLER is the active owner — a worker must not mint a colleague
//  • re-validate the section list against a hardcoded allow-list (client input)
//  • email_confirm: true so the worker can log in immediately (no inbox flow)
//  • roll back the auth user if the admin_profiles insert fails
//  • machine-readable codes + CORS on every response incl. OPTIONS
//
// This file is SELF-CONTAINED on purpose (no ../_shared import): the deploy
// bundler is not reliable about pulling sibling files across CLI versions.

import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_SECTIONS = ['blog', 'content', 'bookings', 'messages']; // keep in sync with src/lib/adminSections.ts

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ code: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // --- verify the caller ---
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ code: 'unauthorized' }, 401);
  const { data: caller, error: callerErr } = await admin.auth.getUser(jwt);
  if (callerErr || !caller.user) return json({ code: 'unauthorized' }, 401);

  const { data: profile } = await admin
    .from('admin_profiles')
    .select('is_owner, active')
    .eq('user_id', caller.user.id)
    .maybeSingle();
  if (!profile || !profile.active || !profile.is_owner) return json({ code: 'forbidden' }, 403);

  // --- validate the body ---
  let body: { email?: string; password?: string; sections?: unknown };
  try { body = await req.json(); } catch { return json({ code: 'bad_request' }, 400); }

  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ code: 'bad_email' }, 400);
  if (password.length < 8) return json({ code: 'weak_password' }, 400);

  const sections = Array.isArray(body.sections)
    ? [...new Set(body.sections.map(String))].filter((s) => ALLOWED_SECTIONS.includes(s))
    : [];

  // --- create the auth user ---
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    const dup = /registered|already/i.test(createErr?.message ?? '');
    return json({ code: dup ? 'email_exists' : 'create_failed', message: createErr?.message }, dup ? 409 : 400);
  }

  // --- insert the profile; roll back the auth user on failure ---
  const { error: profErr } = await admin.from('admin_profiles').insert({
    user_id: created.user.id,
    email,
    is_owner: false,
    sections,
    active: true,
  });
  if (profErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ code: 'profile_failed', message: profErr.message }, 400);
  }

  return json({ ok: true, user_id: created.user.id, sections });
});
