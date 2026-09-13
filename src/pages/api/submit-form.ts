// Vercel serverless function — receives booking + contact submissions from
// the static site, sends the emails via Resend.
//
// Ported from worker/worker.js (Cloudflare Worker) in September 2026, when
// the Cloudflare account it lived on was lost (see HANDOVER.md §7A). Same
// behaviour, same payload shape — the only real changes:
//
//   - Same-origin, not a separate host. The booking/contact forms now POST
//     to `/api/submit-form/` on thedriver.fr itself instead of an external
//     `*.workers.dev` URL, so the whole CORS/origin-allowlist dance the
//     Worker needed is gone — a same-origin request never triggers it.
//   - Rate limiting is a best-effort in-memory counter (see `isRateLimited`
//     below) instead of Cloudflare's `[[unsafe.bindings]] ratelimit`. Same
//     caveat as before: approximate, per-instance, clamps a burst rather
//     than guaranteeing a hard cap.
//
// Env vars needed (Vercel project → Settings → Environment Variables):
//   - RESEND_API_KEY        — server-only secret, never exposed to the browser
//   - PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY — already set for the
//     admin dashboard; reused here for the best-effort submission capture
import type { APIRoute } from 'astro';
import { buildClientEmailHtml } from '../../lib/email/clientEmail.js';
import { buildCustomerEmailHtml } from '../../lib/email/customerEmail.js';
import { buildContactEmailHtml } from '../../lib/email/contactEmail.js';

export const prerender = false;

// Longest value accepted in any single field. The forms can't produce
// anything near this; the cap exists so a scripted POST can't build a
// multi-megabyte email out of a free-text field.
const MAX_FIELD_LENGTH = 2000;

// Where the chauffeur receives bookings AND contact-form messages. Hard-coded
// because the destination is fixed for this business.
const CLIENT_TO = 'thedriver.france@gmail.com';

// Sender address. Domain `thedriver.fr` must be verified in Resend
// (Domains → add thedriver.fr → add the DNS records → Verified) for sends
// to succeed.
const FROM_ADDRESS = 'Driver Services <noreply@thedriver.fr>';

// ── Best-effort per-IP rate limit ───────────────────────────────────────
//
// Module-scope, so it only persists for as long as this particular
// serverless instance stays warm — a cold start resets it, and a burst
// spread across instances/regions isn't caught. That's the same
// "approximate, clamps a burst" caveat the old Cloudflare rate-limit
// binding carried (see worker/README.md). If abuse ever appears, the
// proper fix is Upstash Ratelimit (Vercel Marketplace, free tier) backed
// by Redis instead of this in-memory map.
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60_000;
const rateLimitHits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (rateLimitHits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  rateLimitHits.set(ip, recent);
  // Cap map growth from a flood of distinct IPs — this is a courtesy limit,
  // not a security boundary.
  if (rateLimitHits.size > 5000) rateLimitHits.clear();
  return recent.length > RATE_LIMIT;
}

function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip') || 'unknown';
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const ip = clientIp(request);

  // Per-IP rate limit. Sits before anything that costs money — a flood is
  // stopped before it reaches Resend.
  if (isRateLimited(ip)) {
    console.warn('Rate limited:', ip);
    return json(
      { success: false, error: 'Too many requests. Please try again in a minute.' },
      429,
    );
  }

  const resendApiKey = import.meta.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error('RESEND_API_KEY missing — set it in Vercel project env vars.');
    return json({ success: false, error: 'Server misconfigured' }, 500);
  }

  let data: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return json({ success: false, error: 'Invalid payload' }, 400);
    }
    data = parsed as Record<string, unknown>;
  } catch {
    return json({ success: false, error: 'Invalid JSON' }, 400);
  }

  const oversized = Object.entries(data)
    .filter(([, v]) => typeof v === 'string' && v.length > MAX_FIELD_LENGTH)
    .map(([k]) => k);
  if (oversized.length) {
    return json({ success: false, error: `Field too long: ${oversized.join(', ')}` }, 400);
  }

  // Honeypot — silently accept (don't tell the bot it failed) but skip emails.
  if (data.botcheck) {
    return json({ success: true });
  }

  // Mirror every submission into Supabase for the admin dashboard inbox.
  // Non-blocking and best-effort: the email path below is the source of
  // truth, so a capture failure (or missing Supabase env) must never fail
  // the submission.
  captureSubmission(data).catch(() => {});

  // Two form types share this endpoint: the booking modal and the contact
  // form on the FAQ page. They need different validation and different
  // emails, so dispatch here. Anything without an explicit `formType` is a
  // booking — that was the only submitter before the contact form moved
  // over, and old cached pages may still post the original shape.
  return data.formType === 'contact'
    ? handleContact(data, resendApiKey)
    : handleBooking(data, resendApiKey);
};

