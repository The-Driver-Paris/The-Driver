// Minimal, dependency-free Markdown → HTML for blog article bodies.
//
// Security model: escape ALL HTML first, then re-introduce only a fixed set of
// tags from Markdown syntax. Admin-authored content is trusted, but escaping
// first means a paste from an external source can never inject a <script> or an
// onerror= attribute.
//
// Supported: h2/h3, paragraphs, **bold**, *italic*, `code`, [links](url),
// ![images](url), > blockquotes, - / 1. lists, --- rules, fenced ``` code.
//
// If you outgrow this (tables, footnotes, embeds), swap in `marked` +
// `sanitize-html` — see SUPABASE-SETUP.md §5. Keep the same export signature.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only http(s), mailto, tel and site-relative links survive. */
function safeUrl(raw: string): string {
  const url = raw.trim();
  if (/^(https?:\/\/|mailto:|tel:|\/)/i.test(url)) return escapeHtml(url);
  return '#';
}

function inline(src: string): string {
  let s = escapeHtml(src);
  // images before links (same bracket syntax)
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, url) => {
    return `<img src="${safeUrl(url)}" alt="${alt}" loading="lazy" decoding="async" />`;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, url) => {
    const u = safeUrl(url);
    const ext = /^https?:\/\//i.test(u);
    return `<a href="${u}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}</a>`;
  });
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return s;
}

export function renderMarkdown(md: string): string {
  const lines = String(md ?? '').replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  let listType: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // fenced code block
    if (/^```/.test(line)) {
      closeList();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; // closing fence
      out.push(`<pre><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }

    if (/^\s*$/.test(line)) {
      closeList();
      i++;
      continue;
    }

    if (/^###\s+/.test(line)) {
      closeList();
      out.push(`<h3>${inline(line.replace(/^###\s+/, ''))}</h3>`);
      i++;
      continue;
    }
    if (/^##\s+/.test(line)) {
      closeList();
      out.push(`<h2>${inline(line.replace(/^##\s+/, ''))}</h2>`);
      i++;
      continue;
    }
    if (/^#\s+/.test(line)) {
      // a single # in body copy → treat as h2 (h1 is the page title)
      closeList();
      out.push(`<h2>${inline(line.replace(/^#\s+/, ''))}</h2>`);
      i++;
      continue;
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      closeList();
      out.push('<hr />');
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      closeList();
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`);
      continue;
    }

    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ol || ul) {
      const want: 'ul' | 'ol' = ol ? 'ol' : 'ul';
      if (listType && listType !== want) closeList();
      if (!listType) {
        listType = want;
        out.push(`<${want}>`);
      }
      out.push(`<li>${inline((ol ?? ul)![1])}</li>`);
      i++;
      continue;
    }

    // paragraph — gather until blank line
    closeList();
    const buf: string[] = [line];
    i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,3}\s|>\s?|```|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])) {
      buf.push(lines[i++]);
    }
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }

  closeList();
  return out.join('\n');
}

/** Plain-text excerpt fallback: first ~30 words of the body, tags stripped. */
export function excerptFromMarkdown(md: string, words = 30): string {
  const text = String(md ?? '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#>*_`~-]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = text.split(' ').filter(Boolean);
  return parts.length <= words ? text : parts.slice(0, words).join(' ') + '…';
}
