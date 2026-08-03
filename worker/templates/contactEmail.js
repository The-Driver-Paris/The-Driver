// French branded HTML email — contact-form message notification.
// Recipient is always the same French-speaking chauffeur, so the template is
// monolingual (French) regardless of the visitor's site locale.
//
// This is the third email type, alongside clientEmail.js (booking → chauffeur)
// and customerEmail.js (booking → customer). It replaces the Web3Forms relay
// the contact form used to post to, so every outbound mail on this site now
// leaves from the verified `thedriver.fr` domain via Resend.
//
// Follows the same email-safe HTML rules as clientEmail.js:
//   - Table-only layout, inline styles, 6-char hex colors
//   - No border-radius, padding/margin longhand (Outlook)
//   - HTML entities for accented chars, eyebrows pre-uppercased
//   - mso-line-height-rule:exactly on text cells

const LOGO_URL = 'https://thedriver.fr/newlogo.png';
const LOGO_WIDTH = 96;
const LOGO_HEIGHT = 55;
const LOGO_COL_WIDTH = LOGO_WIDTH + 16;

const COLORS = {
  cream: '#F8F5EE',
  paper: '#FFFFFF',
  ink: '#1A1A1A',
  graphite: '#4A4A48',
  accent: '#C94F3A',
  smoke: '#E8E3D8',
  faded: '#A8A39A',
};
const FONT_BODY = "Arial, Helvetica, 'Helvetica Neue', sans-serif";
const FONT_DISPLAY = "Georgia, 'Times New Roman', Times, serif";
const TD_BODY = 'mso-line-height-rule:exactly; line-height:18px;';

const L = {
  eyebrow:      'DRIVER SERVICES &middot; NOUVEAU MESSAGE',
  heading:      'Question depuis le site',
  contact:      'CONTACT',
  phone:        'T&eacute;l&eacute;phone',
  email:        'Email',
  message:      'MESSAGE',
  replyLang:    'LANGUE DE R&Eacute;PONSE',
  source:       'ORIGINE',
  page:         'Page',
  receivedVia:  'Re&ccedil;u via',
  notProvided:  'Non renseign&eacute;',
};

// Which language the chauffeur should reply in — the visitor picks this
// explicitly on the form, which is why it gets its own section.
const LANGUAGE_LABELS = {
  fr: 'Fran&ccedil;ais',
  en: 'Anglais',
  es: 'Espagnol',
  it: 'Italien',
};

// ── Helpers ──────────────────────────────────────────────────────────────
function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatSubmittedAtFR() {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 16).replace('T', ' ');
  }
}

function row(label, value) {
  return `<tr>
    <td valign="top" width="120" style="width:120px; padding-top:5px; padding-right:0; padding-bottom:5px; padding-left:0; color:${COLORS.graphite}; font-family:${FONT_BODY}; font-size:13px; ${TD_BODY}">${label}</td>
    <td valign="top" style="padding-top:5px; padding-right:0; padding-bottom:5px; padding-left:0; color:${COLORS.ink}; font-family:${FONT_BODY}; font-size:13px; font-weight:bold; ${TD_BODY}">${value}</td>
  </tr>`;
}

function linkRow(label, value, href) {
  return `<tr>
    <td valign="top" width="120" style="width:120px; padding-top:5px; padding-right:0; padding-bottom:5px; padding-left:0; color:${COLORS.graphite}; font-family:${FONT_BODY}; font-size:13px; ${TD_BODY}">${label}</td>
    <td valign="top" style="padding-top:5px; padding-right:0; padding-bottom:5px; padding-left:0; font-family:${FONT_BODY}; font-size:13px; ${TD_BODY}"><a href="${esc(href)}" style="color:${COLORS.accent}; text-decoration:none; font-weight:bold;">${esc(value)}</a></td>
  </tr>`;
}

function sectionHead(title) {
  return `<p style="margin-top:0; margin-right:0; margin-bottom:10px; margin-left:0; color:${COLORS.graphite}; font-family:${FONT_BODY}; font-size:11px; font-weight:bold; ${TD_BODY}">${title}</p>`;
}