// ── Booking submissions ───────────────────────────────────────────────────
//
// Sends two emails: the chauffeur notification (critical) and the customer
// auto-confirmation (best-effort).
async function handleBooking(data: Record<string, unknown>, apiKey: string): Promise<Response> {
  const missing = ['firstName', 'email', 'pickup', 'dropoff', 'date', 'time']
    .filter((k) => !data[k] || String(data[k]).trim() === '');
  if (missing.length) {
    return json({ success: false, error: `Missing required fields: ${missing.join(', ')}` }, 400);
  }

  // ── Send chauffeur notification (REQUIRED — the critical path) ──
  const clientHtml = buildClientEmailHtml(data);
  const clientSubject = buildClientSubject(data);
  const clientResult = await sendEmail(apiKey, {
    from: FROM_ADDRESS,
    to: CLIENT_TO,
    replyTo: isValidEmail(data.email) ? String(data.email) : undefined,
    subject: clientSubject,
    html: clientHtml,
  });

  if (!clientResult.success) {
    console.error('Chauffeur email failed:', clientResult.error);
    return json({ success: false, error: 'Failed to send notification' }, 502);
  }

  // ── Send customer auto-confirmation (BEST-EFFORT) ──
  let customerSent = false;
  if (isValidEmail(data.email)) {
    const customerHtml = buildCustomerEmailHtml(data);
    const customerResult = await sendEmail(apiKey, {
      from: FROM_ADDRESS,
      to: String(data.email),
      replyTo: CLIENT_TO,
      subject: 'Booking confirmation — Driver Services',
      html: customerHtml,
    });
    customerSent = customerResult.success;
    if (!customerResult.success) {
      console.warn('Customer auto-confirmation failed:', customerResult.error);
    }
  }

  return json({
    success: true,
    message: 'Booking submitted successfully',
    customerEmailSent: customerSent,
  });
}

// ── Contact-form messages ─────────────────────────────────────────────────
async function handleContact(data: Record<string, unknown>, apiKey: string): Promise<Response> {
  const missing = ['firstName', 'email', 'message']
    .filter((k) => !data[k] || String(data[k]).trim() === '');
  if (missing.length) {
    return json({ success: false, error: `Missing required fields: ${missing.join(', ')}` }, 400);
  }

  const result = await sendEmail(apiKey, {
    from: FROM_ADDRESS,
    to: CLIENT_TO,
    replyTo: isValidEmail(data.email) ? String(data.email) : undefined,
    subject: buildContactSubject(data),
    html: buildContactEmailHtml(data),
  });

  if (!result.success) {
    console.error('Contact email failed:', result.error);
    return json({ success: false, error: 'Failed to send message' }, 502);
  }

  return json({ success: true, message: 'Message sent successfully' });
}

// ── Helpers ───────────────────────────────────────────────────────────────

// Deliberately permissive — this is not address verification, just a guard
// against a value that would make Resend reject the entire send. Anything
// shaped `x@y.z` with no spaces gets through.
function isValidEmail(value: unknown): boolean {
  const s = String(value == null ? '' : value).trim();
  return s.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(s);
}

