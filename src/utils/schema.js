// JSON-LD schema builders — one place for structured data helpers so the
// page files stay free of schema boilerplate.

import { disneylandData } from './disneyland.js';
import { parisTransferData, parisChauffeurData } from './parisPages.js';

/**
 * Turn the localized FAQ categories tree into a flat FAQPage schema.
 * Google only uses the top-level `mainEntity` array; categories are flattened.
 */
export function buildFaqPageSchema(faq) {
  const items = [];
  for (const category of faq?.categories ?? []) {
    for (const qa of category?.items ?? []) {
      if (!qa?.q || !qa?.a) continue;
      items.push({
        '@type': 'Question',
        name: qa.q,
        acceptedAnswer: { '@type': 'Answer', text: qa.a },
      });
    }
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items,
  };
}

/**
 * Taxi / transfer Service schema — shipped on the Tarifs page so search
 * engines understand the priced service offerings.
 */
export function buildRatesServiceSchema({ locale, siteUrl }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: 'Private chauffeur / taxi transfer',
    provider: {
      '@type': 'TaxiService',
      name: 'Driver Services',
      telephone: '+33634301292',
      areaServed: 'Paris, Île-de-France',
    },
    areaServed: ['Paris', 'Charles de Gaulle Airport', 'Orly Airport', 'Beauvais Airport', 'Disneyland Paris', 'Versailles'],
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'EUR',
      lowPrice: '45',
      highPrice: '200',
      offerCount: '42',
      availability: 'https://schema.org/InStock',
      url: siteUrl,
    },
    inLanguage: locale,
  };
}

/**
 * Disneyland Paris landing page — a Service schema for the priced transfer
 * offer plus a FAQPage schema built from the same resolved (price-substituted)
 * FAQ the page renders. Returns an array so BaseLayout emits both blocks.
 */
export function buildDisneylandSchema({ locale, siteUrl }) {
  const { routeItems, faqItems } = disneylandData(locale);

  const carFares = routeItems.map((r) => r.carFrom).filter((n) => typeof n === 'number');
  const vanFares = routeItems.map((r) => r.vanFrom).filter((n) => typeof n === 'number');

  const service = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: 'Private transfer to Disneyland Paris',
    name: 'Disneyland Paris private transfer',
    provider: {
      '@type': 'TaxiService',
      name: 'Driver Services',
      telephone: '+33634301292',
      areaServed: 'Paris, Île-de-France',
    },
    areaServed: [
      'Disneyland Paris',
      'Marne-la-Vallée',
      'Charles de Gaulle Airport',
      'Orly Airport',
      'Beauvais Airport',
      'Paris',
    ],
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'EUR',
      lowPrice: String(carFares.length ? Math.min(...carFares) : 65),
      highPrice: String(vanFares.length ? Math.max(...vanFares) : 180),
      offerCount: String(routeItems.length || 4),
      availability: 'https://schema.org/InStock',
      url: siteUrl,
    },
    inLanguage: locale,
  };

  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems
      .filter((it) => it?.q && it?.a)
      .map((it) => ({
        '@type': 'Question',
        name: it.q,
        acceptedAnswer: { '@type': 'Answer', text: it.a },
      })),
  };

  return [service, faq];
}

/** Flatten a resolved [{q,a}] list into FAQPage schema. */
function faqPageFrom(faqItems) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: (faqItems ?? [])
      .filter((it) => it?.q && it?.a)
      .map((it) => ({
        '@type': 'Question',
        name: it.q,
        acceptedAnswer: { '@type': 'Answer', text: it.a },
      })),
  };
}

/**
 * Paris airport-transfer landing page — Service + FAQPage JSON-LD, with the
 * priced routes feeding the AggregateOffer range.
 */
export function buildParisTransferSchema({ locale, siteUrl }) {
  const { routeItems, faqItems } = parisTransferData(locale);
  const carFares = routeItems.map((r) => r.carFrom).filter((n) => typeof n === 'number');
  const vanFares = routeItems.map((r) => r.vanFrom).filter((n) => typeof n === 'number');

  const service = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: 'Private airport transfer in Paris',
    name: 'Paris private airport transfer',
    provider: {
      '@type': 'TaxiService',
      name: 'Driver Services',
      telephone: '+33634301292',
      areaServed: 'Paris, Île-de-France',
    },
    areaServed: [
      'Paris',
      'Charles de Gaulle Airport',
      'Orly Airport',
      'Beauvais Airport',
      'Paris train stations',
    ],
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'EUR',
      lowPrice: String(carFares.length ? Math.min(...carFares) : 60),
      highPrice: String(vanFares.length ? Math.max(...vanFares) : 180),
      offerCount: String(routeItems.length || 5),
      availability: 'https://schema.org/InStock',
      url: siteUrl,
    },
    inLanguage: locale,
  };

  return [service, faqPageFrom(faqItems)];
}

/**
 * Paris chauffeur-by-the-hour / sightseeing landing page — Service + FAQPage
 * JSON-LD. Price is the hourly rate from src/config/prices.js.
 */
export function buildParisChauffeurSchema({ locale, siteUrl }) {
  const { faqItems, hourlyRate } = parisChauffeurData(locale);

  const service = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: 'Private chauffeur hire by the hour in Paris',
    name: 'Paris private chauffeur hire',
    provider: {
      '@type': 'TaxiService',
      name: 'Driver Services',
      telephone: '+33634301292',
      areaServed: 'Paris, Île-de-France',
    },
    areaServed: ['Paris', 'Île-de-France', 'Versailles', 'Champagne', 'Giverny'],
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      price: String(hourlyRate),
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: String(hourlyRate),
        priceCurrency: 'EUR',
        unitCode: 'HUR',
        referenceQuantity: { '@type': 'QuantitativeValue', value: '1', unitCode: 'HUR' },
      },
      availability: 'https://schema.org/InStock',
      url: siteUrl,
    },
    inLanguage: locale,
  };

  return [service, faqPageFrom(faqItems)];
}
