// Blog RSS feed. Move to src/pages/blog/rss.xml.ts when wiring Supabase.
// Output: https://thedriver.fr/blog/rss.xml
export const prerender = false;

import type { APIRoute } from 'astro';
import { getServerClient } from '../../lib/supabase';
import { listPublishedPosts, postExcerpt } from '../../lib/blog';

const SITE = 'https://thedriver.fr';

const esc = (s: string) =>
  String(s ?? '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));

export const GET: APIRoute = async () => {
  const db = getServerClient();
  let items = '';
  try {
    const { posts } = await listPublishedPosts(db, { locale: 'en', page: 1, pageSize: 30 });
    items = posts
      .map((p) => {
        const url = `${SITE}/blog/${p.slug}`;
        const date = new Date(p.published_at ?? p.created_at).toUTCString();
        return `    <item>
      <title>${esc(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${date}</pubDate>
      <description>${esc(postExcerpt(p))}</description>
    </item>`;
      })
      .join('\n');
  } catch {
    /* empty feed rather than a 500 */
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>The Driver — Blog</title>
    <link>${SITE}/blog/</link>
    <description>Guides and tips for getting around Paris.</description>
    <language>en</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=3600',
    },
  });
};
