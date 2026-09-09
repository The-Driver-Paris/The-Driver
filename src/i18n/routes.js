// Single source of truth for translated URL slugs.
// Add a new entry here and the language switcher + nav + canonical URL all follow.
//
// Every path ends in a trailing slash, matching `trailingSlash: 'always'` in
// astro.config.mjs and the `trailingSlash: true` rule in vercel.json. Omitting
// one here would make the canonical tag point at a URL that 308-redirects.
export const ROUTES = {
  home:       { fr: '/',           en: '/en/',           es: '/es/',           it: '/it/' },
  disneyland: { fr: '/transfert-disneyland-paris/', en: '/en/disneyland-paris-transfer/', es: '/es/traslado-disneyland-paris/', it: '/it/transfer-disneyland-paris/' },
  parisTransfer:  { fr: '/transfert-paris/',       en: '/en/paris-airport-transfer/', es: '/es/traslado-aeropuerto-paris/', it: '/it/transfer-aeroporto-parigi/' },
  parisChauffeur: { fr: '/chauffeur-prive-paris/', en: '/en/paris-chauffeur-hire/',   es: '/es/chofer-privado-paris/',      it: '/it/autista-privato-parigi/' },
  // Blog (Phase F). Pages live under src/_scaffold/blog/ until Supabase is wired
  // — see SUPABASE-SETUP.md. Listed here so pathForRoute('blog', …) resolves.
  blog:       { fr: '/blog/',      en: '/en/blog/',      es: '/es/blog/',      it: '/it/blog/' },
  fleet:      { fr: '/flotte/',    en: '/en/fleet/',     es: '/es/flota/',     it: '/it/flotta/' },
  rates:      { fr: '/tarifs/',    en: '/en/rates/',     es: '/es/tarifas/',   it: '/it/tariffe/' },
  childSeats: { fr: '/sieges-bebe/', en: '/en/child-seats/', es: '/es/asientos-bebe/', it: '/it/seggiolini-bambini/' },
  faqContact: { fr: '/faq-contact/', en: '/en/faq-contact/', es: '/es/faq-contacto/', it: '/it/faq-contatti/' },
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
