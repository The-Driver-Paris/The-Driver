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

// Where the chauffeur receives bookings. Hard-coded because the destination
// is fixed for this business.
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
    const clientHtml = buildClientEmailHtml(data);
    const clientSubject = buildClientSubject(data);
    const clientResult = await sendEmail(env.RESEND_API_KEY, {
      from: FROM_ADDRESS,
      to: CLIENT_TO,
      replyTo: data.email,
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
    // If this fails (Resend free tier restricts recipients to verified
    // addresses until a domain is set up), still return success — the
    // chauffeur got the booking, that's what matters.
    const customerHtml = buildCustomerEmailHtml(data);
    const customerResult = await sendEmail(env.RESEND_API_KEY, {
      from: FROM_ADDRESS,
      to: data.email,
      replyTo: CLIENT_TO,
      subject: 'Booking confirmation — Driver Services',
      html: customerHtml,
    });

    if (!customerResult.success) {
      console.warn('Customer auto-confirmation failed:', customerResult.error);
    }

    return jsonResponse(
      {
        success: true,
        message: 'Booking submitted successfully',
        customerEmailSent: customerResult.success,
      },
      200,
      cors,
    );
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────

function jsonResponse(body, status = 200, cors = corsHeadersFor('')) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

async function sendEmail(apiKey, { from, to, replyTo, subject, html }) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        reply_to: replyTo,
        subject,
        html,
      }),
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
