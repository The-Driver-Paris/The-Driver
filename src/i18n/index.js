import fr from './fr.json';
import en from './en.json';
import es from './es.json';
import it from './it.json';
import { HOURLY_RATE, ROUND_TRIP_DISCOUNT_PERCENT } from '../config/prices.js';

export const LOCALES = ['fr', 'en', 'es', 'it'];
export const DEFAULT_LOCALE = 'fr';

const STRINGS = { fr, en, es, it };

// Price placeholders usable inside any translation string. They exist so the
// chauffeur only ever edits src/config/prices.js — a copy line like
// "50 € / heure" would otherwise be a second place to keep in sync, in four
// languages. Substitution happens once per locale at build time.
const PRICE_TOKENS = {
  hourlyRate: String(HOURLY_RATE),
  roundTripDiscount: String(ROUND_TRIP_DISCOUNT_PERCENT),
};

function interpolate(value) {
  if (typeof value === 'string') {
    return value.replace(/\{(hourlyRate|roundTripDiscount)\}/g, (_, key) => PRICE_TOKENS[key]);
  }
  if (Array.isArray(value)) return value.map(interpolate);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = interpolate(v);
    return out;
  }
  return value;
}

// Memoised — t() is called on every component render, and walking the whole
// string tree each time would be wasted work.
const RESOLVED = {};

export function t(locale) {
  const key = STRINGS[locale] ? locale : DEFAULT_LOCALE;
  RESOLVED[key] ??= interpolate(STRINGS[key]);
  return RESOLVED[key];
}

// Build a path for a given locale. FR (default) is unprefixed.
// Prefer pathForRoute() for navigable app pages — localizedPath is for ad-hoc
// anchors or deep-links (e.g. "/#booking-form") that don't need a translated slug.
export function localizedPath(locale, path = '/') {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return clean;
  // The locale root keeps its trailing slash ('/en/', not '/en') so callers
  // appending a query or hash don't produce a URL that 308-redirects.
  return `/${locale}${clean === '/' ? '/' : clean}`;
}

export { ROUTES, pathForRoute, ROUTE_KEYS } from './routes.js';
