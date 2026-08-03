// Cloudflare Worker — receives booking submissions from the static site,
// sends two emails via Resend (chauffeur notification + customer confirmation).
//
// Architecture:
//   - Static site (Astro, on Vercel/Pages) submits JSON to this Worker URL.
//   - Worker validates, builds two HTML emails, calls Resend API.
//   - Returns { success: true } on chauffeur-email success.
//   - Customer email failure does NOT block the response — the chauffeur
//     getting the booking is the critical path; the customer auto-reply
//     is nice-to-have.
//
// Env / secrets (set via `wrangler secret put RESEND_API_KEY`):
//   - RESEND_API_KEY — server-side only, never exposed to the browser.

import { buildClientEmailHtml } from './templates/clientEmail.js';
import { buildCustomerEmailHtml } from './templates/customerEmail.js';
import { buildContactEmailHtml } from './templates/contactEmail.js';

// CORS — restricted to the production domain, Vercel preview deploys and the
// local dev server. Add an entry here if the site ever moves host again.
//
// NOTE: this stops *other websites* from posting to the Worker with a user's
// browser. It does NOT stop scripted abuse — curl ignores CORS entirely. The
// protection against a flood of fake bookings is the Cloudflare rate-limiting
// rule on this Worker's route (see worker/README.md), not this list.
const ALLOWED_ORIGINS = [
  'https://thedriver.fr',
  'https://www.thedriver.fr',
  'http://localhost:4321',
];

// Vercel preview deploys: https://<project>-<hash>-<scope>.vercel.app
const PREVIEW_ORIGIN = /^https:\/\/[a-z0-9-]+\.vercel\.app$/;

function isAllowedOrigin(origin) {
  return ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN.test(origin);
}

// `Vary: Origin` matters because the response differs per origin — without it
// a cache could serve one origin's CORS header to another.
function corsHeadersFor(origin) {
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

// Longest value we'll accept in any single field. The booking form can't
// produce anything near this; the cap exists so a scripted POST can't build a
// multi-megabyte email out of the free-text `notes` field.
const MAX_FIELD_LENGTH = 2000;

// Where the chauffeur receives bookings AND contact-form messages. Hard-coded
// because the destination is fixed for this business.
const CLIENT_TO = 'thedriver.france@gmail.com';

// Sender address. Domain `thedriver.fr` must be verified in Resend
// (Domains → add thedriver.fr → add the DNS records → Verified) for sends
// to succeed. Once verified, the Worker can deliver to any recipient
// (chauffeur Hotmail + arbitrary customer addresses). Both emails use this.
const FROM_ADDRESS = 'Driver Services <noreply@thedriver.fr>';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeadersFor(origin);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method not allowed' }, 405, cors);
    }

    // The real form is always cross-origin to this Worker, so a legitimate
    // submission always carries an Origin header. Rejecting anything else
    // costs nothing and turns away naive scripted posting.
    if (!isAllowedOrigin(origin)) {
      console.warn('Rejected submission from origin:', origin || '(none)');
      return jsonResponse({ success: false, error: 'Forbidden' }, 403, cors);
    }

    // Per-IP rate limit (binding configured in wrangler.toml). Sits after the
    // origin check so cheap 403s don't burn budget, but before anything that
    // costs money — a flood is stopped before it reaches Resend.
    //
    // Guarded because the binding is absent when worker.js is imported
    // directly in a local test harness.
    if (env.RATE_LIMITER) {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const { success: allowed } = await env.RATE_LIMITER.limit({ key: ip });
      if (!allowed) {
        console.warn('Rate limited:', ip);
        return jsonResponse(
          { success: false, error: 'Too many requests. Please try again in a minute.' },
          429,
          cors,
        );
      }
    }

    if (!env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY missing — set with: wrangler secret put RESEND_API_KEY');
      return jsonResponse({ success: false, error: 'Server misconfigured' }, 500, cors);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return jsonResponse({ success: false, error: 'Invalid JSON' }, 400, cors);
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return jsonResponse({ success: false, error: 'Invalid payload' }, 400, cors);
    }

    const oversized = Object.entries(data)
      .filter(([, v]) => typeof v === 'string' && v.length > MAX_FIELD_LENGTH)
      .map(([k]) => k);
    if (oversized.length) {
      return jsonResponse(
        { success: false, error: `Field too long: ${oversized.join(', ')}` },
        400,
        cors,
      );
    }

    // Honeypot — silently accept (don't tell the bot it failed) but skip emails.
    if (data.botcheck) {
      return jsonResponse({ success: true }, 200, cors);
    }

    // Two form types share this Worker: the booking modal and the contact
    // form on the FAQ page. They need different validation and different
    // emails, so dispatch here. Anything without an explicit `formType` is a
    // booking — that was the only submitter before the contact form moved
    // over, and old cached pages may still post the original shape.
    return data.formType === 'contact'
      ? handleContact(data, env, cors)
      : handleBooking(data, env, cors);
  },
};