// ── Supabase capture (best-effort) ───────────────────────────────────────
//
// POSTs the submission to Supabase REST as an anonymous insert. The
// `anyone can submit a booking` / `anyone can send a message` RLS policies
// (supabase/migrations/0004_rls.sql) permit this. Silently no-ops if the two
// env vars aren't set.
async function captureSubmission(data: Record<string, unknown>): Promise<void> {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return;

  const isContact = data.formType === 'contact';
  const table = isContact ? 'contact_messages' : 'bookings';
  const row: Record<string, unknown> = isContact
    ? {
        first_name: data.firstName ?? null,
        email: data.email ?? null,
        language: data.language ?? data.lang ?? null,
        message: data.message ?? null,
        raw: data,
      }
    : {
        from_loc: data.pickup ?? null,
        to_loc: data.dropoff ?? null,
        trip_type: data.tripType ?? data.trip_type ?? null,
        pax: toIntOrNull(data.passengers ?? data.pax),
        vehicle: data.vehicle ?? null,
        trip_date: data.date ?? null,
        trip_time: data.time ?? null,
        return_date: data.returnDate ?? null,
        return_time: data.returnTime ?? null,
        flight_number: data.flightNumber ?? null,
        train_number: data.trainNumber ?? null,
        pickup_address: data.pickupAddress ?? null,
        dropoff_address: data.dropoffAddress ?? null,
        child_seats: data.childSeats ?? {},
        extra_stop: data.extraStop ?? null,
        first_name: data.firstName ?? null,
        last_name: data.lastName ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        price_estimate: toIntOrNull(data.priceEstimate ?? data.price),
        locale: data.lang ?? data.locale ?? null,
        source: data.source ?? (isContact ? 'contact-form' : 'booking-modal'),
        raw: data,
      };

  await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
}

function toIntOrNull(v: unknown): number | null {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

async function sendEmail(
  apiKey: string,
  { from, to, replyTo, subject, html }: { from: string; to: string; replyTo?: string; subject: string; html: string },
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const payload: Record<string, unknown> = { from, to, subject, html };
    // Omit rather than send null — Resend rejects a null reply_to outright.
    if (replyTo) payload.reply_to = replyTo;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return { success: false, error: errorBody };
    }

    const out = (await response.json()) as { id?: string };
    return { success: true, id: out.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ── Subject line — ASCII-safe French, ≤60 chars ──────────────────────────
//
// Inbox-list previews truncate non-ASCII inconsistently across clients,
// so we strip diacritics + drop the → arrow. The full route + accented
// place names live in the email body (HTML, charset=UTF-8).
// Round-trips are prefixed "A/R" and carry the return date so the second leg
// is visible in the inbox list, not just inside the email.
function buildClientSubject(data: Record<string, unknown>): string {
  const p = asciiFold(data.pickup);
  const d = asciiFold(data.dropoff);
  const ds = formatDateShort(data.date);
  const t = data.time ? ' ' + String(data.time) : '';
  const isRoundTrip = data.tripType === 'round-trip' || data.tripType === 'roundTrip';
  if (!isRoundTrip) return `Reservation: ${p} / ${d} (${ds}${t})`;

  const rs = formatDateShort(data.returnDate);
  const rt = data.returnTime ? ' ' + String(data.returnTime) : '';
  const returnPart = rs ? ` + retour ${rs}${rt}` : ' + retour a confirmer';
  return `Reservation A/R: ${p} / ${d} (${ds}${t}${returnPart})`;
}

// Contact messages land in the same inbox as bookings, so the subject has to
// be distinguishable at a glance. Same ASCII-folding reasoning as above.
function buildContactSubject(data: Record<string, unknown>): string {
  const name = asciiFold(data.firstName).trim();
  return name ? `Message du site: ${name}` : 'Message du site';
}

function asciiFold(s: unknown): string {
  return String(s == null ? '' : s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '');
}

function formatDateShort(dateStr: unknown): string {
  if (!dateStr) return '';
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) return String(dateStr);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}
