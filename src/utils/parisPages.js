// Paris landing pages — resolved data (copy + live prices).
//
// Same idea as utils/disneyland.js: join the translated copy
// (src/i18n/*.json → `parisTransfer` / `parisChauffeur`) with live prices from
// src/config/prices.js, so the page components and the JSON-LD builders read
// identical numbers. Prices are never hard-coded into the copy — the FAQ
// answers carry `{priceCarCdg}` / `{priceVanCdg}` tokens substituted here.
// (`{hourlyRate}` is already substituted globally by src/i18n/index.js.)

import { t } from '../i18n/index.js';
import { getStartingPrice, getExplicitPrice } from './pricing.js';
import { HOURLY_RATE } from '../config/prices.js';

function fillTokens(str, map) {
  return String(str).replace(/\{(\w+)\}/g, (m, key) => (key in map ? String(map[key]) : m));
}

/** Paris airport-transfer page. @param {'fr'|'en'|'es'|'it'} locale */
export function parisTransferData(locale) {
  const d = t(locale).parisTransfer;

  const priceCarCdg = getStartingPrice('CDG', 'Paris');
  const priceVanCdg = getExplicitPrice('CDG', 'Paris', 8);
  const tokens = { priceCarCdg, priceVanCdg };

  const routeItems = (d.routes?.items ?? []).map((item) => ({
    ...item,
    carFrom: getStartingPrice(item.from, item.to),
    vanFrom: getExplicitPrice(item.from, item.to, 8),
  }));

  const faqItems = (d.faq?.items ?? []).map((item) => ({
    q: item.q,
    a: fillTokens(item.a, tokens),
  }));

  return { d, routeItems, faqItems, priceCarCdg, priceVanCdg };
}

/** Paris chauffeur-by-the-hour / sightseeing page. @param {'fr'|'en'|'es'|'it'} locale */
export function parisChauffeurData(locale) {
  const d = t(locale).parisChauffeur;

  // `{hourlyRate}` is already resolved by t(); this is belt-and-braces for any
  // answer that also references it, and keeps the shape parallel with the
  // transfer page.
  const faqItems = (d.faq?.items ?? []).map((item) => ({
    q: item.q,
    a: fillTokens(item.a, { hourlyRate: HOURLY_RATE }),
  }));

  return { d, faqItems, hourlyRate: HOURLY_RATE };
}
