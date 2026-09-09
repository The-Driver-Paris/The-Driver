// Blog data helpers — used by the public blog routes (server-rendered,
// `prerender = false`) and re-used by the admin.
//
// All functions take a Supabase client so the caller controls whether it's the
// server anon client (public pages) or the authed browser client (admin).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, BlogPostRow, BlogSettingsRow, Locale } from './database.types';
import { renderMarkdown, excerptFromMarkdown } from './markdown';

type Client = SupabaseClient<Database>;

export interface BlogListPage {
  posts: BlogPostRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** Published + due posts for a locale, newest first, paginated. */
export async function listPublishedPosts(
  db: Client,
  opts: { locale: Locale; page?: number; pageSize?: number; tag?: string },
): Promise<BlogListPage> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 9));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = db
    .from('blog_posts')
    .select('*', { count: 'exact' })
    .eq('locale', opts.locale)
    .eq('status', 'published')
    .or(`published_at.is.null,published_at.lte.${new Date().toISOString()}`)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (opts.tag) q = q.contains('tags', [opts.tag]);

  const { data, error, count } = await q;
  if (error) throw error;

  const total = count ?? 0;
  return {
    posts: data ?? [],
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** One published post by slug + locale, or null. */
export async function getPublishedPost(
  db: Client,
  opts: { locale: Locale; slug: string },
): Promise<BlogPostRow | null> {
  const { data, error } = await db
    .from('blog_posts')
    .select('*')
    .eq('locale', opts.locale)
    .eq('slug', opts.slug)
    .eq('status', 'published')
    .or(`published_at.is.null,published_at.lte.${new Date().toISOString()}`)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/** Up to `n` other published posts in the same locale, most recent first. */
export async function getRelatedPosts(
  db: Client,
  opts: { locale: Locale; excludeId: string; tags: string[]; n?: number },
): Promise<BlogPostRow[]> {
  const n = opts.n ?? 3;
  let q = db
    .from('blog_posts')
    .select('*')
    .eq('locale', opts.locale)
    .eq('status', 'published')
    .neq('id', opts.excludeId)
    .or(`published_at.is.null,published_at.lte.${new Date().toISOString()}`)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(n);
  if (opts.tags.length) q = q.overlaps('tags', opts.tags);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/** All distinct tags across published posts in a locale. */
export async function getPublishedTags(db: Client, locale: Locale): Promise<string[]> {
  const { data, error } = await db
    .from('blog_posts')
    .select('tags')
    .eq('locale', locale)
    .eq('status', 'published');
  if (error) throw error;
  const set = new Set<string>();
  for (const row of data ?? []) for (const t of row.tags ?? []) set.add(t);
  return [...set].sort();
}

export async function getBlogSettings(db: Client): Promise<BlogSettingsRow | null> {
  const { data, error } = await db.from('blog_settings').select('*').eq('id', true).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

// ---------------------------------------------------------------------------
// Presentation helpers (pure)
// ---------------------------------------------------------------------------

export function postHtml(post: BlogPostRow): string {
  return renderMarkdown(post.body_md);
}

export function postExcerpt(post: BlogPostRow): string {
  return post.excerpt?.trim() || excerptFromMarkdown(post.body_md);
}

export function postSeoTitle(post: BlogPostRow): string {
  return (post.seo_title?.trim() || post.title).slice(0, 70);
}

export function postSeoDescription(post: BlogPostRow): string {
  return (post.seo_description?.trim() || postExcerpt(post)).slice(0, 160);
}

/** Reading time in minutes (~200 wpm), min 1. */
export function readingMinutes(post: BlogPostRow): number {
  const words = String(post.body_md ?? '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** ISO date → locale-aware "9 September 2026" style. */
export function formatPostDate(iso: string | null, locale: Locale): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(
      { en: 'en-GB', fr: 'fr-FR', es: 'es-ES', it: 'it-IT' }[locale],
      { day: 'numeric', month: 'long', year: 'numeric' },
    ).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** Article JSON-LD for a post page. */
export function buildArticleSchema(post: BlogPostRow, url: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: postSeoDescription(post),
    image: post.cover_image ? [post.cover_image] : undefined,
    datePublished: post.published_at ?? post.created_at,
    dateModified: post.updated_at,
    author: { '@type': 'Organization', name: post.author_name || 'The Driver' },
    publisher: {
      '@type': 'Organization',
      name: 'Driver Services',
      logo: { '@type': 'ImageObject', url: 'https://thedriver.fr/newlogo.png' },
    },
    mainEntityOfPage: url,
    inLanguage: post.locale,
  };
}