// ── Booking submissions ───────────────────────────────────────────────────
//
// Sends two emails: the chauffeur notification (critical) and the customer
// auto-confirmation (best-effort).
async function handleBooking(data, env, cors) {
  // Required-field check. Loose — the form already validates client-side,
  // this is a sanity gate so bad shapes don't reach Resend.
  const missing = ['firstName', 'email', 'pickup', 'dropoff', 'date', 'time']
    .filter((k) => !data[k] || String(data[k]).trim() === '');
  if (missing.length) {
    return jsonResponse(
      { success: false, error: `Missing required fields: ${missing.join(', ')}` },
      400,
      cors,
    );
  }

  // ── Send chauffeur notification (REQUIRED — the critical path) ──
  //
  // `replyTo` is only passed when the address actually parses. A malformed
  // one makes Resend reject the whole send, which would fail the booking the
  // chauffeur needs to receive — losing the reply-to convenience is the far
  // cheaper failure.
  const clientHtml = buildClientEmailHtml(data);
  const clientSubject = buildClientSubject(data);
  const clientResult = await sendEmail(env.RESEND_API_KEY, {
    from: FROM_ADDRESS,
    to: CLIENT_TO,
    replyTo: isValidEmail(data.email) ? data.email : undefined,
    subject: clientSubject,
    html: clientHtml,
  });

  if (!clientResult.success) {
    console.error('Chauffeur email failed:', clientResult.error);
    return jsonResponse(
      { success: false, error: 'Failed to send notification' },
      502,
      cors,
    );
  }

  // ── Send customer auto-confirmation (BEST-EFFORT) ──
  // If this fails, still return success — the chauffeur got the booking,
  // that's what matters. Skipped entirely for an unparseable address.
  let customerSent = false;
  if (isValidEmail(data.email)) {
    const customerHtml = buildCustomerEmailHtml(data);
    const customerResult = await sendEmail(env.RESEND_API_KEY, {
      from: FROM_ADDRESS,
      to: data.email,
      replyTo: CLIENT_TO,
      subject: 'Booking confirmation — Driver Services',
      html: customerHtml,
    });
    customerSent = customerResult.success;
    if (!customerResult.success) {
      console.warn('Customer auto-confirmation failed:', customerResult.error);
    }
  }

  return jsonResponse(
    {
      success: true,
      message: 'Booking submitted successfully',
      customerEmailSent: customerSent,
    },
    200,
    cors,
  );
}

// ── Contact-form messages ─────────────────────────────────────────────────
//
// One email, to the chauffeur. No auto-reply: the form shows an on-page
// success card, and an enquiry doesn't carry the commitment a booking does.
async function handleContact(data, env, cors) {
  const missing = ['firstName', 'email', 'message']
    .filter((k) => !data[k] || String(data[k]).trim() === '');
  if (missing.length) {
    return jsonResponse(
      { success: false, error: `Missing required fields: ${missing.join(', ')}` },
      400,
      cors,
    );
  }

  const result = await sendEmail(env.RESEND_API_KEY, {
    from: FROM_ADDRESS,
    to: CLIENT_TO,
    replyTo: isValidEmail(data.email) ? data.email : undefined,
    subject: buildContactSubject(data),
    html: buildContactEmailHtml(data),
  });

  if (!result.success) {
    console.error('Contact email failed:', result.error);
    return jsonResponse(
      { success: false, error: 'Failed to send message' },
      502,
      cors,
    );
  }

  return jsonResponse(
    { success: true, message: 'Message sent successfully' },
    200,
    cors,
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function jsonResponse(body, status = 200, cors = corsHeadersFor('')) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

// Deliberately permissive — this is not address verification, just a guard
// against a value that would make Resend reject the entire send. Anything
// shaped `x@y.z` with no spaces gets through.
function isValidEmail(value) {
  const s = String(value == null ? '' : value).trim();
  return s.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(s);
}

async function sendEmail(apiKey, { from, to, replyTo, subject, html }) {
  try {
    const payload = { from, to, subject, html };
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

    const out = await response.json();
    return { success: true, id: out.id };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
}

// ── Subject line — ASCII-safe French, ≤60 chars ──────────────────────────
//
// Inbox-list previews truncate non-ASCII inconsistently across clients,
// so we strip diacritics + drop the → arrow. The full route + accented
// place names live in the email body (HTML, charset=UTF-8).
function buildClientSubject(data) {
  const p = asciiFold(data.pickup);
  const d = asciiFold(data.dropoff);
  const ds = formatDateShort(data.date);
  const t = data.time ? ' ' + data.time : '';
  return `Reservation: ${p} / ${d} (${ds}${t})`;
}

// Contact messages land in the same inbox as bookings, so the subject has to
// be distinguishable at a glance. Same ASCII-folding reasoning as above.
function buildContactSubject(data) {
  const name = asciiFold(data.firstName).trim();
  return name ? `Message du site: ${name}` : 'Message du site';
}

function asciiFold(s) {
  return String(s == null ? '' : s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '');
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) return String(dateStr);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}