function section(title, innerRows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse; margin-top:24px; border-top-width:1px; border-top-style:solid; border-top-color:${COLORS.smoke};">
    <tr><td style="padding-top:20px; padding-right:0; padding-bottom:0; padding-left:0;">
      ${sectionHead(title)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse;">${innerRows}</table>
    </td></tr>
  </table>`;
}

// ── Main builder ─────────────────────────────────────────────────────────
//
// Expected `data` shape (sent from ContactForm.astro):
//   formType: 'contact'
//   firstName, email, message          (required)
//   preferredLanguage                  ('fr'|'en'|'es'|'it')
//   locale                             (site locale the visitor was browsing)
//   page                               (which page the form was on)
export function buildContactEmailHtml(data) {
  const firstName = String(data.firstName || '').trim() || L.notProvided;
  const replyLang = data.preferredLanguage || data.locale;

  let body = '';

  // CONTACT (always)
  body += `<p style="margin-top:0; margin-right:0; margin-bottom:6px; margin-left:0; color:${COLORS.graphite}; font-family:${FONT_BODY}; font-size:11px; font-weight:bold; ${TD_BODY}">${L.contact}</p>
  <h2 style="margin-top:0; margin-right:0; margin-bottom:14px; margin-left:0; font-family:${FONT_DISPLAY}; font-size:19px; font-weight:bold; color:${COLORS.ink}; line-height:24px; mso-line-height-rule:exactly;">${esc(firstName)}</h2>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse;">
    ${data.email ? linkRow(L.email, data.email, `mailto:${data.email}`) : ''}
  </table>`;

  // MESSAGE — the whole point of the email, so it gets the tinted panel
  // treatment rather than a plain label/value row.
  const messageText = String(data.message || '').trim();
  body += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse; margin-top:24px; border-top-width:1px; border-top-style:solid; border-top-color:${COLORS.smoke};">
    <tr><td style="padding-top:20px; padding-right:0; padding-bottom:0; padding-left:0;">
      ${sectionHead(L.message)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse; background-color:${COLORS.cream};">
        <tr><td style="padding-top:14px; padding-right:16px; padding-bottom:14px; padding-left:16px; font-family:${FONT_BODY}; font-size:14px; color:${COLORS.ink}; line-height:22px; mso-line-height-rule:exactly;">${esc(messageText).replace(/\n/g, '<br />')}</td></tr>
      </table>
    </td></tr>
  </table>`;

  // REPLY LANGUAGE — the visitor chose this explicitly; the chauffeur needs
  // it to know which language to answer in.
  body += section(
    L.replyLang,
    row('&mdash;', esc(LANGUAGE_LABELS[replyLang] || replyLang || 'Inconnu')),
  );

  // ORIGIN — which page and which language version of the site.
  if (data.page || data.locale) {
    let inner = '';
    if (data.page) inner += row(L.page, esc(data.page));
    if (data.locale) inner += row('Site', esc(String(data.locale).toUpperCase()));
    body += section(L.source, inner);
  }

  const submittedAt = formatSubmittedAtFR();

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${L.eyebrow}</title>
<!--[if mso]>
<style type="text/css">
  table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  td { mso-line-height-rule: exactly; }
  body, table, td, p, a { font-family: Arial, sans-serif !important; }
</style>
<![endif]-->
</head>
<body style="margin-top:0; margin-right:0; margin-bottom:0; margin-left:0; padding-top:0; padding-right:0; padding-bottom:0; padding-left:0; background-color:${COLORS.cream}; font-family:${FONT_BODY}; color:${COLORS.ink}; line-height:20px; mso-line-height-rule:exactly;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse; background-color:${COLORS.cream};">
  <tr><td align="center" style="padding-top:32px; padding-right:16px; padding-bottom:32px; padding-left:16px;">

    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; border-collapse:collapse; background-color:${COLORS.paper};">

      <!-- HEADER BAND (terracotta) — text left, logo right. -->
      <tr><td bgcolor="${COLORS.accent}" style="background-color:${COLORS.accent}; padding-top:24px; padding-right:32px; padding-bottom:24px; padding-left:32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse;">
          <tr>
            <td valign="top" style="padding-top:0; padding-right:16px; padding-bottom:0; padding-left:0;">
              <p style="margin-top:0; margin-right:0; margin-bottom:8px; margin-left:0; color:${COLORS.cream}; font-family:${FONT_BODY}; font-size:11px; font-weight:bold; line-height:14px; mso-line-height-rule:exactly;">${L.eyebrow}</p>
              <h1 style="margin-top:0; margin-right:0; margin-bottom:0; margin-left:0; color:${COLORS.paper}; font-family:${FONT_DISPLAY}; font-size:26px; font-weight:bold; line-height:32px; mso-line-height-rule:exactly;">${L.heading}</h1>
            </td>
            <td valign="top" align="right" width="${LOGO_COL_WIDTH}" style="width:${LOGO_COL_WIDTH}px; padding-top:0; padding-right:0; padding-bottom:0; padding-left:0;">
              <img src="${LOGO_URL}" alt="Driver Services" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" border="0" style="display:block; width:${LOGO_WIDTH}px; height:${LOGO_HEIGHT}px; max-width:${LOGO_WIDTH}px; border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic;" />
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- BODY -->
      <tr><td style="padding-top:28px; padding-right:32px; padding-bottom:28px; padding-left:32px;">${body}</td></tr>

      <!-- FOOTER -->
      <tr><td align="center" bgcolor="${COLORS.cream}" style="background-color:${COLORS.cream}; padding-top:16px; padding-right:32px; padding-bottom:16px; padding-left:32px; border-top-width:1px; border-top-style:solid; border-top-color:${COLORS.smoke};">
        <p style="margin-top:0; margin-right:0; margin-bottom:0; margin-left:0; color:${COLORS.graphite}; font-family:${FONT_BODY}; font-size:11px; line-height:14px; mso-line-height-rule:exactly;">${L.receivedVia} <span style="color:${COLORS.accent}; font-weight:bold;">Driver Services</span> &middot; ${esc(submittedAt)}</p>
      </td></tr>

    </table>

  </td></tr>
</table>

</body>
</html>`;
}
