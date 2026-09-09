// Single source of truth for translated URL slugs.
// Add a new entry here and the language switcher + nav + canonical URL all follow.
//
// ENGLISH is the default locale (astro.config.mjs `defaultLocale: 'en'`,
// `prefixDefaultLocale: false`) — so EN paths are unprefixed and FR/ES/IT carry
// their /xx/ prefix. Every path ends in a trailing slash, matching
// `trailingSlash: 'always'` in astro.config.mjs and `trailingSlash: true` in
// vercel.json. Old (FR-default) URLs are 301-redirected in vercel.json.
export const ROUTES = {
  home:       { en: '/',           fr: '/fr/',                 es: '/es/',           it: '/it/' },
  disneyland: { en: '/disneyland-paris-transfer/', fr: '/fr/transfert-disneyland-paris/', es: '/es/traslado-disneyland-paris/', it: '/it/transfer-disneyland-paris/' },
  parisTransfer:  { en: '/paris-airport-transfer/', fr: '/fr/transfert-paris/',   es: '/es/traslado-aeropuerto-paris/', it: '/it/transfer-aeroporto-parigi/' },
  parisChauffeur: { en: '/paris-chauffeur-hire/',   fr: '/fr/chauffeur-prive-paris/', es: '/es/chofer-privado-paris/',  it: '/it/autista-privato-parigi/' },
  // Blog (Phase F). Only the EN blog exists as pages so far; FR/ES/IT slugs are
  // reserved. Blog pages pass hreflang={['en']} so no alternate 404s.
  blog:       { en: '/blog/',      fr: '/fr/blog/',            es: '/es/blog/',      it: '/it/blog/' },
  fleet:      { en: '/fleet/',     fr: '/fr/flotte/',          es: '/es/flota/',     it: '/it/flotta/' },
  rates:      { en: '/rates/',     fr: '/fr/tarifs/',          es: '/es/tarifas/',   it: '/it/tariffe/' },
  childSeats: { en: '/child-seats/', fr: '/fr/sieges-bebe/',   es: '/es/asientos-bebe/', it: '/it/seggiolini-bambini/' },
  faqContact: { en: '/faq-contact/', fr: '/fr/faq-contact/',   es: '/es/faq-contacto/', it: '/it/faq-contatti/' },
  // Post-conversion landing page. The booking form redirects here on submit
  // success. All four locales deliberately share ONE path, so any conversion
  // tracking you add later needs a single URL rule instead of a per-locale
  // regex. The page reads `?lang=` and renders the matching language block
  // before paint, so customers still see their language. noindex'd to keep it
  // out of search results.
  thankYou:   { fr: '/thank-you/', en: '/thank-you/',   es: '/thank-you/',    it: '/thank-you/' },
};

export function pathForRoute(routeKey, locale) {
  return ROUTES[routeKey]?.[locale] ?? ROUTES.home[locale];
}

export const ROUTE_KEYS = Object.keys(ROUTES);
