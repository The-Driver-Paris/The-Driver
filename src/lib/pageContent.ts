// Admin-editable marketing copy — the "overrides" resolver (Phase G).
//
// The site compiles its copy from src/i18n/*.json. This layer lets staff with
// the `content` section override specific text fields from the dashboard,
// per language, WITHOUT a deploy. An absent row, or a row with value === null,
// means "use the compiled text" — so the compiled JSON stays the source of
// truth and a cleared field restores the original.
//
// To make a landing page editable:
//   1. add `export const prerender = false` to the page
//   2. `const map = await loadOverrides(getServerClient(), 'disneyland', locale)`
//   3. `const d = applyOverrides(t(locale).disneyland, map, '')`
// Nothing else in the component changes.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Locale } from './database.types';

type Client = SupabaseClient<Database>;

/** field_key ("hero.title") → override string. Only non-null values are kept. */
export type OverrideMap = Map<string, string>;

/** Load every non-null override for one page + locale. Never throws — a content
 *  table that can't be read must degrade to the compiled copy, not a blank page. */
export async function loadOverrides(
  db: Client,
  pageKey: string,
  locale: Locale,
): Promise<OverrideMap> {
  const map: OverrideMap = new Map();
  try {
    const { data, error } = await db
      .from('page_overrides')
      .select('field_key, value')
      .eq('page_key', pageKey)
      .eq('locale', locale);
    if (error || !data) return map;
    for (const row of data) {
      if (typeof row.value === 'string' && row.value.trim() !== '') {
        map.set(row.field_key, row.value);
      }
    }
  } catch {
    /* offline / not migrated yet — return the empty map */
  }
  return map;
}

/**
 * Return a deep clone of `compiled` with every leaf string replaced by its
 * override, matched on the dotted path. Arrays are indexed numerically
 * ("faq.items.0.q"). `prefix` is prepended to every path (usually "").
 */
export function applyOverrides<T>(compiled: T, overrides: OverrideMap, prefix = ''): T {
  if (overrides.size === 0) return compiled;

  const walk = (node: unknown, path: string): unknown => {
    if (typeof node === 'string') {
      const hit = overrides.get(path);
      return hit ?? node;
    }
    if (Array.isArray(node)) {
      return node.map((item, i) => walk(item, path ? `${path}.${i}` : String(i)));
    }
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) {
        out[k] = walk(v, path ? `${path}.${k}` : k);
      }
      return out;
    }
    return node;
  };

  return walk(compiled, prefix) as T;
}

/**
 * Flatten a compiled copy object into [{ path, text }] leaves, so the admin
 * editor can render one input per editable string with the compiled value as
 * its placeholder.
 */
export function flattenCopy(compiled: unknown, prefix = ''): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  const walk = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      out.push({ path, text: node });
    } else if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, path ? `${path}.${i}` : String(i)));
    } else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(compiled, prefix);
  return out;
}
