// Disneyland Paris landing page — resolved data (copy + live prices).
//
// One place that joins the translated copy (src/i18n/*.json → `disneyland`)
// with the live route prices (src/config/prices.js via utils/pricing.js), so
// the page component AND the JSON-LD schema builder read exactly the same
// numbers. Prices never get hard-coded into the copy: the FAQ answers carry
// `{priceCarCdg}` / `{priceVanCdg}` tokens that are substituted here.

import { t } from '../i18n/index.js';
import { getStartingPrice, getExplicitPrice } from './pricing.js';

/** Replace `{token}` occurrences in a string from a value map. */
function fillTokens(str, map) {
  return String(str).replace(/\{(\w+)\}/g, (m, key) => (key in map ? String(map[key]) : m));
}

/**
 * Resolve everything the Disneyland page needs for one locale.
 * @param {'fr'|'en'|'es'|'it'} locale
 */
export function disneylandData(locale) {
  const d = t(locale).disneyland;

  // Reference fares for the copy (CDG → Disneyland).
  const priceCarCdg = getStartingPrice('CDG', 'Disneyland');
  const priceVanCdg = getExplicitPrice('CDG', 'Disneyland', 8);
  const tokens = { priceCarCdg, priceVanCdg };

  // Route cards: attach the starting car fare (1–3 pax) and the van fare (8 pax).
  const routeItems = (d.routes?.items ?? []).map((item) => ({
    ...item,
    carFrom: getStartingPrice(item.from, item.to),
    vanFrom: getExplicitPrice(item.from, item.to, 8),
  }));

  // FAQ: substitute the price tokens into every answer.
  const faqItems = (d.faq?.items ?? []).map((item) => ({
    q: item.q,
    a: fillTokens(item.a, tokens),
  }));

  return { d, routeItems, faqItems, priceCarCdg, priceVanCdg };
}
